# Complexity Scoring System (CSMS) — Implementation Plan

> Purpose: deliver a config-driven, transparent, calibratable complexity scoring system for line builds that supports hot/cold pod throughput analysis.

This plan is written for implementation inside `01_Projects/line-build-redesign/poc/line-build-cli/` and assumes the current schema + transfer derivation pipeline are the starting point.

---

## 0) Scope, Principles, and Non-Goals

### In scope
- A new scoring engine that:
  - Separately scores **hot-side work** and **cold-side work**
  - Produces an **overall raw score** and a portfolio-relative **normalized score**
  - Computes **hotRatio** as a first-class metric for the 1 hot : 3 cold constraint
  - Is **config-driven** (weights + thresholds + vocabulary mapping + feature toggles)
  - Is **explainable** (category breakdown, per-signal contributions, and optional step ledger)
- Batch evaluation across the current portfolio (~27 builds) with a run receipt (timestamped output)
- A calibration loop: config change → rerun portfolio → diff ranking and coverage

### Not in scope (for this phase)
- A UI for managing weights (we will store configs in git as code)
- Storing scores back into an external warehouse (BigQuery) or Notion
- Perfect causal modeling of kitchen throughput (we’re building a heuristic score)
- Learning weights automatically (no ML training loop)

### Design principles
1. **Receipts over rhetoric**: every portfolio run writes a receipt containing inputs, versions, and outputs.
2. **Explainability by default**: a score without a derivation trail is considered incomplete.
3. **Separation of concerns**:
   - Feature extraction (what is true of the build) must be deterministic.
   - Scoring (how we value those facts) must be configurable.
4. **Hot/cold balance is operationally primary**:
   - `hotRatio` should be computed from hot/cold work only (not including global penalties), unless explicitly configured.
5. **Vocabulary drift must be visible**:
   - unknown technique/location keys should produce warnings + coverage stats in portfolio runs.

---

## 1) Success Criteria (Acceptance Requirements)

### Functional
- For any build JSON in `data/line-builds/`, the CLI can output:
  - `rawScore` (number)
  - `normalizedScore` (0–100) (when a portfolio reference is provided)
  - `rating` (low/medium/high/very_high)
  - `hotScore`, `coldScore`, `hotRatio`
  - a category breakdown aligned to Shin’s model (location/technique/packaging/stationMovement/taskCount)
  - structural signal contributions (grouping bounces, merge points, etc.)
- The system is fully driven by a config file (no hardcoded scoring constants in the scoring engine).

### Transparency
- For a single build, the system can produce a report that answers:
  - “What are the top 5 contributors to the score?”
  - “Which steps contributed most?” (optional step ledger)
  - “Which signals fired and by how much?”
  - “Which technique/location mappings were missing?”

### Comparability
- The system can score the full portfolio and produce a stable normalized score for each build using a defined reference method.

### Robustness
- Unknown technique/location values do not crash scoring; they:
  - fall back to a default weight
  - emit a warning
  - appear in portfolio-level coverage summaries

---

## 2) Proposed Architecture (Modules + Data Flow)

### Key existing files (today)
- `scripts/lib/complexity.ts` (current simplistic implementation; will be replaced)
- `scripts/lib/transfers.ts` (derived transfer steps; keep)
- `config/transfers.config.ts` (transfer scoring; keep)
- `config/stations.config.ts` (station definitions + side mapping; keep)
- `config/techniques.config.ts` (controlled technique vocabulary; leverage for mapping)
- Validation soft rules already implement bouncing detection:
  - `scripts/lib/validate/soft-rules.ts` → S16a (grouping bouncing), S16b (station bouncing)

### Proposed module layout

We keep `scripts/lib/complexity.ts` as the public entry point, but implement internally as a set of focused modules.

```
scripts/lib/complexity/
  types.ts            # Core interfaces for features + score report
  config.ts           # Load / validate complexity config (static import for now)
  mapping.ts          # Technique/location canonicalization (keys)
  features.ts         # BuildFeatures + StepFeatures extraction
  signals.ts          # Structural signal extraction (raw counts)
  scoring.ts          # Applies config to features → score report
  normalize.ts        # Portfolio normalization utilities
  explain.ts          # Human-readable formatting helpers (optional)

config/
  complexity.config.ts  # Model weights + thresholds + feature toggles
```

### Data flow (idiomatic)
1. **Parse** build JSON via existing `parseBuild()`.
2. **Extract features** (StepFeatures, BuildFeatures): what happened in the build.
3. **Score** using config: how much we value each feature.
4. **Normalize** (optional, requires portfolio reference): convert raw → 0–100 scale.
5. **Emit report**: stable JSON shape used by CLI, viewer, and calibration.

---

## 3) Core Data Contracts

### 3.1 ComplexityConfig (v1)
- Stored at `config/complexity.config.ts`
- Must include:
  - `version`, `description`
  - Per-step weights:
    - locationWeights: `Record<string, number>`
    - techniqueWeights: `Record<string, number>`
    - equipmentWeight: `number`
    - qty scaling policy (linear/capped/log)
  - Category weights (Shin):
    - hot: { location, technique, packaging, stationMovement }
    - cold: { location, technique, packaging, stationMovement }
    - taskCount
  - Structural signal weights:
    - grouping_bounces, station_transitions, pod_transitions, merge_points, deep_merges, parallel_entry_points, transfer_count, short_equipment_steps, back_to_back_equipment
  - Rating thresholds (absolute or percentile mode)
  - Normalization configuration (method + reference set)
  - Defaults for missing technique/location/qty

### 3.2 Score Report (v1)
A single build’s output should include:
- `buildId`, `configVersion`
- `scores`: `{ raw, normalized? }`
- `rating`
- `hotScore`, `coldScore`, `hotRatio`
- `categories` breakdown (hot/cold + task count)
- `signals` contributions table
- `topContributors` (configurable, for transparency)
- `stepBreakdown` (optional ledger)
- `warnings` (unknown mappings, missing data)

---

## 4) Feature Extraction Strategy

### 4.1 Canonical technique key
- Primary source: `step.action.techniqueId`
- Secondary source: infer a technique key from `action.family` if techniqueId missing (to avoid everything defaulting silently).
- Use `config/techniques.config.ts`:
  - Normalize aliases to canonical ids where possible.

### 4.2 Canonical location key
We need a stable “location key” to look up Shin weights.

Candidate sources in priority order:
1. `step.storageLocation.type` (if present)
2. `step.from.sublocation.type` (if present)
3. `step.from.sublocation.type === "equipment"` → treat as equipment retrieval bucket
4. otherwise `work_surface`

We also need an equipment-aware mapping for Shin’s “from turbo station” etc:
- If `from.sublocation.type === "equipment"`, use `from.sublocation.equipmentId` or `step.equipment.applianceId` to map to a location weight class.

### 4.3 Qty multiplier
- Primary: `step.quantity.value`
- If missing: default 1
- If explicitly zero (invalid): treat as 1 and warn
- Apply optional cap (config) to avoid extreme outliers.

### 4.4 Equipment usage
- `usesEquipment = Boolean(step.equipment?.applianceId)`
- `isShortEquipmentStep = usesEquipment && step.time?.durationSeconds !== undefined && step.time.durationSeconds < 45`

### 4.5 Grouping determination
- Use explicit `step.groupingId` when present.
- Fallback to `getStationSide(step.stationId)`.
- Treat `expo` separately in scoring policy (see §6.6).

---

## 5) Structural Signals Strategy (Build-Level)

Goal: compute raw counts deterministically and then apply config weights.

### 5.1 Reuse existing validation logic where appropriate
- S16a + S16b already implement bouncing detection.
- Recommendation: extract shared helper(s) from validation code (e.g., `getOrderedSteps`) into a common utility module so scoring and validation compute bouncing the same way.

### 5.2 Signals to compute (v1)

| Signal | Raw Definition | Notes |
|---|---|---|
| `step_count` | count authored steps (exclude derived transfer steps unless explicitly included) | Use build.steps.length |
| `transfer_count` | derivedTransfers.length | Derived via `scripts/lib/transfers.ts` |
| `grouping_bounces` | number of times a track leaves a grouping and later returns | Mirror S16a logic but count occurrences |
| `station_transitions` | number of changes in `stationId` between adjacent steps within same grouping | Similar to existing `calculateStationMetrics` but grouping-scoped |
| `pod_transitions` | number of changes in assigned pod between adjacent steps | Uses `assignPodForStep()` |
| `parallel_entry_points` | count of steps with `dependsOn.length === 0` (excluding trivial retrievals if you add that filter later) | Might be tuned |
| `merge_points` | count steps with `dependsOn.length >= 2` | |
| `deep_merges` | count steps with `dependsOn.length >= 3` | |
| `short_equipment_steps` | count equipment steps with duration < 45s | |
| `back_to_back_equipment` | count adjacent equipment steps where `applianceId` matches | Proxy for contention |

### 5.3 Derived transfers integration
Two supported approaches (choose one for v1):
- **A (recommended):** transfers contribute via signals (`transfer_count` and/or `inter_pod_transfer_count`).
- **B:** transfers contribute via an explicit additive term.

Approach A makes the model accounting-style and avoids mixing two scoring paradigms.

---

## 6) Scoring Strategy (How the Numbers Add Up)

### 6.1 Per-step “effort” scoring (raw)
For each step:

```
stepEffort = (locationWeight + techniqueWeight + equipmentWeight) * qtyMultiplier
```

Then aggregate step effort into hot/cold buckets.

### 6.2 Category breakdown (Shin)
We will compute raw sums per grouping:
- locationSum
- techniqueSum
- packagingSum
- stationMovementRaw

Then apply category weights:

- Hot category weights: 30% location, 40% technique, 15% packaging, 10% stationMovement
- Cold category weights: 30% location, 40% technique, 15% packaging, 0% stationMovement
- Task count: 5% (applies once)

### 6.3 Packaging category policy
We need a consistent definition for “packaging” contribution.

v1 rule (simple):
- Steps with `action.family === PACKAGING` count toward packagingSum.

Potential v2 refinements:
- Include steps with `container` present or `cookingPhase === PASS`
- Differentiate “final packaging” vs “mid-build container use”

### 6.4 StationMovement category policy
We should align with Shin’s intent:
- Hot station movement is weighted; cold is not.
- Station movement should be computed within grouping.

v1 rule:
- `stationMovementRaw = number of stationId changes between adjacent steps within hot_side`.

### 6.5 Structural signals contribution
For each signal:

```
contribution = rawCount * signalWeight
```

Then:

```
signalScore = sum(contribution)
```

### 6.6 Expo handling
Expo steps exist in the schema (station side = expo). In practice, expo is often a handoff.

v1 policy (recommended):
- Include expo steps in structural signals only (e.g., can cause grouping bounces and transfers)
- Exclude expo from hot/cold step-effort categories unless explicitly configured.

This prevents “handoff” steps from distorting hot/cold work balance.

### 6.7 HotRatio definition
To support throughput analysis, compute hotRatio from hot/cold work only:

```
hotRatio = hotScore / (hotScore + coldScore)
```

Do NOT include structural penalties in denominator by default.

---

## 7) Normalization Strategy (Portfolio Comparability)

### 7.1 Requirements
- Always output `rawScore` (stable across time)
- Optionally output `normalizedScore` if a reference set is provided
- Store normalization stats in portfolio run receipts

### 7.2 Methods
Support multiple methods; pick a default.

- `max`: normalized = raw / max(raw)
- `p95` (recommended): normalized = raw / p95(raw) (more robust to outliers)

Output scale: 0–100 with optional clamp.

### 7.3 Portfolio reference definition
v1: reference = “all builds under `data/line-builds/` that parse successfully”

v2: explicit reference list file (frozen set)

---

## 8) CLI + Artifacts (How We Operate the System)

### 8.1 New/updated commands

1) `lb score <buildId>`
- Prints a human-readable summary
- Writes JSON report to `data/complexity/<buildId>.score.json`

2) `lb score-portfolio`
- Scores all builds under `data/line-builds/`
- Writes receipt to `data/complexity-runs/<timestamp>.<configVersion>.json`
- Prints ranking table
- Prints coverage warnings (unknown techniques/locations)

3) `lb compare-scores --runA <file> --runB <file>` (optional v1; otherwise v2)
- Shows rank movers and top deltas

### 8.2 Artifact schema (portfolio run receipt)
Receipt must include:
- timestamp
- engine version (git SHA if available)
- config version
- normalization method + stats
- per-build results (buildId, raw, normalized, hotRatio)
- warnings summary

---

## 9) Testing & Validation Plan

### 9.1 Unit tests (core)
- mapping.ts
  - technique alias normalization
  - location key derivation precedence
- signals.ts
  - grouping bounces counts match existing S16a detection
  - merge points / deep merges correct
  - back-to-back equipment counting correct
- scoring.ts
  - deterministic output given fixed config and build

### 9.2 Golden set regression tests
Select ~5 representative builds:
- one simple linear build
- one with parallel tracks + merge point
- one hot-heavy (fryer/turbo)
- one cold-heavy (garnish heavy)
- one with inter-pod transfers

Regression assertions (less brittle than exact scores):
- rank-order constraints (A > B)
- hotRatio thresholds for known hot-heavy builds
- coverage expectations (no unknown technique keys for curated set)

### 9.3 Integration test
- Run `lb score-portfolio` in CI/local and ensure:
  - no crashes
  - receipt file is produced
  - scores are finite numbers

---

## 10) Implementation Phases + Task Breakdown

### Phase 1 — Foundations (types, config, skeleton)
**Deliverable:** config-driven scoring engine compiled and callable.

Tasks:
1. Create `config/complexity.config.ts` with Shin-aligned weights (initial pass).
2. Add `scripts/lib/complexity/` module skeleton with:
   - types.ts
   - mapping.ts
   - features.ts
   - signals.ts
   - scoring.ts
3. Keep `scripts/lib/complexity.ts` as wrapper that exports `calculateComplexityV1()` (or similar).

Acceptance:
- TypeScript builds.
- `calculateComplexity()` returns a report with correct shape.

### Phase 2 — Per-step scoring + hot/cold category breakdown
**Deliverable:** Shin-like per-step scoring with hot/cold breakdown.

Tasks:
1. Implement technique mapping and defaults.
2. Implement location mapping and defaults.
3. Implement equipment weight application.
4. Implement packaging category.
5. Implement stationMovementRaw and category weighting.
6. Implement hotRatio.

Acceptance:
- For a sample build, report includes hot/cold category breakdown.
- Unknown technique/location keys are warned, not silent.

### Phase 3 — Structural signals (v1 set)
**Deliverable:** structural signals computed and included.

Tasks:
1. Implement counts for: grouping_bounces, station_transitions, pod_transitions.
2. Implement dependency-based counts: parallel_entry_points, merge_points, deep_merges.
3. Implement time-based signal: short_equipment_steps.
4. Implement sequence-based signal: back_to_back_equipment.
5. Integrate derived transfer count.

Acceptance:
- Signals table present with raw/weight/contribution.
- At least one build demonstrates non-zero grouping bounces and merge points.

### Phase 4 — Portfolio runs + normalization
**Deliverable:** batch scoring and stable comparability.

Tasks:
1. Implement `lb score-portfolio` command.
2. Implement normalization stats (max and p95; choose default).
3. Emit run receipt.

Acceptance:
- One command generates a portfolio ranking and receipt file.

### Phase 5 — Calibration support + diff tooling (optional)
**Deliverable:** easier tuning workflow.

Tasks:
1. Implement config diff summary (what weights changed).
2. Implement run diff report (rank movers, score deltas).

Acceptance:
- You can compare two runs and see “what changed and why.”

---

## 11) Key Open Decisions (Need Explicit Choice)

1) **Normalization method default:** `max` vs `p95` (recommend p95).
2) **Transfers contribution model:** signals-only vs additive bucket.
3) **Expo handling:** exclude from hot/cold by default (recommended) vs include.
4) **Missing data defaults:** technique/location defaults (recommend conservative but explicit).

---

## 12) Risks and Mitigations

### Risk: vocabulary drift (new techniqueIds)
Mitigation: warnings + coverage reporting; add mapping entries as part of calibration.

### Risk: double-counting movement
Mitigation: choose a single accounting: either stationMovement + transfers signals, or keep one and downweight the other; monitor calibration.

### Risk: normalization drift when portfolio changes
Mitigation: optional frozen reference set file; store reference stats in receipts.

### Risk: step order ambiguity (parallel tracks)
Mitigation: compute some signals per trackId; avoid relying on total ordering where not meaningful.

---

## 13) Deliverables Checklist

- [ ] `config/complexity.config.ts`
- [ ] `scripts/lib/complexity/` modules
- [ ] Updated `scripts/lib/complexity.ts` exports new report shape
- [ ] `lb score` command
- [ ] `lb score-portfolio` command
- [ ] `data/complexity/` outputs (per build)
- [ ] `data/complexity-runs/` run receipts
- [ ] Golden set tests + invariants

---

## 14) Suggested First Milestone (1–2 sessions)

Milestone: **Phase 1 + Phase 2**
- Implement config + per-step scoring + hot/cold breakdown + hotRatio.
- Defer structural signals and normalization until after we validate the accounting matches Shin qualitatively.
