---
type: scope
status: active
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
---

# Line Build Schema v1 — Scope & Boundaries

## What This Project Is

**One sentence:** Define a canonical "Culinary Truth" schema for line builds that enables complexity scoring and is extensible for future routing/sequencing.

**Timeline:** Q1 2026 (Weeks 1-12)

**Owner:** Brandon Galang (I'm driving this)

---

## In Scope (v1)

| Deliverable | What It Means |
|-------------|---------------|
| Schema v1 specification | TypeScript types + field definitions |
| Invariants | Validation rules (what must be true) |
| Golden set validation | 20-50 items translated to prove it works |
| Complexity scoring proof | Algorithm that computes scores from schema |
| Extensibility documentation | How routing/sequencing plug in later |

---

## Out of Scope (v1)

| Item | Why Not |
|------|---------|
| KDS integration | KDS team not ready; bridge strategy handles this |
| Equipment-based line build selection | Upstream equipment profile data doesn't exist |
| BOM system changes | Separate initiative; schema accepts partial data |
| Production Cookbook integration | Requires eng work beyond schema definition |
| Full dependency graph / DAG | Tracks + orderIndex sufficient for v1 |
| AI-generated line builds | Future capability; schema is input-agnostic |

**If someone asks for these:** "That's out of scope for v1. I've designed the schema to support it later. Here's the extension point: [link]."

---

## Designed For, Not Implementing

These are explicitly **designed into the schema** but **not required or built in v1**:

| Capability | Extension Point | When It Activates |
|------------|-----------------|-------------------|
| Equipment-based step filtering | `step.conditions` | When equipment profiles exist |
| Conditional field overrides | `step.overlays` | When authoring UI supports it |
| Dependency graph | `step.dependsOn` | When KDS needs it |
| BOM usage references | `target.bomUsageId` | When Product Catalog ships |

**Why this matters:** I'm not blocking future work. I'm just not building it now.

---

## Success Criteria

Schema v1 is "done" when:

1. **Golden set:** ≥95% of steps represented without semantic loss
2. **Scoring:** Algorithm produces scores from schema, validated against spreadsheet
3. **Stakeholder validation:** Jen, Shin, Michelle confirm they can derive what they need
4. **Stability:** No breaking changes for 2 weeks after lock

---

## Timeline

| Phase | Weeks | What Happens |
|-------|-------|--------------|
| Setup | 1-2 | Golden set locked, schema v0 drafted |
| Iteration | 3-6 | Weekly refinement, stakeholder validation |
| Stabilize | 7-9 | Schema v1 locked, expanded validation |
| Package | 10-12 | Documentation complete, handoff ready |

---

## Key Stakeholders

| Person | What They Care About | How I'll Validate |
|--------|---------------------|-------------------|
| **Jen West** | Complexity scoring | "Can you compute scores from this?" |
| **Shin Izumi** | Authoring, data quality | "Does this match your spreadsheet?" |
| **Michelle Schotter** | Sequencing, KDS | "Does this block you?" |

---

## Scope Change Policy

If someone requests something not listed in "In Scope":

1. I acknowledge the request
2. I assess: Is this a v1 blocker or a v2 nice-to-have?
3. If v2: "Noted for future work. For v1, I'm focused on [X]."
4. If it truly blocks v1: I document the timeline impact and communicate it

**I don't silently absorb scope changes.**

---

## Related Documents

- `schema/PRD-SCHEMA-V1.md` — Full technical specification
- `schema/INVARIANTS.md` — Validation rules
- `schema/EXTENSION-POINTS.md` — Future extensibility
- `LOG.md` — Decisions and receipts

