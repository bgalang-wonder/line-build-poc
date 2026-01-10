# Quick Start: Chat MVP Handoff

> **TL;DR:** Build a chat interface that extracts structured line build data and validates it against the schema.

---

## 🎯 Goal

**Validate:** Can the schema capture necessary granularity? Is it properly extensible?

**Build:** Chat → Extract → Validate → Display

---

## 📖 Read These (In Order)

1. **`docs/PRD-FULL.md`** — Why we're doing this
2. **`docs/schema/SPEC-TECHNICAL.md`** — What the schema is
3. **`docs/schema/INVARIANTS.md`** — How to validate
4. **`docs/schema/types-benchtop.ts`** — TypeScript types
5. **`data/mock/fixtures.ts`** — Example line builds

---

## 🏗️ Core Schema

```typescript
BenchTopLineBuild {
  id, menuItemId, version, status
  steps: Step[]  // Required
}

Step {
  id, orderIndex              // Required
  action: { family }          // Required (PREP, HEAT, TRANSFER, etc.)
  target?: StepTarget         // Strongly recommended
  equipment?: StepEquipment   // If HEAT
  time?: StepTime             // If HEAT
  cookingPhase?: Phase        // Recommended
  container?: StepContainer   // If VEND
  conditions?: StepCondition  // Extension: equipment filtering
  overlays?: StepOverlay[]    // Extension: conditional overrides
  dependsOn?: StepId[]        // Extension: DAG dependencies
}
```

---

## ✅ Hard Invariants (Must Pass)

- H1: Every step has `action.family`
- H2: `orderIndex` is unique
- H3: If `time` exists, `durationSeconds > 0`
- H4: Containers use `container` field, not `target`
- H5: `notes` always allowed

---

## 🧪 Test Cases

1. **Simple:** "Open chicken, heat 5 min, add sauce"
2. **Parallel:** "Prep chicken and sauce, then assemble"
3. **Variants:** "Base: 5 min. Turbo: 3 min"
4. **Real:** Use `FIXTURE_GRILLED_CHICKEN_BOWL`

---

## 🚀 Implementation

1. **Extract:** `extractStructuredData(naturalLanguage) → BenchTopLineBuild`
2. **Validate:** `validateBuild(build) → ValidationResult`
3. **Resolve:** `resolveOverlays(build, context) → ResolvedBuild`
4. **Display:** Show structured output + validation status

---

## 📁 Key Files

- **Schema:** `docs/schema/types-benchtop.ts`
- **Validation:** `docs/schema/INVARIANTS.md`
- **Examples:** `data/mock/fixtures.ts`
- **Full Guide:** `docs/HANDOFF-CHAT-MVP.md`

---

**See `HANDOFF-CHAT-MVP.md` for complete details.**
