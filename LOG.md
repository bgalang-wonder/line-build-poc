---
type: log
status: active
project: line-build-redesign
created: 2025-12-31
updated: 2026-01-30
author: Brandon Galang
---

# Project Log — Decisions & Receipts

This is my running log of decisions made and input received. It's my paper trail.

---

## How to Use This

**Decisions:** When I make a call, I log it with the reasoning.

**Receipts:** When someone agrees to something or gives input, I log it with a link to the Slack message/doc comment.

**Feedback:** When someone requests something I'm not doing, I log why.

---

## Decisions (Reverse Chronological)

### DEC-010: Repository Restructure — line-build-cli is the main codebase
**Date:** 2026-01-30  
**Decision:** Move `poc/line-build-cli/` to `line-build-cli/`; archive old apps; remove "POC" naming  
**Why:** The "POC" has become the production system. 37+ validation rules, complexity scoring, DAG viewer, 20+ builds. It's not a POC anymore.  
**Impact:** Clean separation between active code (`line-build-cli/`) and archives (`archive/`)

---

### DEC-009: Zip distribution in archive/releases/
**Date:** 2026-01-30  
**Decision:** Create `archive/releases/` for colleague distribution zips; exclude from git  
**Why:** Colleague needs easy zip distribution but zips don't belong in version control  
**Note:** Old zips (1.13-1.28) were lost during restructure; fresh zip created at `line-build-cli-2026.01.30.zip`

---

### DEC-008: Traceability Matrix as Living Document
**Date:** 2026-01-30  
**Decision:** Create `docs/SOURCES.md` mapping requirements → implementation  
**Why:** PRD is for vision, but implementation is moving fast. Need to track what's actually built vs. documented.  
**Finding:** 7 rules with drift (H11-H14 documented but not implemented; H43, H44, H46 implemented but not documented)

---

### DEC-007: Requirements Traceability — Local Docs > Confluence
**Date:** 2026-01-30  
**Decision:** `docs/prd/PRD-FULL-v2.md` and `docs/spec/` are now source of truth, not Confluence  
**Why:** Rapid iteration makes Confluence stale. Git-tracked docs allow versioned requirements evolution.  
**Previous:** DEC-001 through DEC-005 assumed Confluence was source of truth (see below, now outdated)

---

### DEC-006: Terminology — "Assembly" replaces "Component"
**Date:** 2026-01-10 → 2026-01-30  
**Decision:** Use "Assembly" instead of "Component" throughout codebase  
**Why:** "Assembly" better captures the composed/transformed nature of materials in line builds.  
**Drift Warning:** Some docs still say "Component" while code says "Assembly". Standardizing on "Assembly".

---

### DEC-005: Tracks as optional
**Date:** 2025-12-31  
**Decision:** `tracks` is optional authoring structure, not required  
**Why:** Not all items have meaningful parallel structure; orderIndex sufficient for v1  
**Status:** ✅ Implemented  
**Input:** (Pending validation with Shin)

---

### DEC-004: Defer equipment-based filtering
**Date:** 2025-12-31  
**Decision:** Include `conditions` as optional field, don't require for v1  
**Why:** Upstream equipment profile data doesn't exist; design for it, don't block on it  
**Status:** ✅ Implemented  
**Input:** (Pending confirmation with Michelle)

---

### DEC-003: Exclude flag for negation
**Date:** 2025-12-31  
**Decision:** Add `exclude?: boolean` to Step  
**Why:** 271 cases of "No X" patterns; explicit flag clearer than parsing notes  
**Status:** ✅ Implemented  
**Input:** (Pending validation with Shin)

---

### DEC-002: Cooking phase as first-class field
**Date:** 2025-12-31  
**Decision:** Add `cookingPhase` enum (PRE_COOK, COOK, POST_COOK, PASS)  
**Why:** 1,928 occurrences of phase markers; critical for cold-to-hot rotation scoring  
**Status:** ✅ Implemented  
**Input:** (Pending validation with Shin)

---

### DEC-001: Container as first-class field
**Date:** 2025-12-31  
**Decision:** Add `container` field to Step (type, name, size)  
**Why:** 5,613 occurrences in legacy data; prevents "container parsed as target" errors  
**Status:** ✅ Implemented  
**Input:** (Pending validation with Shin)

---

## Major Implementation Milestones

### 2026-01-28 — Viewer UX Polish Complete
- Dual graph layers (work order + material flow)
- Validation overlay on DAG
- Step inspector with rule violations
- Graph layer toggles
- Build health strip

### 2026-01-23 — Complexity Scoring v1
- Feature extraction from builds
- Config-driven weights
- HDR-aware mapping
- Portfolio scoring (`lb score-portfolio`)
- Impact preview (`lb score-preview`)

### 2026-01-20 — CLI Command Surface Complete
- `lb list`, `lb get`, `lb write`, `lb edit`
- `lb validate`, `lb search`, `lb rules`
- `lb score`, `lb score-preview`, `lb score-portfolio`
- `lb view`, `lb watch`
- `lb techniques` (vocabulary lookup)

### 2026-01-15 — Validation Rules H1-H46
- Hard rules: H1-H46 (46 rules)
- Composition rules: C1-C3
- Soft/strong warnings: S6, S15-S23, S45
- See `docs/SOURCES.md` for full mapping

### 2026-01-12 — Material Flow Schema
- Removed `from`/`to` from Step
- Added `AssemblyRef` with `from`/`to` locations
- Artifact flow: `step.consumes`, `step.produces`
- Build composition: `requiresBuilds`
- Primary output: `primaryOutputAssemblyId`

### 2026-01-10 — Schema MECE Updates
See DEC-006 above. Major schema refactoring for material flow.

### 2026-01-07 — PRD v2 Created
- Reset from first principles
- Focus: canonical instruction spec, not free text
- Foundation for complexity scoring and future simulation

---

## Receipts

### 2026-01-28 — Complexity scoring prototype review with Jen
**Who:** Jen (Menu Strategy)  
**What they said:** "The impact preview showing before/after scores is exactly what we need for equipment decisions"  
**Link:** (Transcript: `transcripts/2026-01-28-Complexity-scoring-prototype-review-Jen.md`)  
**Implication:** Keep impact preview as first-class feature; prioritize equipment profile integration

### 2026-01-26 — Complexity refinement with Shin
**Who:** Shin Izumi (Culinary Engineering)  
**What they said:** "The 11 stations with hot/cold/vending sides matches how I think about kitchen layout"  
**Link:** (Transcript: `transcripts/2026-01-26-Complexity-refinement-Shin.md`)  
**Implication:** Station model validated; HDR configs can be hardcoded for MVP

### 2026-01-23 — Transfer complexity modeling
**Who:** Charlie (Engineering)  
**What they said:** "We need to distinguish between derived transfers and authored transfers"  
**Link:** (Transcript: `transcripts/2026-01-23-transfer-complexity-pt1.md`, `pt2.md`)  
**Implication:** Created H38 (TRANSFER steps are derived-only); removed from/to from steps

---

## Feedback (Input I'm Not Acting On)

### FB-003: Add dependency graph for parallel cooking
**From:** Michelle Schotter  
**Date:** 2025-12-31 (carried forward)  
**Request:** "For sequencing, we'd need to know which steps can run in parallel"  
**Disposition:** Still deferred to v2  
**Why:** `dependsOn` is in schema and growing (now >25% of steps have dependencies), but full parallel scheduling requires more chef input than we can gather in current scope

### FB-002: Require BOM reference for all component steps
**From:** (Hypothetical eng feedback)  
**Date:** 2025-12-31  
**Request:** "Shouldn't we require bomUsageId for all component steps?"  
**Disposition:** Declined for v1  
**Why:** Legacy data has only 10.6% structured references; would block adoption

---

## Architecture Decisions (ADRs)

### ADR-001: Local docs over Confluence
**Context:** Rapid iteration made Confluence PRD stale  
**Decision:** Git-tracked docs (`docs/prd/`, `docs/spec/`) are source of truth  
**Consequences:** 
- ✅ Versioned requirements
- ✅ PR-based review of spec changes
- ❌ Non-engineers need GitHub access to read specs

### ADR-002: File-based over database
**Context:** POC needs simplicity, auditability  
**Decision:** Line builds as JSON files in `data/line-builds/`  
**Consequences:**
- ✅ Git history of all changes
- ✅ Easy to inspect, debug
- ❌ No concurrent editing
- ❌ Querying requires loading all files

### ADR-003: Derived transfers (not authored)
**Context:** H38 rule creation  
**Decision:** TRANSFER steps are derived from material flow, never authored directly  
**Consequences:**
- ✅ Simpler authoring mental model
- ✅ Consistent transfer representation
- ❌ Less flexibility for edge cases

---

## Open Questions

1. **Should H11-H14 be implemented?** (overlay validation) — Documented but never implemented
2. **Should H43, H44, H46 be documented?** — Implemented but not in HARD-RULES.md
3. **Is `Step.kind` still needed?** — Marked as UX hint but may be removable
4. **Equipment profile data** — When does this arrive? Blocks advanced validation (H35-H37 full implementation)
5. **Simulation/scoping** — Still v2? When do we start designing?

---

## Weekly Status

| Week | Date | Focus | Status |
|------|------|-------|--------|
| 4 | 2026-01-27 | Repository cleanup, docs audit | 🟢 Done |
| 3 | 2026-01-20 | Complexity scoring, viewer polish | 🟢 Done |
| 2 | 2026-01-13 | Material flow schema, validation rules | 🟢 Done |
| 1 | 2026-01-06 | PRD v2, schema refactoring | 🟢 Done |
