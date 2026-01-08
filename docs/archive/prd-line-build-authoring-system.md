# Line Build Authoring System — PRD

**Status:** Draft  
**Created:** 2025-01-06  
**Author:** Brandon Galang

---

## Problem Statement

Line builds today don't meet minimum viable data quality to support downstream use cases.

They work well enough to run a kitchen, but:
- Can't power complexity scoring (requires manual spreadsheet work)
- Can't power cross-menu queries ("show me all dishes using waterbath")
- Can't power variant management (equipment changes mean full rewrites)
- Can't validate completeness (no way to know what's missing)
- Maintenance is manual and error-prone

---

## Goal

A structured line build that:
1. Captures dependencies (what must happen before what)
2. Captures tagged properties (action, target, equipment, time, phase, station, etc.)
3. Enables automatic complexity scoring
4. Enables variant derivation (different equipment profiles, labor models)
5. Validates completeness before publish
6. Simplifies the editing and maintenance process

---

## Approach

### Two Pillars

**1. DAG as data model**
- A line build is a directed acyclic graph of tagged work units
- Nodes = work units (prep this, heat that, assemble)
- Edges = order constraints (A must happen before B)
- Tags = properties on nodes (action type, equipment, time, phase, station, etc.)

**2. AI as authoring assistant**
- Reduces friction at every step of the authoring process

### Why DAG

A linear list forces one ordering. But many dishes have parallelizable prep. The DAG captures:
- **Hard dependencies** — can't heat chicken until you open the pouch
- **Flexible ordering** — sauce prep and chicken prep can happen in either order
- **Batch sync** — multiple things must complete before the next step (implicit in graph structure)

A linear KDS view is derived by topological sort. Multiple valid orderings exist; the DAG is the source of truth.

### Where AI Helps

| Friction Point | How AI Helps |
|----------------|--------------|
| Starting from blank | User pastes recipe notes; AI proposes structure |
| Knowing what to fill | AI asks questions based on what's missing |
| Finding gaps | AI flags incomplete/inconsistent data |
| Choosing values | AI proposes options; user reacts instead of recalls |
| Extending schema | AI maps new terms to existing vocabulary or proposes new entries with reasoning |

---

## Solution Components

### The Interface (Three Panels)

| Panel | Purpose | User Action |
|-------|---------|-------------|
| **Left: Raw Input** | Chef types/pastes/speaks notes | Free-form entry |
| **Middle: Questions & Options** | System asks clarifying questions | Select from multiple choice, confirm/reject AI suggestions |
| **Right: Structured Preview** | Live view of the DAG / filled form | Review, direct edit, see validation status |

**Edit modes:**
- **Guided mode** — Middle panel drives; chef answers questions
- **Direct mode** — Right panel drives; chef edits form/graph directly
- **Hybrid** — Both active; changes sync

### The Data Model

```
WorkUnit (Node) {
  id: string
  tags: {
    action: ActionType        // PREP, HEAT, TRANSFER, ASSEMBLE, etc.
    target: ItemReference     // BOM ID (40*, 41*, 88* codes) preferred, name fallback
    equipment?: EquipmentRef  // waterbath, turbo, fryer, etc.
    time?: Duration           // { value, unit, active/passive }
    phase?: Phase             // PRE_COOK, COOK, POST_COOK, ASSEMBLY
    station?: StationRef      // hot-side, cold-side, expo, etc.
    tool?: ToolRef            // tongs, ladle, etc.
    container?: ContainerRef  // 1/6 pan, bowl, etc.
    timingMode?: TimingMode   // a_la_minute, sandbag, hot_hold
    requiresOrder?: boolean   // true = needs order-specific input (customizations)
    prepType?: PrepType       // pre_service (before orders) vs order_execution (during service)
    storageLocation?: StorageLoc  // cold_storage, cold_rail, dry_rail (for pre-service prep)
    bulkPrep?: boolean        // true = bulk pattern (open → portion → store)
    ...extensible
  }
  dependsOn: DependencyEdge[] // edges (order constraints)
}

ItemReference {
  bomId?: string              // e.g., "40-12345" (preferred)
  name?: string               // fallback when no BOM match (may signal sub-assembly/transformed item)
}

DependencyEdge {
  nodeId: string
  soft?: boolean              // true = recommended but optional
}

LineBuild {
  id: string
  menuItemId: string
  workUnits: WorkUnit[]
  metadata: { author, version, status, ... }
}
```

### BOM Integration

**The authoring tool has BOM data available** (item names, item IDs like 40\*, 41\*, 88\*).

| What happens | How it works |
|--------------|--------------|
| User types "chicken breast" | AI matches to BOM item ID (e.g., `40-12345`) |
| User types ambiguous term | AI asks "Did you mean X or Y?" showing options from BOM |
| Cookbook updates item name | Reference stays valid (linked by ID, not text) |
| Step says "combine sauce" | We know exactly which sauce (BOM ID), not just the word |

**Benefits:**
- Cookbook changes propagate automatically (we store references, not strings)
- Consistent ID linking across systems (40\*, 41\*, 88\* codes)
- AI can disambiguate when multiple items match
- Human-readable names are fallback only (signal sub-assembly or transformed item)

### Edge Semantics

| Edge Type | Meaning | How it works |
|-----------|---------|--------------|
| **Hard dependency** | A must finish before B starts | Default edge type |
| **Soft dependency** | A should finish before B, but not strictly required | Edge with `soft: true` |
| **Batch sync** | A and B both must finish before C | Multiple edges pointing to C (implicit in DAG) |

### Validation Checklist

A checklist that surfaces what's missing or unconfirmed (not a blocking rules engine).

| Check | What it validates |
|-------|-------------------|
| All nodes have action type | Every work unit has `tags.action` |
| HEAT nodes have equipment | If `action = HEAT`, `equipment` is present |
| HEAT nodes have time | If `action = HEAT`, `time` is present |
| No orphan nodes | Every node is reachable from start or leads to end |
| No cycles | DAG has no cycles |
| Dependencies confirmed | Chef explicitly signed off on edge relationships |
| Complexity score calculated | System can compute a score |

Each check shows:
- **AI assessment** — "AI thinks this is complete because..."
- **Chef confirmation** — Explicit sign-off

### Interaction Model

Three ways to interact with the same underlying data:

| Mode | What it is | Example |
|------|------------|---------|
| **Unstructured input** | Free-form text, notes, voice | Chef pastes recipe notes or types "open pouch, cook 5 min, put in bowl" |
| **AI-generated selections** | Questions, recommendations, validations | "What equipment is used here?" with options; "This looks incomplete" flags |
| **Structured input** | Explicit form/schema | Direct editing of tags: action = HEAT, equipment = waterbath, time = 5min |

Users can move between modes fluidly. The underlying DAG updates regardless of which mode is used.

### Variant Management (Overlays)

**Model:** Patch overlay

- Base DAG = canonical recipe (Culinary Excellence owns)
- Overlay = "for this context, change these things"
- When base updates, overlay applies on top; conflicts flagged for review

**Example overlay:**
```
Overlay: "No waterbath locations"
  - Node "heat-chicken": change equipment from "waterbath" to "turbo"
  - Node "heat-chicken": change time from 5min to 3min
```

### Tag Vocabulary

- Fixed set of recommended values for each tag type
- "Other" option available
- AI-driven extension: maps new terms to existing vocabulary or proposes new entries with reasoning
- New entries go to a review queue for super-user approval

---

## Schema Reference (Working Draft)

> **⚠️ STATUS: DRAFT — Needs sign-off from Culinary Engineering**
> 
> This is a working document. Values listed below are initial proposals based on conversations with Shin. Final vocabulary needs validation against real line builds.

### WorkUnit Tags

| Tag | Type | Required | Possible Values | Notes |
|-----|------|----------|-----------------|-------|
| `action` | ActionType | ✅ Yes | `PREP`, `HEAT`, `TRANSFER`, `ASSEMBLE`, `PORTION`, `PLATE`, `FINISH`, `QUALITY_CHECK` | TBD: Review against actual line build actions |
| `target` | ItemReference | ✅ Yes | BOM ID (e.g., `40-12345`) or name fallback | Prefer BOM ID; name = fallback |
| `equipment` | EquipmentRef | ⚠️ If HEAT | `waterbath`, `turbo`, `fryer`, `microwave`, `grill`, `oven`, `stovetop`, `salamander` | TBD: Full equipment list from CE |
| `time` | Duration | ⚠️ If HEAT | `{ value: number, unit: "sec" \| "min", type: "active" \| "passive" }` | |
| `phase` | Phase | Optional | `PRE_COOK`, `COOK`, `POST_COOK`, `ASSEMBLY`, `PASS` | During order execution |
| `station` | StationRef | Optional | `hot-side`, `cold-side`, `expo`, `prep`, `pass` | TBD: Validate station names |
| `tool` | ToolRef | Optional | `tongs`, `ladle`, `spatula`, `scoop`, `knife`, `thermometer` | TBD: Full tool list |
| `container` | ContainerRef | Optional | `1/6 pan`, `1/9 pan`, `bowl`, `plate`, `bag`, `pouch` | TBD: Full container list |
| `timingMode` | TimingMode | Optional | `a_la_minute`, `sandbag`, `hot_hold` | When is this cooked relative to order? |
| `requiresOrder` | boolean | Optional | `true` / `false` | Does this step need customer input? |
| `prepType` | PrepType | Optional | `pre_service`, `order_execution` | When does this work happen? |
| `storageLocation` | StorageLoc | Optional | See Storage Locations table below | TBD: Validate full list with CE |
| `bulkPrep` | boolean | Optional | `true` / `false` | Is this a bulk prep pattern? |

### Equipment Utilization Rules

| Equipment | Commingling Rule | Notes |
|-----------|------------------|-------|
| `turbo` | Yes — multiple items OK | |
| `fryer` | Same type only | e.g., only fries with fries |
| `microwave` | One at a time | |
| `waterbath` | Yes — multiple items OK | |
| `grill` | TBD | |
| `oven` | TBD | |

### Storage Locations (Full List TBD)

| Location | Description | Temperature | Accessibility |
|----------|-------------|-------------|---------------|
| `cold_storage` | Walk-in or reach-in fridge | Cold | Low (back of house) |
| `cold_rail` | Cold line/rail at station | Cold | High (at hand) |
| `dry_rail` | Dry storage at station | Ambient | High (at hand) |
| `freezer` | Freezer storage | Frozen | Low |
| `ambient` | Room temperature storage | Ambient | Medium |
| `hot_hold_well` | Hot holding well | Hot | High |
| *...more TBD* | | | |

### Open Questions for Schema Sign-off

- [ ] **Actions:** Is this list complete? Are there actions we're missing?
- [ ] **Equipment:** What's the full list of equipment across all locations?
- [ ] **Storage locations:** What's the complete list? (Shin mentioned there are more)
- [ ] **Stations:** What are all the station names used?
- [ ] **Tools:** Do we need to capture tools? What's the list?
- [ ] **Containers:** Do we need to capture containers? What's the list?
- [ ] **Commingling rules:** Which equipment has constraints?

---

## AI Feedback Loop

**Weight:** Medium-heavy (not launch functionality)

**What we capture:**

| Event | Data |
|-------|------|
| AI suggests, user accepts | (input, suggestion, "accepted") |
| AI suggests, user modifies | (input, suggestion, user's edit, "modified") |
| AI suggests, user rejects | (input, suggestion, "rejected") |
| User adds without AI suggestion | (context, user's input, "manual") |

**How it's used:**
- Prompt improvement (analyze rejection patterns)
- Vocabulary expansion (capture reasoning for new terms)
- Optional "why" prompt for richer signal

---

## Hypotheses to Validate

| Hypothesis | How we test | Success metric |
|------------|-------------|----------------|
| **H1: Structured capture is feasible** | Chefs author 10 line builds using the tool | < 2x time vs. free text |
| **H2: AI extraction works** | AI suggests tags from raw input | > 70% acceptance rate |
| **H3: Complexity score is useful** | Menu Strategy uses auto-score | Replaces manual spreadsheet |
| **H4: DAG captures real parallelism** | Review 20 dishes; confirm DAG matches chef mental model | > 80% agreement |
| **H5: Checklist improves completeness** | Compare completeness before/after | Fewer missing fields |

---

## Scope Boundaries

**We ARE building:**
- Structured schema for line builds
- Authoring tool with AI assistance
- Complexity scoring
- Variant/overlay management
- Validation checklist

**We are NOT building:**
- A KDS (we produce data that KDS consumes)
- An inventory system (we link to BOM, don't manage it)
- A routing engine (we capture station tags, don't optimize paths)
- A scheduling system (we capture timing, don't schedule production)

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Edge semantics | Hard + soft dependencies. Batch sync implicit. No concurrent for v1. |
| Overlay model | Patch overlay (diff on top of base) |
| AI feedback weight | Medium-heavy; log + optional "why"; not launch functionality |
| Tag vocabulary | Fixed + extensible via AI with review queue |

---

## Next Steps

1. Align stakeholders on this framing
2. Define the validation checklist in detail
3. Prototype the three-panel UI (wireframes)
4. Test H1 and H2 with a small pilot

---

---

## Functional Requirements

### P1 — Must-Have (v1 Success Criteria)

| ID | Job to Be Done | Acceptance Criteria |
|----|----------------|---------------------|
| **P1.1** | Capture work types in a computable way | Categorize into bounded action types; query across menu; count per dish; required for publish |
| **P1.2** | Identify what's being acted on | Link to BOM ID (40\*, 41\*, 88\* codes); fall back to name; distinguish ingredient from container/tool; explicit assembly relationships (what combines with what) |
| **P1.3** | Capture equipment + duration | Query by equipment; count equipment variety; warn if HEAT missing equipment/time; distinguish active vs passive time; capture equipment utilization rules (commingling: turbo=yes, fryer=same-type-only, microwave=one-at-a-time) |
| **P1.4** | Capture "when" in the process | Group by phase (pre-cook, cook, post-cook, pass); queryable, not buried in text |
| **P1.5** | Calculate complexity without manual entry | Auto-score from captured data; accounts for work variety, equipment variety, station changes, time breakdown, location/accessibility score; consistent across authors; explainable breakdown |
| **P1.6** | Handle variations without duplication | Conditional logic for equipment/location; base changes propagate; no separate copies |
| **P1.7** | Author from natural language | User doesn't need to know schema; system asks questions; consistent output |
| **P1.8** | Migrate existing data | 95%+ auto-converts; <5% needs review; uses same Q&A flow |
| **P1.9** | Capture pre-service prep separately | Distinguish pre-service prep from order execution; capture storage location (cold storage, cold rail, dry rail); capture bulk prep pattern; filter complexity by: include prep, exclude prep, prep-only |

### P2 — Should-Have (Operational Completeness)

| ID | Job to Be Done | Acceptance Criteria |
|----|----------------|---------------------|
| **P2.1** | Benchtop vs Production separation | Production is derived via transforms, not cloned; each owner can update independently |
| **P2.2** | Order-in / Sandbag vs Hot-hold clarity | Distinguish cook timing (à la minute vs sandbag); capture hot hold method + limits |
| **P2.3** | Kitchen reality constraints | Document KDS behavioral quirks; flag unreliable metrics |
| **P2.4** | Scenario preview | Preview resolved output for different equipment profiles in-editor |

### P3 — Nice-to-Have (Future)

| ID | Job to Be Done |
|----|----------------|
| **P3.1** | Routing graph + transit modeling |
| **P3.2** | Rich digital work instructions (media, QC checks) |

---

## Assessment: Does the PRD Address the Requirements?

### P1 Coverage

| Requirement | PRD Coverage | How |
|-------------|--------------|-----|
| **P1.1** Work types | ✅ Covered | `tags.action` on WorkUnit with bounded ActionType enum |
| **P1.2** What's acted on | ✅ Covered | `tags.target` as ItemReference (BOM ID preferred, name fallback); BOM integration section added; AI asks clarifying questions; explicit assembly relationships enabled |
| **P1.3** Equipment + duration | ✅ Covered | `tags.equipment`, `tags.time` with active/passive distinction; equipment utilization rules (commingling) noted; validation checklist warns if missing |
| **P1.4** When in process | ✅ Covered | `tags.phase` enum (PRE_COOK, COOK, POST_COOK, ASSEMBLY); queryable |
| **P1.5** Complexity scoring | ✅ Covered | DAG enables critical path + parallelism scoring; tags provide equipment/station variety counts; location/accessibility score added |
| **P1.6** Variations | ✅ Covered | Patch overlay model; base changes propagate; no duplication |
| **P1.7** Natural language authoring | ✅ Covered | Three interaction modes (unstructured → AI questions → structured); user doesn't need to know schema |
| **P1.8** Migration | ✅ Covered | Migration strategy section added; 99.2% automated proven by experiment |
| **P1.9** Pre-service prep | ✅ Covered | `prepType`, `storageLocation`, `bulkPrep` tags added; complexity scoring filters by prep type |

### P2 Coverage

| Requirement | PRD Coverage | How |
|-------------|--------------|-----|
| **P2.1** Benchtop vs Production | ✅ Covered | Overlay model supports CE-owned base + Ops-owned transforms |
| **P2.2** Timing modes | ✅ Covered | `tags.timingMode` captures a_la_minute/sandbag/hot_hold; finish steps are additional WorkUnits |
| **P2.3** KDS quirks | ⏸️ Deferred | KDS team will own this; not in scope for authoring tool |
| **P2.4** Scenario preview | ⏸️ Nice-to-have | Overlay model enables it; not v1 launch requirement |

### P3 Coverage

| Requirement | PRD Coverage |
|-------------|--------------|
| **P3.1** Routing graph | ❌ Explicitly deferred |
| **P3.2** Rich DWI | ❌ Explicitly deferred |

### Summary

| Priority | Coverage |
|----------|----------|
| **P1 (Must-have)** | 9/9 covered |
| **P2 (Should-have)** | 2/4 covered, 2 deferred (KDS quirks, scenario preview) |
| **P3 (Nice-to-have)** | Explicitly deferred ✅ |

### Gaps to Address

1. ~~**P1.8 Migration** — Add explicit section on migration workflow~~ ✅ Addressed below
2. ~~**P2.2 Hot-hold details**~~ ✅ Covered by existing `timingMode` tag; finish steps are just additional WorkUnits in the DAG
3. **P2.3 KDS quirks** — Deferred; KDS team will own documentation of behavioral constraints
4. **P2.4 Scenario preview** — Nice-to-have for v1; overlay model enables it when ready

---

## Migration Strategy

### Proven by Experiment

A trial migration of **64,909 legacy line build steps** validated the approach:

| Result | Value |
|--------|-------|
| **High-confidence automated** | 99.2% |
| **Needs manual review** | 0.8% |
| **Structural coverage** | 100% (all steps mapped) |
| **Deduplication ratio** | 24.7x (2,631 unique signatures) |

**Method:** Two-phase — deterministic rules first (28%), then BOM-enriched AI inference for ambiguous cases (2%).

**Reference:** See `data/analysis/` for full results and `data_quality_issues.json` for edge cases.

### Migration Paths

```
                    ┌───────────────────┐
                    │   Legacy (text)   │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │ automated     │ + human loop  │
              ▼               ▼               │
    ┌─────────────────────────────────────────┤
    │        Detailed (DAG)                   │
    │  - Full dependencies                    │
    │  - All tags populated                   │
    │  - Source of truth                      │
    └─────────────────────────────────────────┘
                              │
                              │ deterministic
                              ▼
    ┌─────────────────────────────────────────┐
    │        Simple (KDS view)                │
    │  - Linear sequence                      │
    │  - Minimal fields                       │
    │  - Derived from Detailed                │
    └─────────────────────────────────────────┘
```

| Path | Direction | Automation | Human Needed? |
|------|-----------|------------|---------------|
| **Legacy → Detailed** | Low fidelity → high | AI + rules | Optional (for 0.8% edge cases) |
| **Detailed → Simple** | High fidelity → low | Deterministic | Minimal (review only) |
| **Simple → Detailed** | Low → high | Not supported | Yes (full authoring) |

### Why This Works

1. **AI is excellent at JSON generation.** Modern coding models (Gemini, Claude) reliably produce structured JSON from unstructured text.
2. **High → low fidelity is trivial.** Topological sort + field pruning. No inference needed.
3. **Low → high fidelity is hard.** That's why we keep the Detailed layer as source of truth — you never have to reverse-engineer structure from KDS output.

---

## Success Metrics

| Job | Metric | Target |
|-----|--------|--------|
| Calculate complexity | Score computable for 100% of items | 100% |
| Handle variations | # of duplicate builds reduced to 1 per item | 1 build/item |
| Author from natural language | New dish authored in < 15 minutes | < 15 min |
| Migrate existing | < 5% of legacy items need manual review | < 5% |
| Eliminate spreadsheet | Shin stops using complexity spreadsheet | 0 usage |

---

## Definition of Done

**v1 is complete when:**

1. [ ] Schema is documented and stable
2. [ ] Authoring tool supports conversational input → structured output
3. [ ] Complexity scores match legacy spreadsheet within tolerance
4. [ ] Overlays work for equipment profile and customization scenarios
5. [ ] Cooking phases are structured data, not text
6. [ ] 50+ items successfully migrated as validation
7. [ ] Shin can author a new dish without spreadsheet
8. [ ] Jen can pull complexity scores without manual data entry

---

## What We're Explicitly Punting

1. "Busy vs compacted" as automatic — We capture the data; KDS decides which to show
2. Pod capacity constraints — Not modeling physical space limits (though structured data enables component lists for schematics generation)
3. Inventory availability routing — Assume inventory is present
4. Station-to-station transit time — Not modeling movement time (though time trial study data may inform complexity scoring in P2)
5. "Next batch" lookahead — KDS problem, not authoring problem
6. Printer-based workarounds — Actually, structured data enables selective printing (e.g., only pre-cook steps); deferring implementation

---

## FAQ

### Governance & Ownership

**Q: Who approves new vocabulary terms?**
A: Culinary Engineering, with an audit trail. AI acts as an initial filter (proposes new terms with reasoning), which is better than any previous process. CE reviews and approves via the review queue.

**Q: Who resolves overlay conflicts when base changes break an overlay?**
A: Each layer owns its own conflicts:
- **Benchtop (CE)** — CE resolves conflicts in the base/benchtop build
- **Execution (Ops/Training)** — Ops/Training resolves conflicts in production overlays

If execution overlays break, they can always fall back to re-deriving from benchtop via the AI flow. No cross-team escalation needed — each team owns their layer.

**Q: Who owns the complexity formula and weights?**
A: Shin is primary owner. Menu Strategy (Jen) has visibility and has seen this. Formula factors are documented in P1.5.

### Integration & Dependencies

**Q: Does KDS need to consume this output?**
A: No. This is being built as a **sidecar app** to solve complexity scoring and authoring problems independently. KDS can consume it later if they choose, but it's not a dependency for v1.

**Q: Who maintains BOM data?**
A: Culinary Engineering maintains BOM data today. This tool reads BOM; it doesn't write to it.

**Q: Does this connect to Cookbook?**
A: Not currently. This is a standalone system. Cookbook integration can happen later once we've validated the approach.

**Q: Where does this tool live?**
A: Sidecar app, separate from existing systems. Can be integrated later once validated.

### Migration

**Q: Who does the migration work?**
A: 
1. **AI does first pass** (99.2% automated per experiment)
2. **Spot check high-risk steps** and extrapolate
3. **Culinary Engineering reviews edge cases**, led by Shin

**Q: Who reviews the 0.8% edge cases?**
A: Shin and Culinary Engineering.

**Q: What's the cutover strategy?**
A: New upstream, legacy downstream. We build in the new system; legacy KDS view is derived. No big bang cutover required.

### Stakeholder Alignment

**Q: Is Shin on board?**
A: Yes. Shin is the primary stakeholder and partner on this project.

**Q: Has Jen (Menu Strategy) seen this?**
A: Yes.

**Q: Has Training been looped in?**
A: Not yet. They will be engaged once we've validated the approach with CE.

### Technical

**Q: How do we derive DAG → linear transform rules?**
A: From the migration data. We have pairings of enriched (new) to simplified (legacy) representations. We can derive generation rules from those 1:1 mappings.

**Q: What about selective printing (e.g., only pre-cook steps)?**
A: Structured data enables this. Implementation deferred, but the data model supports filtering by `phase`.

---

## Additional Feedback & Future Enhancements

### From Stakeholder Review (Shin)

**P2 Enhancements:**
- **P2.1 Manual override** — May need manual override for dishes that need highlighting (pre-shift demos)
- **P2.4 KDS simulation** — Would be great to simulate KDS screen in-editor (currently need to test in KDS training mode or UAT)

**Future Use Cases:**
- **Queuing / Pre-production** — The `requiresOrder` tag enables intelligent queuing. Sequencing team can identify where to pause and pre-build (everything before `requiresOrder: true` nodes). Queue breakpoint is implicit — right before the first requiresOrder node in any path.
- **Schematics generation** — Strong desire to generate schematics using Quant from Ops X. If full schematics are P3+, a component list based on Portal Layout would be beneficial
- **Time trial data integration** — Incorporate time trial study data into complexity scoring for P2 (verification or additional data points)

---

## Related Documents

- [functional-requirements-prioritized.md](functional-requirements-prioritized.md) — Detailed acceptance criteria with test methods
- [agent-mediated-line-build-spec.md](agent-mediated-line-build-spec.md) — Technical implementation spec

