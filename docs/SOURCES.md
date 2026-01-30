# Line Build Redesign — Source of Truth Matrix

This document maps requirements, specifications, and implementations across the codebase.

**Last Updated:** 2026-01-30

---

## Quick Reference

| Component | Canonical Location | Status |
|-----------|-------------------|--------|
| **PRD** | `docs/prd/PRD-FULL-v2.md` | ✅ Current |
| **Schema** | `docs/spec/SCHEMA-REFERENCE.md` + `line-build-cli/scripts/lib/schema/` | ✅ Current |
| **Validation Rules** | `line-build-cli/scripts/lib/rules.ts` + `validate/` | ⚠️ Drift from docs |
| **Complexity Scoring** | `line-build-cli/scripts/lib/complexity/` | ✅ Current |
| **CLI Commands** | `line-build-cli/scripts/lb.ts` + `commands/` | ✅ Current |
| **Viewer** | `line-build-cli/viewer/` | ✅ Current |

---

## Detailed Mappings

### 1. Product Requirements

| ID | Requirement | PRD Location | Implementation | Status |
|----|-------------|--------------|----------------|--------|
| R1 | Line build authoring workflow | PRD-FULL-v2.md §1 | `line-build-cli/` | ✅ Implemented |
| R2 | DAG-based step dependencies | PRD-FULL-v2.md §2 | `lib/flow.ts`, `lib/schema/step.ts` | ✅ Implemented |
| R3 | Validation rules (H1-H46) | PRD-FULL-v2.md §3 | `lib/validate/`, `lib/rules.ts` | ⚠️ Partially documented |
| R4 | Complexity scoring | PRD-FULL-v2.md §4 | `lib/complexity/` | ✅ Implemented |
| R5 | Material flow modeling | PRD-FULL-v2.md §5 | `lib/schema/assembly.ts` | ✅ Implemented |
| R6 | HDR configuration | PRD-FULL-v2.md §6 | `config/hdr-pod.mock.ts`, `viewer/src/app/hdr/` | ✅ Implemented |

### 2. Schema Types

| Concept | Spec Document | TypeScript Schema | Status |
|---------|---------------|-------------------|--------|
| BenchTopLineBuild | SCHEMA-REFERENCE.md §3 | `lib/schema/build.ts` | ✅ Synced |
| Step | SCHEMA-REFERENCE.md §4 | `lib/schema/step.ts` | ✅ Synced |
| Assembly (was Component) | SCHEMA-REFERENCE.md §5 | `lib/schema/assembly.ts` | ⚠️ Terminology drift* |
| ActionFamily | SCHEMA-REFERENCE.md §6 | `lib/schema/enums.ts` | ✅ Synced |
| Station/Sublocation | SCHEMA-REFERENCE.md §7 | `config/stations.config.ts` | ✅ Synced |

*Note: Docs say "Component", code says "Assembly". This is post-PRD terminology change.

### 3. Validation Rules

#### Hard Rules (Publish-Blocking)

| Rule | Description | Documented | Implemented | Notes |
|------|-------------|------------|-------------|-------|
| H1 | Valid action.family | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H2 | Unique orderIndex | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H3 | Time validity | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H4 | Containers not targets | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H5 | Notes always allowed | ✅ HARD-RULES.md | ❌ N/A | Convention, not validation |
| H6 | Published builds have steps | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H7 | Unique step IDs | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H8 | dependsOn refs exist | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H9 | No cycles | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H10 | Quantity > 0 | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H11 | Overlay priority numeric | ✅ HARD-RULES.md | ❌ **Missing** | Needs implementation |
| H12 | Unique optionIds | ✅ HARD-RULES.md | ❌ **Missing** | Needs implementation |
| H13 | Override reasons required | ✅ HARD-RULES.md | ❌ **Missing** | Needs implementation |
| H14 | Overlay predicates not empty | ✅ HARD-RULES.md | ❌ **Missing** | Needs implementation |
| H15 | HEAT requires equipment | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H16 | PACKAGING requires container | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H17 | Pre-service needs storageLocation | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H18 | Bulk prep requires pre-service | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H19 | Condition valueIds valid | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H20 | Overlay valueIds valid | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H21 | MANDATORY_CHOICE cardinality | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H22 | HEAT needs time or notes | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H23 | (reserved) | ❌ | ❌ | - |
| H24 | PORTION needs quantity or notes | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H25 | PREP needs technique or notes | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H26 | Graph connectivity | ✅ INVARIANTS.md | ✅ soft-rules.ts | Strong warning |
| H27 | TRANSFER/place needs `to` | ⚠️ DEPRECATED | ❌ | Removed - steps don't have from/to |
| H28 | TRANSFER/retrieve needs `from` | ⚠️ DEPRECATED | ❌ | Removed - steps don't have from/to |
| H29 | Merge roles defined | ✅ INVARIANTS.md | ✅ soft-rules.ts | Strong warning |
| H30 | Lineage for 1:1 transforms | ✅ INVARIANTS.md | ✅ soft-rules.ts | Strong warning |
| H31 | Component locations | ✅ INVARIANTS.md | ✅ soft-rules.ts | Strong warning |
| H32 | Sublocation valid for station | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H33 | TechniqueId in vocabulary | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H34 | Inter-station needs TRANSFER | ✅ INVARIANTS.md | ✅ composition-rules.ts | - |
| H35 | Equipment/station compatibility | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H36 | Equipment/technique compatibility | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H37 | Equipment/family compatibility | ✅ HARD-RULES.md | ✅ hard-rules-advanced.ts | - |
| H38 | TRANSFER derived-only | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H39 | Steps have from/to | ⚠️ DEPRECATED | ❌ | Schema changed - now on AssemblyRef |
| H40 | Assembly refs have locations | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H41 | Steps have material flow | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H42 | Steps have outputs | ✅ HARD-RULES.md | ✅ hard-rules.ts | - |
| H43 | No orphan assemblies | ❌ **Missing docs** | ✅ hard-rules.ts | Needs documentation |
| H44 | Single primary output | ❌ **Missing docs** | ✅ hard-rules.ts | Needs documentation |
| H46 | Valid technique vocabulary | ❌ **Missing docs** | ✅ hard-rules.ts | Needs documentation |

**Summary:** 46 total hard rules
- ✅ Documented & Implemented: 35
- ⚠️ Documented but not implemented: 3 (H11, H12, H13, H14)
- ❌ Implemented but not documented: 3 (H43, H44, H46)
- ⚠️ Deprecated in docs: 2 (H27, H28, H39)

#### Composition Rules

| Rule | Description | Documented | Implemented |
|------|-------------|------------|-------------|
| C1 | requiresBuilds integrity | ✅ INVARIANTS.md | ✅ composition-rules.ts |
| C2 | External refs declared | ✅ INVARIANTS.md | ✅ composition-rules.ts |
| C3 | In-build refs resolve | ✅ INVARIANTS.md | ✅ composition-rules.ts |

#### Soft Rules (Warnings)

| Rule | Description | Documented | Implemented |
|------|-------------|------------|-------------|
| S6 | primaryOutputAssemblyId | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S15 | Assembly sublocation | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S16a | Grouping consistency | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S16b | Station bouncing | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S17 | Derived field review | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S18 | Group timing review | ✅ INVARIANTS.md | ✅ soft-rules.ts |
| S20 | Technique vocabulary | ❌ **Missing** | ✅ soft-rules.ts |
| S21 | Quantity units | ❌ **Missing** | ✅ soft-rules.ts |
| S22 | Container usage | ❌ **Missing** | ✅ soft-rules.ts |
| S23 | Passive time warnings | ❌ **Missing** | ✅ soft-rules.ts |
| S45 | (unknown) | ❌ **Missing** | ✅ soft-rules.ts |

### 4. Complexity Scoring

| Component | Spec | Implementation | Status |
|-----------|------|----------------|--------|
| Feature extraction | COMPLEXITY-SCORING-IMPLEMENTATION-PLAN.md | `lib/complexity/features.ts` | ✅ Synced |
| Score calculation | COMPLEXITY-SCORING-IMPLEMENTATION-PLAN.md | `lib/complexity/scoring.ts` | ✅ Synced |
| Config-driven weights | COMPLEXITY-SCORING-IMPLEMENTATION-PLAN.md | `config/complexity.config.ts` | ✅ Synced |
| HDR-aware scoring | COMPLEXITY-SCORING-IMPLEMENTATION-PLAN.md | `lib/complexity/mapping.ts` | ✅ Synced |
| Portfolio scoring | COMPLEXITY-SCORING-IMPLEMENTATION-PLAN.md | `commands/score-portfolio.ts` | ✅ Synced |
| Impact preview | UX specs | `commands/score-preview.ts` | ✅ Synced |

### 5. CLI Commands

| Command | Purpose | Entry Point | Status |
|---------|---------|-------------|--------|
| `list` | List builds | `commands/list.ts` | ✅ Active |
| `get` | Read build | `commands/get.ts` | ✅ Active |
| `write` | Create/replace build | `commands/write.ts` | ✅ Active |
| `edit` | Incremental edits | `commands/edit.ts` | ✅ Active |
| `validate` | Run validation | `commands/validate.ts` | ✅ Active |
| `search` | Search steps | `commands/search.ts` | ✅ Active |
| `rules` | Show rule catalog | `commands/rules.ts` | ✅ Active |
| `techniques` | List techniques | `commands/techniques.ts` | ✅ Active |
| `view` | Control viewer | `commands/view.ts` | ✅ Active |
| `score` | Complexity score | `commands/score.ts` | ✅ Active |
| `score-preview` | Impact preview | `commands/score-preview.ts` | ✅ Active |
| `score-portfolio` | Portfolio analysis | `commands/score-portfolio.ts` | ✅ Active |
| `watch` | Watch for changes | `commands/watch.ts` | ✅ Active |
| `diff` | Compare builds | `commands/diff.ts` | ✅ Active |
| `help` | Show help | `commands/help.ts` | ✅ Active |

---

## Known Drift & Action Items

### High Priority
1. **H11-H14**: Documented but not implemented (overlay validation)
2. **H43, H44, H46**: Implemented but not documented
3. **S20-S23, S45**: Soft rules need documentation

### Medium Priority
4. **Terminology**: Docs say "Component", code says "Assembly" - align on one term
5. **Deprecated rules**: H27, H28, H39 marked deprecated but still referenced in some old docs

### Low Priority
6. **INVARIANTS.md** vs **HARD-RULES.md**: Some overlap, could consolidate

---

## How to Update This Matrix

When adding new rules:
1. Add to appropriate validation file in `line-build-cli/scripts/lib/validate/`
2. Add entry to `line-build-cli/scripts/lib/rules.ts` catalog
3. Update this matrix with ruleId, description, and locations
4. Update `docs/spec/HARD-RULES.md` or `docs/spec/INVARIANTS.md`

When adding new features:
1. Update PRD in `docs/prd/PRD-FULL-v2.md`
2. Update schema in `line-build-cli/scripts/lib/schema/`
3. Add to this matrix under appropriate section
