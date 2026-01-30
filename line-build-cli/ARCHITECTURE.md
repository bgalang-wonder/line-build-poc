# Line Build CLI Architecture

A code map for navigating the line-build-cli codebase.

## Directory Structure

```
poc/line-build-cli/
├── scripts/
│   ├── lb.ts                      # CLI entry point (thin dispatcher)
│   ├── commands/                  # Modular command handlers
│   │   ├── list.ts               # lb list - discover builds
│   │   ├── get.ts                # lb get - read build details
│   │   ├── write.ts              # lb write - create/replace builds
│   │   ├── edit.ts               # lb edit - incremental edits
│   │   ├── validate.ts           # lb validate - run validation
│   │   ├── search.ts             # lb search - find steps/notes
│   │   ├── view.ts               # lb view - control viewer selection
│   │   └── rules.ts              # lb rules - show validation rules
│   └── lib/                       # Core logic
│       ├── schema/               # Data model (Zod + types)
│       │   ├── index.ts          # Re-exports + parseBuild()
│       │   ├── enums.ts          # ActionFamily, StationId, etc.
│       │   ├── step.ts           # Step schema + related types
│       │   ├── component.ts      # Component, ComponentRef, sources
│       │   └── build.ts          # BenchTopLineBuild + overlays
│       ├── validate/             # Validation engine
│       │   ├── index.ts          # validateBuild() + orchestration
│       │   ├── helpers.ts        # Shared utilities
│       │   ├── hard-rules.ts     # H1-H18 (core structural)
│       │   ├── hard-rules-advanced.ts  # H19-H37 (station, transfer)
│       │   ├── composition-rules.ts    # C1-C3 (build composition)
│       │   └── soft-rules.ts     # S6-S19 (warnings)
│       ├── schema.ts             # Re-export from schema/
│       ├── validate.ts           # Re-export from validate/
│       ├── store.ts              # File-based build storage
│       ├── normalize.ts          # Write-time normalization
│       ├── derive.ts             # Artifact/flow derivation
│       ├── edit.ts               # Edit operation handlers
│       ├── query.ts              # Query DSL for search
│       ├── flow.ts               # DAG flow analysis
│       ├── complexity.ts         # Complexity scoring
│       ├── transfers.ts          # Transfer derivation
│       ├── rules.ts              # Rule catalog definitions
│       └── fixtures.ts           # Test fixture utilities
├── config/                        # Domain constraints
│   ├── index.ts                  # Re-exports all configs
│   ├── stations.config.ts        # Station definitions & sublocations
│   ├── tools.config.ts           # Tool categories
│   ├── techniques.config.ts      # Technique vocabulary
│   └── validation.config.ts      # Validation thresholds
├── data/                          # Persisted data
│   ├── line-builds/              # Build JSON files
│   ├── validation/               # Validation reports
│   ├── receipts/                 # Audit trail
│   ├── checklists/               # Progress tracking
│   └── fixtures/                 # Test fixtures
├── templates/                     # Agent templates
│   ├── validation-checklist.md   # Per-build checklist
│   └── rule-questions.md         # SME interview questions
├── viewer/                        # Next.js visualization app
│   └── (see viewer/README.md)
├── CLAUDE.md                      # Agent persona & instructions
├── ARCHITECTURE.md                # This file
└── README.md                      # Project overview
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AUTHORING FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

   User Input (CSV, description)
          │
          ▼
   ┌─────────────────┐
   │  Claude Code    │  Interprets, asks clarifying questions
   │  (CLAUDE.md)    │  Uses templates/validation-checklist.md
   └────────┬────────┘
            │
            ▼ lb write --stdin
   ┌─────────────────┐
   │  parseBuild()   │  Validates JSON against Zod schemas
   │  (schema/)      │  Throws BuildParseError if invalid
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ normalizeBuild()│  Auto-fills derived fields:
   │  (normalize.ts) │  - groupingId from stationId
   │                 │  - derived dependencies from flow
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ validateBuild() │  Runs all rules (H*, C*, S*)
   │  (validate/)    │  Returns errors/warnings
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │   writeBuild()  │  Persists to data/line-builds/
   │   (store.ts)    │  Creates audit receipt
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │    Viewer       │  Polls data/ every 1.5s
   │  (viewer/)      │  Renders DAG with validation overlay
   └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                           VALIDATION PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────┘

   BenchTopLineBuild
          │
          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                        validateBuild()                                │
   │                                                                       │
   │  1. Build-level checks                                               │
   │     ├── H6: Published build has steps                                │
   │     ├── H7: Unique step IDs                                          │
   │     ├── H2: Unique orderIndex per track                              │
   │     ├── H8: Dependencies exist                                       │
   │     └── H9: No cycles                                                │
   │                                                                       │
   │  2. Per-step checks (in orderIndex order)                            │
   │     ├── H1: Valid action.family                                      │
   │     ├── H3: Time validity                                            │
   │     ├── H15: HEAT requires equipment                                 │
   │     ├── H22: HEAT requires time or notes                             │
   │     ├── H24: PORTION requires quantity or notes                      │
   │     ├── H25: PREP requires techniqueId or notes                      │
   │     ├── H27/H28: TRANSFER place/retrieve locations                   │
   │     ├── H32: Sublocation valid for station (config-driven)           │
   │     ├── H33: TechniqueId in vocabulary (config-driven)               │
   │     ├── H35-37: Equipment/station compatibility (config-driven)      │
   │     └── ...                                                           │
   │                                                                       │
   │  3. Composition checks                                                │
   │     ├── C1: requiresBuilds integrity                                 │
   │     ├── C2: External refs declared                                   │
   │     ├── C3: In-build component refs resolve                          │
   │     └── H34: Inter-station requires TRANSFER                         │
   │                                                                       │
   │  4. Warnings (strong/soft)                                           │
   │     ├── H26: Graph connectivity (>75% have dependsOn)                │
   │     ├── H29: Merge roles defined                                     │
   │     ├── H30: Lineage for 1:1 transforms                              │
   │     ├── S15: Component sublocation                                   │
   │     ├── S16a/b: Grouping/station bouncing                            │
   │     └── S17/S18: Derived field review                                │
   └──────────────────────────────────────────────────────────────────────┘
          │
          ▼
   BuildValidationResult
   {
     valid: boolean,      // true if hardErrors.length === 0
     hardErrors: [...],   // Blocking errors
     warnings: [...]      // Non-blocking warnings
   }
```

## Module Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            DEPENDENCY GRAPH                              │
└─────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────┐
                          │  lb.ts      │  CLI entry point
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ commands/│ │ commands/│ │ commands/│
             │  list    │ │  write   │ │ validate │
             └────┬─────┘ └────┬─────┘ └────┬─────┘
                  │            │            │
                  └────────────┼────────────┘
                               ▼
                    ┌─────────────────────┐
                    │       lib/          │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │   schema/     │  │  ← Zod schemas + types
                    │  └───────┬───────┘  │
                    │          │          │
                    │          ▼          │
                    │  ┌───────────────┐  │
                    │  │  validate/    │  │  ← Validation engine
                    │  └───────┬───────┘  │
                    │          │          │
                    │          ▼          │
                    │  ┌───────────────┐  │
                    │  │  normalize.ts │  │  ← Write-time transforms
                    │  │  store.ts     │  │  ← File I/O
                    │  │  query.ts     │  │  ← Search DSL
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      config/        │  ← Domain constraints
                    │                     │
                    │  stations.config.ts │
                    │  techniques.config  │
                    │  validation.config  │
                    └─────────────────────┘
```

## Schema Module Structure

```
schema/
├── enums.ts         # Scalar types and enums
│   ├── BuildId, StepId, ComponentId (type aliases)
│   ├── ActionFamily, CookingPhase (enums)
│   ├── StationId, ToolId, ApplianceId (unions)
│   └── Zod schemas for all enums
│
├── component.ts     # Material flow types
│   ├── BomEntry, Component
│   ├── ComponentSource (in_build | external_build)
│   ├── ComponentRef (with location tracking)
│   └── ComponentLineage
│
├── step.ts          # Step types
│   ├── StepAction, StepTarget, StepEquipment
│   ├── StepTime, StepContainer, StepQuantity
│   ├── StepOverlay, StepCondition, StepProvenance
│   ├── DependencyRef (simple | conditional)
│   └── Step (main interface + Zod schema)
│
├── build.ts         # Build-level types
│   ├── BuildRef, CustomizationGroup
│   ├── ValidationOverride, DerivedTransferStep
│   └── BenchTopLineBuild (main interface + Zod schema)
│
└── index.ts         # Re-exports + parseBuild()
```

## Validation Module Structure

```
validate/
├── helpers.ts       # Shared utilities
│   ├── ValidationError, BuildValidationResult types
│   ├── getOrderedSteps() - deterministic step ordering
│   ├── sortErrors() - severity → ruleId → stepOrder
│   ├── canonicalizeCyclePath() - for H9 cycle detection
│   └── CONTAINER_DETECTION_REGEX - for H4
│
├── hard-rules.ts    # H1-H18 (core structural)
│   ├── H1: action.family required
│   ├── H2: unique orderIndex per track
│   ├── H3: time.durationSeconds > 0
│   ├── H7: unique step IDs
│   ├── H8: dependsOn refs exist
│   ├── H9: no cycles
│   └── H15-H18: family-specific requirements
│
├── hard-rules-advanced.ts  # H19-H37 (station, transfer)
│   ├── H19-H21: customization validation
│   ├── H22-H25: family-specific (HEAT, PREP, PORTION)
│   ├── H27-H28: TRANSFER place/retrieve
│   └── H32-H37: config-driven station/equipment rules
│
├── composition-rules.ts    # C1-C3 (build composition)
│   ├── C1: requiresBuilds integrity
│   ├── C2: external refs declared
│   └── C3: in_build refs resolve
│
├── soft-rules.ts    # S6-S19 (warnings)
│   ├── S6: primaryOutputComponentId
│   ├── S15: component sublocation
│   ├── S16a/b: grouping/station bouncing
│   ├── H26: graph connectivity (strong)
│   ├── H29: merge roles (strong)
│   └── H30-H31: lineage, component locations (strong)
│
└── index.ts         # validateBuild() orchestration
```

## Key Patterns

### 1. Re-export Pattern
Files like `schema.ts` and `validate.ts` at the lib root are thin re-exports:
```typescript
// schema.ts
export * from "./schema/index";

// validate.ts
export * from "./validate/index";
```
This maintains backward compatibility while enabling modular organization.

### 2. Config-Driven Validation
Rules H32-H37 use config files rather than hardcoded logic:
```typescript
import { isValidSublocationForStation } from "../../../config";

// H32: Sublocation valid for station
if (!isValidSublocationForStation(stationId, sublocationId)) {
  return [{ severity: "hard", ruleId: "H32", ... }];
}
```

### 3. Deterministic Ordering
All validation uses `getOrderedSteps()` for deterministic iteration:
```typescript
function getOrderedSteps(build): Step[] {
  return [...build.steps].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    if ((a.trackId ?? "") !== (b.trackId ?? "")) return (a.trackId ?? "").localeCompare(b.trackId ?? "");
    return a.id.localeCompare(b.id);
  });
}
```

### 4. Severity Hierarchy
Errors are sorted by severity → ruleId → step order:
- `hard` (0): Blocks publication
- `strong` (1): Important warning
- `soft` (2): Minor warning

## Adding New Rules

1. **Determine severity**: hard, strong, or soft?
2. **Choose module**: based on category (structural, station, composition, warning)
3. **Add validator function**: follows pattern `validateXX(step | build): ValidationError[]`
4. **Register in index.ts**: add to appropriate section in `validateBuild()`
5. **Add tests**: in `validate.test.ts`
6. **Document**: in `rules.ts` catalog

## Adding New Schema Fields

1. **Add TypeScript interface** in appropriate schema/*.ts file
2. **Add Zod schema** in same file
3. **Update tests** if field affects validation
4. **Update CLAUDE.md** if field is user-facing
