---
type: validation
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
tags: [validation, stakeholders, derivability]
---

# Derivability Matrix

## Purpose

This document validates that each stakeholder can derive what they need from the schema. For each stakeholder need:

1. Define the question they need to answer
2. Show the schema query that answers it
3. Track validation status

**Sign-off criteria:** Stakeholder confirms "I can derive my outputs from this schema."

---

## Jen West (Ops Director)

### Primary Focus: Complexity Scoring & Menu Optimization

| ID | Question | Schema Query | Fields Required | Status |
|----|----------|--------------|-----------------|--------|
| J1 | What is the total complexity score? | Weighted sum over steps (see scoring algorithm) | `action.family`, `equipment`, `time`, `orderIndex` | 🔲 Pending |
| J2 | What is the hot/cold ratio? | `SUM(hot_steps) / SUM(all_steps)` | `equipment.applianceId` → station classification | 🔲 Pending |
| J3 | How many short appliance steps? | `COUNT(steps WHERE equipment AND time.durationSeconds < 45)` | `equipment`, `time.durationSeconds` | 🔲 Pending |
| J4 | How many cold-to-hot rotations? | Sequence analysis: count transitions from cold to hot station | `orderIndex`, `equipment`, `cookingPhase` | 🔲 Pending |
| J5 | Any back-to-back turbo steps? | `COUNT(consecutive steps WHERE equipment.applianceId = 'turbo')` | `orderIndex`, `equipment.applianceId` | 🔲 Pending |
| J6 | What is equipment variety? | `COUNT(DISTINCT equipment.applianceId)` | `equipment.applianceId` | 🔲 Pending |
| J7 | Total cook time? | `SUM(time.durationSeconds WHERE action.family = 'HEAT')` | `time.durationSeconds`, `action.family` | 🔲 Pending |
| J8 | Active vs passive time split? | `SUM(time.durationSeconds) GROUP BY time.isActive` | `time.durationSeconds`, `time.isActive` | 🔲 Pending |
| J9 | Packaging complexity? | `COUNT(steps WHERE container OR action.family = 'VEND')` | `container`, `action.family` | 🔲 Pending |

### Scoring Algorithm (Draft)

```typescript
interface ComplexityScore {
  total: number;
  hotTotal: number;
  coldTotal: number;
  hotRatio: number;
  factors: {
    stepCount: number;
    equipmentVariety: number;
    shortApplianceSteps: number;
    coldToHotRotations: number;
    backToBackTurbo: number;
    totalCookTime: number;
    packagingSteps: number;
  };
}

function computeComplexity(build: BenchTopLineBuild): ComplexityScore {
  const steps = build.steps;
  
  // Factor weights (to be aligned with Confluence methodology)
  const WEIGHTS = {
    shortApplianceStep: 100,
    coldToHotRotation: 100,
    backToBackTurbo: 100,
    cookTime: 0.01,
    stepCount: 1,
    equipmentVariety: 1,
  };
  
  // Classify stations
  const HOT_APPLIANCES = ['turbo', 'fryer', 'waterbath', 'salamander', 'panini_press', 'clamshell', 'toaster'];
  const isHotStep = (s: Step) => s.equipment && HOT_APPLIANCES.includes(s.equipment.applianceId);
  
  // Compute factors
  const stepCount = steps.length;
  const equipmentVariety = new Set(steps.filter(s => s.equipment).map(s => s.equipment!.applianceId)).size;
  
  const shortApplianceSteps = steps.filter(s => 
    s.equipment && s.time && s.time.durationSeconds < 45
  ).length;
  
  // Cold-to-hot rotation detection
  let coldToHotRotations = 0;
  let lastWasHot = false;
  for (const step of steps.sort((a, b) => a.orderIndex - b.orderIndex)) {
    const currentIsHot = isHotStep(step);
    if (currentIsHot && !lastWasHot && step.orderIndex > 1) {
      coldToHotRotations++;
    }
    lastWasHot = currentIsHot;
  }
  
  // Back-to-back turbo
  let backToBackTurbo = 0;
  let lastWasTurbo = false;
  for (const step of steps.sort((a, b) => a.orderIndex - b.orderIndex)) {
    const isTurbo = step.equipment?.applianceId === 'turbo';
    if (isTurbo && lastWasTurbo) {
      backToBackTurbo++;
    }
    lastWasTurbo = isTurbo;
  }
  
  const totalCookTime = steps
    .filter(s => s.action.family === 'HEAT' && s.time)
    .reduce((sum, s) => sum + s.time!.durationSeconds, 0);
  
  const packagingSteps = steps.filter(s => 
    s.container || s.action.family === 'VEND'
  ).length;
  
  // Compute totals
  const hotSteps = steps.filter(isHotStep);
  const coldSteps = steps.filter(s => !isHotStep(s));
  
  const hotTotal = hotSteps.length; // Simplified; real formula uses weights
  const coldTotal = coldSteps.length;
  const total = hotTotal + coldTotal;
  const hotRatio = total > 0 ? hotTotal / total : 0;
  
  return {
    total,
    hotTotal,
    coldTotal,
    hotRatio,
    factors: {
      stepCount,
      equipmentVariety,
      shortApplianceSteps,
      coldToHotRotations,
      backToBackTurbo,
      totalCookTime,
      packagingSteps,
    },
  };
}
```

### Validation Checklist

- [ ] J1-J9 queries executable against schema
- [ ] Scoring algorithm produces results for golden set
- [ ] Results compared against spreadsheet methodology
- [ ] Jen confirms: "Scores match my expectations"

---

## Shin Izumi (CE Lead)

### Primary Focus: Authoring & Data Quality

| ID | Question | Schema Query | Fields Required | Status |
|----|----------|--------------|-----------------|--------|
| S1 | What action is this step? | `step.action.family` + `step.action.detailId` | `action` | 🔲 Pending |
| S2 | What ingredient is used? | `step.target.name` or `step.target.bomComponentId` | `target` | 🔲 Pending |
| S3 | What tool is needed? | `step.toolId` | `toolId` | 🔲 Pending |
| S4 | What station does this happen at? | `step.stationId` | `stationId` | 🔲 Pending |
| S5 | Is this a negation step? | `step.exclude === true` | `exclude` | 🔲 Pending |
| S6 | What phase is this? | `step.cookingPhase` | `cookingPhase` | 🔲 Pending |
| S7 | What container is used? | `step.container.name` | `container` | 🔲 Pending |
| S8 | Where did this data come from? | `step.provenance[field].type` | `provenance` | 🔲 Pending |
| S9 | Which steps need review? | `steps WHERE provenance.*.confidence = 'low'` | `provenance` | 🔲 Pending |
| S10 | Find all steps using X ingredient | `steps WHERE target.name LIKE '%X%'` | `target.name` | 🔲 Pending |
| S11 | Find all steps using X tool | `steps WHERE toolId = 'X'` | `toolId` | 🔲 Pending |
| S12 | What archetype is this item? | Derived from `equipment` + `action.family` distribution | `equipment`, `action.family` | 🔲 Pending |

### Bulk Edit Queries

| Operation | Query Pattern | Fields Required |
|-----------|---------------|-----------------|
| Find all steps with ingredient X | `steps WHERE target.name LIKE '%X%'` | `target.name` |
| Replace tool A with tool B | `UPDATE steps SET toolId = 'B' WHERE toolId = 'A'` | `toolId` |
| Find all turbo steps | `steps WHERE equipment.applianceId = 'turbo'` | `equipment.applianceId` |
| Find all POST_COOK steps | `steps WHERE cookingPhase = 'POST_COOK'` | `cookingPhase` |
| Find all negation steps | `steps WHERE exclude = true` | `exclude` |

### Validation Rules (Deterministic Checks)

| Rule | Query | Fields Required |
|------|-------|-----------------|
| Turbo step needs cooking vessel | `steps WHERE equipment.applianceId = 'turbo' AND container IS NULL` | `equipment`, `container` |
| HEAT step needs equipment | `steps WHERE action.family = 'HEAT' AND equipment IS NULL` | `action.family`, `equipment` |
| Component step needs target | `steps WHERE kind = 'component' AND target IS NULL` | `kind`, `target` |
| Phase marker matches field | `steps WHERE notes LIKE '%POST COOK%' AND cookingPhase != 'POST_COOK'` | `notes`, `cookingPhase` |

### Validation Checklist

- [ ] S1-S12 queries executable against schema
- [ ] Bulk edit patterns work on golden set
- [ ] Validation rules catch known issues
- [ ] Shin confirms: "I can author and validate line builds with this"

---

## Michelle Schotter (KDS PM)

### Primary Focus: Sequencing & Downstream Consumption

| ID | Question | Schema Query | Fields Required | Status |
|----|----------|--------------|-----------------|--------|
| M1 | What is the step order? | `steps ORDER BY orderIndex` | `orderIndex` | 🔲 Pending |
| M2 | Which steps are on hot line? | `steps WHERE equipment.applianceId IN (hot_appliances)` | `equipment.applianceId` | 🔲 Pending |
| M3 | Which steps are on cold line? | `steps WHERE equipment IS NULL OR equipment.applianceId IN (cold_appliances)` | `equipment.applianceId` | 🔲 Pending |
| M4 | How long does each step take? | `step.time.durationSeconds` | `time.durationSeconds` | 🔲 Pending |
| M5 | Is chef actively working? | `step.time.isActive` | `time.isActive` | 🔲 Pending |
| M6 | What equipment is needed? | `DISTINCT(steps.equipment.applianceId)` | `equipment.applianceId` | 🔲 Pending |
| M7 | What appliance preset? | `step.equipment.presetId` | `equipment.presetId` | 🔲 Pending |
| M8 | Can steps run in parallel? | `steps GROUP BY trackId` (v1) or `dependsOn` (future) | `trackId`, `dependsOn` | 🔲 Pending |

### Extension Points for Future KDS Work

| Future Need | Extension Point | Current Status |
|-------------|-----------------|----------------|
| Equipment-based step filtering | `step.conditions.requiresEquipmentProfile` | Optional field, not required |
| Dependency graph | `step.dependsOn` | Optional field, not required |
| Conditional overrides | `step.overlays` | Optional field, not required |

### Validation Checklist

- [ ] M1-M8 queries executable against schema
- [ ] Extension points documented and understood
- [ ] Michelle confirms: "I can see how KDS would consume this"

---

## Training (Briana)

### Primary Focus: Technique & Tool Inventory

| ID | Question | Schema Query | Fields Required | Status |
|----|----------|--------------|-----------------|--------|
| T1 | What techniques exist? | `DISTINCT(steps.action.detailId)` | `action.detailId` | 🔲 Pending |
| T2 | What tools are used? | `DISTINCT(steps.toolId)` | `toolId` | 🔲 Pending |
| T3 | What stations are used? | `DISTINCT(steps.stationId)` | `stationId` | 🔲 Pending |
| T4 | What equipment is used? | `DISTINCT(steps.equipment.applianceId)` | `equipment.applianceId` | 🔲 Pending |

### Validation Checklist

- [ ] T1-T4 queries executable against schema
- [ ] (Informed only — no explicit sign-off required)

---

## Robot/IK Team

### Primary Focus: Machine-Readable Instructions

| ID | Question | Schema Query | Fields Required | Status |
|----|----------|--------------|-----------------|--------|
| R1 | What action to perform? | `step.action.family` + `step.action.detailId` | `action` | 🔲 Pending |
| R2 | What ingredient to pick? | `step.target.bomComponentId` or `step.target.bomUsageId` | `target` | 🔲 Pending |
| R3 | What equipment to use? | `step.equipment.applianceId` + `step.equipment.presetId` | `equipment` | 🔲 Pending |
| R4 | How long to run? | `step.time.durationSeconds` | `time.durationSeconds` | 🔲 Pending |
| R5 | What container to use? | `step.container.type` + `step.container.name` | `container` | 🔲 Pending |
| R6 | What phase is this? | `step.cookingPhase` | `cookingPhase` | 🔲 Pending |

### Validation Checklist

- [ ] R1-R6 queries executable against schema
- [ ] (Informed only — future validation when IK integration begins)

---

## Sign-off Tracker

| Stakeholder | Domain | Queries Validated | Sign-off | Date |
|-------------|--------|-------------------|----------|------|
| Jen West | Scoring (J1-J9) | 🔲 0/9 | 🔲 Pending | |
| Shin Izumi | Authoring (S1-S12) | 🔲 0/12 | 🔲 Pending | |
| Michelle Schotter | Sequencing (M1-M8) | 🔲 0/8 | 🔲 Pending | |
| Briana | Training (T1-T4) | 🔲 0/4 | (Informed) | |
| Robot Team | Automation (R1-R6) | 🔲 0/6 | (Informed) | |

---

## Validation Process

### Step 1: Query Execution
For each query in the matrix:
1. Write executable code against schema types
2. Run against golden set items
3. Verify results are meaningful

### Step 2: Stakeholder Review
For each stakeholder:
1. Present query results on 3-5 golden set items
2. Ask: "Does this answer your question?"
3. Document feedback and iterate if needed

### Step 3: Sign-off
Once all queries validated:
1. Stakeholder reviews full matrix
2. Confirms: "I can derive my outputs from this schema"
3. Sign-off recorded with date

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-31 | Initial draft | Brandon Galang |

