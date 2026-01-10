# Handoff: Chat-Based MVP for Schema Validation

> **Purpose:** Enable another agent to build a chat-based MVP that validates the data model's granularity and extensibility  
> **Created:** 2026-01-08  
> **Status:** Ready for handoff

---

## 🎯 Goal

Build a **chat-based MVP** that validates:

1. **Granularity** — Can the schema capture all necessary detail from natural language?
2. **Extensibility** — Are extension points properly designed for future use cases?

**Success criteria:**
- Chef can describe a line build in natural language
- System extracts structured data matching the schema
- Output validates against schema invariants
- Extension points (overlays, conditions, dependencies) can be demonstrated

---

## 📚 Required Reading (Priority Order)

### 1. Start Here: Business Context
**Read first** to understand the problem and goals:

- **`docs/PRD-FULL.md`** — Complete product requirements
  - Problem statement (why we're doing this)
  - Goals and hypotheses
  - DAG approach rationale
  - Functional requirements (P1.1-P1.9)
  - Success metrics

- **`docs/schema/PRD-BUSINESS.md`** — Business-friendly schema overview
  - What we're capturing and why
  - Action types explained
  - Complexity scoring use cases

### 2. Schema Definition: Technical Specs
**Read second** to understand the data model:

- **`docs/schema/SPEC-TECHNICAL.md`** — Complete technical specification
  - Core types (`BenchTopLineBuild`, `Step`, `StepAction`, etc.)
  - Field definitions and requirements
  - Schema invariants (hard/strong/soft)
  - Validation rules
  - Complexity scoring derivation

- **`docs/schema/INVARIANTS.md`** — Validation contract
  - Hard invariants (must pass)
  - Strong invariants (should pass)
  - Soft invariants (nice to have)
  - Validation implementation examples

- **`docs/schema/EXTENSION-POINTS.md`** — Extensibility design
  - Equipment-based filtering (`conditions`)
  - Conditional overrides (`overlays`)
  - Dependency graph (`dependsOn`)
  - BOM usage references
  - Provenance tracking

### 3. Reference Implementation: Types & Mock Data
**Read third** for concrete examples:

- **`docs/schema/types-benchtop.ts`** — TypeScript type definitions
  - Extracted from previous MVP
  - Core domain types preserved
  - Use as reference for schema structure

- **`data/mock/mockBom.ts`** — Real menu item data
  - Concepts (Alanza, Bankside, Bellies, Limesalt)
  - Menu items (80* items) with BOM references
  - Ingredients (40*, 88*, 90* items)
  - Recipes (BOM linkages)

- **`data/mock/fixtures.ts`** — Sample line builds
  - Grilled Chicken Bowl (complete example)
  - Fish Tacos (draft example)
  - Buddha Bowl (parallel prep example)
  - Simple Sandwich (minimal example)

- **`data/mock/equipmentProfiles.ts`** — Kitchen scenarios
  - Equipment profiles (Waterbath, Turbo, Full Service, Satellite)
  - Customization values
  - Sample scenarios

### 4. Context: Analysis & Research
**Read as needed** for deeper understanding:

- **`docs/analysis/analysis-current-state-v1.md`** — Current state analysis
- **`docs/analysis/analysis-poc-context-v1.md`** — POC context
- **`docs/research/`** — Research documents

---

## 🏗️ What to Build

### MVP Scope: Chat-Based Authoring

**Core Flow:**
1. User describes a line build in natural language (chat)
2. System extracts structured data using AI
3. System validates against schema invariants
4. System displays structured output + validation status
5. User can refine via chat or direct edits

**Key Features:**
- ✅ Natural language → structured extraction
- ✅ Schema validation (hard/strong invariants)
- ✅ Display structured output
- ✅ Demonstrate extension points (overlays, conditions)

**Out of Scope (for this MVP):**
- ❌ Visual DAG/Gantt view
- ❌ Full authoring UI (forms, drag-drop)
- ❌ Persistence/storage
- ❌ Complexity scoring calculation
- ❌ Migration from legacy data

---

## 📋 Schema Requirements Summary

### Core Entities

**`BenchTopLineBuild`** — Root container
- `id`, `menuItemId`, `version`, `status`
- `steps: Step[]` (required)
- Optional: `operations`, `tracks`

**`Step`** — Primitive work unit
- **Required:** `id`, `orderIndex`, `action.family`
- **Strongly recommended:** `target` (for component steps), `equipment` (for HEAT steps)
- **Optional:** `time`, `cookingPhase`, `container`, `stationId`, `toolId`, `notes`
- **Extension points:** `conditions`, `overlays`, `dependsOn`, `provenance`

**`StepAction`** — What we're doing
- `family`: `PREP` | `HEAT` | `TRANSFER` | `COMBINE` | `ASSEMBLE` | `PORTION` | `CHECK` | `VEND` | `OTHER`
- Optional: `detailId`, `displayTextOverride`

**`StepTarget`** — What we're acting on
- `type`: `bom_usage` | `bom_component` | `packaging` | `free_text` | `unknown`
- `bomUsageId?`, `bomComponentId?`, `name?`

### Hard Invariants (Must Pass)

1. **H1:** Every step has `action.family`
2. **H2:** `orderIndex` is unique within scope
3. **H3:** If `time` exists, `durationSeconds > 0` and `isActive` is boolean
4. **H4:** Containers are not targets (use `container` field, not `target`)
5. **H5:** `notes` escape hatch always allowed

### Strong Invariants (Should Pass)

1. **S1:** Component steps should have `target`
2. **S2:** HEAT steps should have `equipment`
3. **S3:** VEND steps should reference container/packaging
4. **S4:** Phase markers in notes should match `cookingPhase`
5. **S5:** Negation patterns should use `exclude` flag

---

## 🎨 Extension Points to Demonstrate

### 1. Equipment-Based Filtering (`conditions`)

**Example use case:**
- Step applies only to kitchens with waterbath
- Step applies only to kitchens with turbo
- Different steps for different equipment profiles

**Schema:**
```typescript
step.conditions = {
  requiresEquipmentProfile?: string[];
  requiresCustomizationOption?: string[];
  requiresRestaurantId?: string[];
}
```

**Demo:** Show how a line build can have conditional steps that filter based on equipment.

### 2. Conditional Overrides (`overlays`)

**Example use case:**
- Base step: "Heat chicken 5 min"
- Overlay for turbo kitchen: "Heat chicken 3 min" (faster)
- Overlay for waterbath kitchen: "Heat chicken 5 min" (same)

**Schema:**
```typescript
step.overlays = [{
  id: string;
  predicate: {
    equipmentProfileId?: string;
    customizationValueIds?: string[];
  };
  overrides: Partial<Step>;
  priority: number;
}]
```

**Demo:** Show how overlays modify step fields based on context.

### 3. Dependency Graph (`dependsOn`)

**Example use case:**
- Step A: "Prep chicken"
- Step B: "Prep sauce" (parallel)
- Step C: "Assemble" (depends on A and B)

**Schema:**
```typescript
step.dependsOn?: StepId[];
```

**Demo:** Show how dependencies enable parallel cooking patterns.

---

## 🧪 Test Cases

### Test Case 1: Simple Sequential Build
**Input:**
```
"Open chicken pouch, heat in waterbath for 5 minutes, transfer to bowl, add sauce"
```

**Expected output:**
- 4 steps with proper `action.family`
- Step 2 has `equipment: { applianceId: "waterbath" }`
- Step 2 has `time: { durationSeconds: 300, isActive: false }`
- Step 2 has `cookingPhase: "COOK"`
- All steps pass hard invariants

### Test Case 2: Parallel Prep
**Input:**
```
"Prep chicken and prep sauce in parallel, then assemble together"
```

**Expected output:**
- 3 steps
- Steps 1 and 2 have no dependencies (parallel)
- Step 3 has `dependsOn: [step1.id, step2.id]`
- Demonstrates DAG capability

### Test Case 3: Equipment Variants
**Input:**
```
"Base: Heat chicken 5 min in waterbath. Variant: If turbo kitchen, heat 3 min instead"
```

**Expected output:**
- 1 step with base time
- 1 overlay with predicate `equipmentProfileId: "profile_turbo"`
- Override modifies `time.durationSeconds`
- Demonstrates overlay capability

### Test Case 4: Complex Build (Real Menu Item)
**Use:** `data/mock/fixtures.ts` → `FIXTURE_GRILLED_CHICKEN_BOWL`

**Input:** Natural language description of the grilled chicken bowl

**Expected output:**
- Matches the structured fixture
- All hard invariants pass
- Most strong invariants pass
- Demonstrates full schema coverage

---

## 🛠️ Implementation Guidance

### Tech Stack Recommendations

- **Language:** TypeScript (schema types already defined)
- **AI/LLM:** Use Gemini or similar for extraction
- **Validation:** Implement invariant checks from `INVARIANTS.md`
- **UI:** Simple chat interface + structured output display

### Key Functions to Implement

1. **`extractStructuredData(naturalLanguage: string): BenchTopLineBuild`**
   - Use LLM to parse natural language
   - Map to schema types
   - Return structured build

2. **`validateBuild(build: BenchTopLineBuild): ValidationResult`**
   - Check hard invariants (H1-H5)
   - Check strong invariants (S1-S5)
   - Return errors/warnings

3. **`resolveOverlays(build: BenchTopLineBuild, context: ScenarioContext): ResolvedBuild`**
   - Apply overlays based on equipment profile
   - Return resolved build with provenance

4. **`displayStructuredOutput(build: BenchTopLineBuild): string`**
   - Format structured data for display
   - Show validation status
   - Highlight missing fields

### Validation Implementation

See `docs/schema/INVARIANTS.md` for validation code examples. Key validators:

- `validateH1(step)` — Action family required
- `validateH2(build)` — Order index unique
- `validateH3(step)` — Time fields consistent
- `validateH4(step)` — Containers not targets
- `validateS1(step)` — Component steps have target
- `validateS2(step)` — HEAT steps have equipment

---

## 📊 Success Metrics

**Schema Validation:**
- ✅ Can extract structured data from natural language
- ✅ Hard invariants pass 100% of the time
- ✅ Strong invariants pass >90% of the time
- ✅ Extension points can be demonstrated

**Granularity Validation:**
- ✅ All action types can be captured
- ✅ Equipment, time, phase can be extracted
- ✅ Targets can be linked to BOM items
- ✅ Containers can be distinguished from targets

**Extensibility Validation:**
- ✅ Overlays can modify step fields
- ✅ Conditions can filter steps
- ✅ Dependencies can model parallel cooking
- ✅ Schema doesn't block future use cases

---

## 🚫 Constraints & Non-Goals

**Do NOT:**
- Build a full authoring UI (forms, drag-drop, etc.)
- Implement persistence/storage
- Build complexity scoring calculator
- Migrate legacy data
- Integrate with production systems

**DO:**
- Focus on chat → structured extraction
- Validate against schema invariants
- Demonstrate extension points
- Show granularity coverage
- Prove extensibility design

---

## 📁 File Structure Recommendation

```
chat-mvp/
├── src/
│   ├── schema/
│   │   └── types.ts              # Import from docs/schema/types-benchtop.ts
│   ├── extraction/
│   │   ├── extractor.ts          # LLM extraction logic
│   │   └── prompts.ts            # Extraction prompts
│   ├── validation/
│   │   ├── invariants.ts         # Hard/strong invariant checks
│   │   └── validator.ts          # Validation orchestrator
│   ├── resolution/
│   │   └── overlays.ts           # Overlay resolution logic
│   ├── ui/
│   │   ├── ChatInterface.tsx     # Chat UI component
│   │   └── StructuredOutput.tsx # Display component
│   └── app.tsx                   # Main app
├── data/
│   └── mock/                     # Reference data/mock/
└── README.md
```

---

## 🔗 Key References

- **Schema Types:** `docs/schema/types-benchtop.ts`
- **Mock Data:** `data/mock/`
- **Validation Rules:** `docs/schema/INVARIANTS.md`
- **Extension Points:** `docs/schema/EXTENSION-POINTS.md`
- **Technical Spec:** `docs/schema/SPEC-TECHNICAL.md`
- **Business Context:** `docs/PRD-FULL.md`

---

## ❓ Questions to Answer

After building the MVP, document answers to:

1. **Granularity:**
   - Can we capture all necessary detail from natural language?
   - Are there gaps in the schema?
   - Do any fields need to be required vs optional?

2. **Extensibility:**
   - Do extension points work as designed?
   - Can we demonstrate overlays, conditions, dependencies?
   - Are there missing extension points?

3. **Validation:**
   - Do invariants catch real errors?
   - Are any invariants too strict or too loose?
   - Do validation rules need adjustment?

4. **AI Extraction:**
   - What extraction accuracy can we achieve?
   - What fields are hardest to extract?
   - What prompts work best?

---

## 🎯 Next Steps After MVP

Once schema is validated:

1. **Stakeholder Review** — Show MVP to Shin, Jen, Michelle
2. **Schema Finalization** — Lock schema based on learnings
3. **Full Authoring Tool** — Build complete UI with DAG view
4. **Migration** — Migrate legacy data to new schema
5. **Integration** — Connect to complexity scoring, KDS, etc.

---

**Good luck! The schema is well-documented. Focus on proving it works. 🚀**
