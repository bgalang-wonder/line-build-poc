# Complexity Scoring System: Implementation Analysis

## Executive Summary

This document analyzes the existing codebase and maps it to the proposed complexity scoring system from Shin's Excel model. The goal is to build a **config-driven, transparent, calibratable** scoring system that reflects operational difficulty.

---

## Current State Analysis

### What Exists

| File | Purpose | Status |
|------|---------|--------|
| `scripts/lib/complexity.ts` | Basic complexity scoring | **Needs replacement** |
| `scripts/lib/transfers.ts` | Derived transfer computation | **Good foundation** |
| `config/transfers.config.ts` | Transfer type scoring | **Keep, extend** |
| `config/hdr-pod.mock.ts` | Pod assignment for steps | **Keep** |
| `config/stations.config.ts` | Station → side mapping | **Keep, extend** |
| `scripts/lib/schema/enums.ts` | ActionFamily, GroupingId, etc. | **Keep** |

### Current `complexity.ts` Limitations

The existing implementation scores based on:
- Step count (0.5 per step)
- Transfer complexity (from transfer config)
- Station transitions (1 per unique, 0.5 per transition)
- Pod transitions (2 per unique, 1.5 per transition)
- Action family variety (0.25 per unique family)

**What's missing:**
1. ❌ No per-step location/technique weights (Shin's model)
2. ❌ No hot/cold separation in scoring
3. ❌ No category aggregation (components, techniques, packaging)
4. ❌ No structural signals (grouping bounces, merge points, etc.)
5. ❌ No config externalization (weights hardcoded)
6. ❌ No transparency (can't see how score was derived)
7. ❌ No hotRatio calculation

---

## Data Model Mapping

### Step Fields Available for Scoring

From `schema/step.ts` and sample builds:

| Field | Shin's Equivalent | Notes |
|-------|-------------------|-------|
| `stationId` | Station | Maps to grouping via `stations.config.ts` |
| `groupingId` | Hot/Cold/Vending | Explicit on each step |
| `action.family` | Action type | PREP, HEAT, ASSEMBLE, etc. |
| `action.techniqueId` | Technique | `open_pack`, `get`, `pour`, etc. |
| `storageLocation.type` | Source Location | `cold_storage`, `dry_rail`, etc. |
| `from.sublocation.type` | Source Location | Alternative location source |
| `equipment.applianceId` | Equipment | `fryer`, `waterbath`, etc. |
| `quantity.value` | Qty | Multiplier for scoring |
| `time.durationSeconds` | Duration | For short-step detection |
| `dependsOn[]` | Dependencies | For structural signals |
| `input[]` / `output[]` | Material flow | For transfer derivation |

### Grouping Classification

From `stations.config.ts`:

```typescript
// Hot Side stations
"fryer" | "waterbath" | "turbo" | "toaster" | "clamshell_grill" | "press" | "pizza" | "microwave"

// Cold Side stations  
"garnish" | "speed_line" | "prep"

// Expo
"expo"

// Vending
"vending"
```

Each step also has explicit `groupingId: "hot_side" | "cold_side" | "vending"`.

---

## Proposed Implementation

### 1. Config Structure (`config/complexity.config.ts`)

```typescript
export interface ComplexityConfig {
  version: string;
  description: string;
  
  // Per-step weights (Shin's model)
  locationWeights: Record<string, number>;
  techniqueWeights: Record<string, number>;
  equipmentWeight: number;
  
  // Category aggregation weights
  categoryWeights: {
    hot: { location: number; technique: number; packaging: number; stationMovement: number };
    cold: { location: number; technique: number; packaging: number; stationMovement: number };
    taskCount: number;
  };
  
  // Structural signal weights (new)
  structuralSignals: Record<string, { weight: number; description: string }>;
  
  // Rating thresholds
  ratings: { low: number; medium: number; high: number };
}
```

### 2. Location Weight Mapping

Map `storageLocation.type` and `from.sublocation.type` to Shin's weights:

| Our Schema Value | Shin's Location | Weight |
|------------------|-----------------|--------|
| `cold_storage` | Cold Storage | 1.25 |
| `dry_rail` | Dry Rail | 0.75 |
| `cold_rail` | Cold Rail | 0.75 |
| `packaging` | Packaging | 0.75 |
| `kit_storage` | Kit | 0.50 |
| `equipment` (fryer) | From Fryer Station | 2.00 |
| `equipment` (waterbath) | Waterbath | 1.25 |
| `equipment` (turbo) | From Turbo Station | 2.00 |
| `work_surface` | Same station | 0.00 |

### 3. Technique Weight Mapping

Map `action.techniqueId` to Shin's weights:

| Our Schema Value | Shin's Technique | Weight |
|------------------|------------------|--------|
| `clamshell_grill` | Clamshell Grill | 4.00 |
| `pizza_sprinkle` | Pizza Sprinkle | 3.00 |
| `remove_from_pan` | Remove from pan | 3.00 |
| `open_pack` / `open_pouch` | Open Pouch | 2.00 |
| `wrap` / `roll` | Wrap / Roll | 2.00 |
| `smash_open` / `spread` / `cut` | Smash/Spread/Cut | 1.50 |
| `line_pour` | Line Pour | 1.25 |
| `portion` / `place` / `pour` | Standard actions | 1.00 |
| `shake` | Shake | 0.50 |
| `drizzle` | Drizzle | 0.25 |
| `get` | Retrieve | 0.75 |
| (none) | No action | 0.00 |

### 4. Structural Signals Computation

```typescript
interface StructuralSignals {
  stepCount: number;
  transferCount: number;
  groupingBounces: number;      // hot→cold→hot transitions
  stationTransitions: number;   // within-grouping station changes
  podTransitions: number;       // cross-pod movements
  parallelEntryPoints: number;  // steps with no dependencies
  mergePoints: number;          // steps with 2+ dependencies
  deepMerges: number;           // steps with 3+ dependencies
  shortEquipmentSteps: number;  // equipment steps <45s
  backToBackEquipment: number;  // consecutive same-equipment steps
}
```

### 5. Output Structure

```typescript
interface EnhancedComplexityMetrics {
  buildId: string;
  configVersion: string;
  
  // Headline metrics
  overallScore: number;
  rating: "low" | "medium" | "high" | "very_high";
  hotRatio: number;  // Hot work / Total (key operational metric)
  
  // Per-step aggregation (Shin's model)
  components: {
    hot: { location: number; technique: number; packaging: number; stationMovement: number };
    cold: { location: number; technique: number; packaging: number; stationMovement: number };
    taskCount: number;
  };
  
  // Structural signals
  signals: Record<string, { raw: number; weight: number; contribution: number }>;
  
  // Top contributors (for transparency)
  topContributors: Array<{ signal: string; contribution: number; percentage: number }>;
  
  // Per-step breakdown (for debugging)
  stepBreakdown?: Array<{
    stepId: string;
    grouping: GroupingId;
    locationWeight: number;
    techniqueWeight: number;
    equipmentWeight: number;
    qtyMultiplier: number;
    contribution: number;
  }>;
}
```

---

## Implementation Plan

### Phase 1: Config & Types
1. Create `config/complexity.config.ts` with externalized weights
2. Define `EnhancedComplexityMetrics` interface
3. Create mapping functions for location/technique vocabulary

### Phase 2: Per-Step Scoring
1. Implement `scoreStep(step, config)` function
2. Map step fields to Shin's weight tables
3. Handle missing data gracefully (default weights)

### Phase 3: Aggregation
1. Group steps by `groupingId`
2. Aggregate into category scores (location, technique, packaging)
3. Apply category weights from config
4. Calculate `hotRatio`

### Phase 4: Structural Signals
1. Implement signal detection functions
2. Compute grouping bounces from step sequence
3. Detect merge points from `dependsOn` arrays
4. Identify short equipment steps from `time.durationSeconds`

### Phase 5: Transparency & Output
1. Build `topContributors` array
2. Generate optional `stepBreakdown` for debugging
3. Format output for human readability

### Phase 6: Calibration
1. Run across all 27 builds
2. Compare to operational intuition
3. Adjust weights in config
4. Version the config

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `config/complexity.config.ts` | **Create** | Externalized weights |
| `scripts/lib/complexity.ts` | **Replace** | New scoring engine |
| `scripts/lib/complexity-signals.ts` | **Create** | Structural signal detection |
| `scripts/lib/complexity-types.ts` | **Create** | Type definitions |
| `scripts/commands/score.ts` | **Modify** | Use new scoring |
| `scripts/commands/portfolio-score.ts` | **Create** | Score all builds |

---

## Key Design Decisions

### 1. Normalization Strategy
**Decision needed:** Normalize against portfolio max (Shin's approach) or use absolute scores?

- **Portfolio normalization:** Scores are relative, comparable across builds
- **Absolute scores:** Scores are stable, don't change when portfolio changes

**Recommendation:** Start with absolute scores, add optional normalization layer.

### 2. Missing Data Handling
**Decision needed:** What weight for steps missing technique or location?

- Shin uses 0.0 or 0.5 depending on context
- Our schema has optional fields

**Recommendation:** Use 0.5 as default for missing technique, 0.75 for missing location (conservative).

### 3. Hot/Cold Classification
**Decision needed:** Use `groupingId` from step or derive from `stationId`?

- Steps have explicit `groupingId`
- Can also derive from `stationId` via `stations.config.ts`

**Recommendation:** Use explicit `groupingId` when present, fall back to station derivation.

### 4. Packaging Detection
**Decision needed:** How to identify "packaging" steps for the packaging category?

- `action.family === "PACKAGING"` is explicit
- `cookingPhase === "PASS"` often indicates packaging
- `container` field presence

**Recommendation:** Use `action.family === "PACKAGING"` as primary signal.

---

## Next Steps

1. Review this analysis with stakeholders
2. Confirm design decisions
3. Begin Phase 1 implementation
4. Iterate based on calibration results
