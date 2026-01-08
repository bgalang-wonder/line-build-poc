---
type: notes
status: reference
project: line-build-redesign
created: 2025-12-31
author: Brandon Galang
tags: [planning, q1-2026, schema, governance]
---

# Planning Session Notes — 2025-12-31

## What We Discussed

This session covered Q1 2026 planning for the line build schema project. Key topics:

1. **Project framing** — Schema-first approach ("the schema IS the product")
2. **Scope definition** — What's in, out, and designed-for-but-not-implementing
3. **Schema invariants** — Hard/strong/soft rules for validation
4. **Governance approach** — Lightweight "receipts not sign-offs" model
5. **Communication strategy** — Proactive visibility to avoid being blamed

---

## Key Decisions Made

### 1. Schema-First Approach
The schema is the product. If we get the data model right:
- Apps are just view layers (can build fast with AI tools)
- Scoring is just a query over structured data
- Future routing/sequencing plugs in without breaking changes

### 2. "Culinary Truth" Focus
The schema captures **what actually happens to make a dish**, not operational policy (routing, assignment). This separation means:
- We don't block on upstream systems (equipment profiles, BOM)
- We design extension points for future needs
- LLM bridge can translate to legacy format for current systems

### 3. Lightweight Governance
Rejected formal RACI/sign-off ceremonies in favor of:
- **Receipts** — Slack messages confirming agreement
- **Scope doc** — My reference for what's in/out
- **Decision log** — My audit trail
- **Weekly posts** — Proactive visibility

### 4. Schema Additions (from translation analysis)
Based on the 64,909 row translation analysis, these fields were promoted:
- `container` (5,613 occurrences) — Prevents "container as target" errors
- `cookingPhase` (1,928 occurrences) — Enables cold-to-hot rotation scoring
- `exclude` (271 occurrences) — Handles "No X" negation patterns

### 5. Extension Points (designed for, not implementing)
- `conditions` — Equipment-based step filtering
- `overlays` — Conditional field overrides
- `dependsOn` — Dependency graph for parallel cooking
- `provenance` — Data quality tracking

---

## Documents Created

### Governance (Lightweight)
| File | Purpose |
|------|---------|
| `SCOPE.md` | What's in/out, success criteria, timeline |
| `LOG.md` | Decisions, receipts, feedback tracking |
| `comms/SLACK-TEMPLATES.md` | Copy-paste templates for communication |

### Schema (Technical)
| File | Purpose |
|------|---------|
| `schema/PRD-SCHEMA-V1.md` | Full technical specification |
| `schema/INVARIANTS.md` | Validation rules with code examples |
| `schema/EXTENSION-POINTS.md` | Future extensibility design |

### Validation
| File | Purpose |
|------|---------|
| `validation/GOLDEN-SET.md` | Representative items for testing |
| `validation/DERIVABILITY-MATRIX.md` | Stakeholder query validation |

---

## Communication Strategy

### Weekly Status Posts
Every week, same day, same format:
- Status (🟢/🟡/🔴)
- This week accomplishments
- Next week plans + dependencies
- Risks/blockers
- Timeline check

### Commitment Receipts
When someone agrees to something, reply in thread:
> "Thanks [Name] — confirming: [restate what they agreed to]. I'll proceed with this. Let me know if anything changes."

### Scope Change Visibility
When scope changes, post publicly:
> "📌 Scope Change — [Date]. Added: [X]. Requested by: [Name]. Impact: Timeline moves from Week X → Week Y."

### Blocker Visibility
When blocked, post publicly:
> "🚧 Blocked — Waiting on [X]. Impact: [Y]. Timeline risk: [Z]. @person — can you confirm timing?"

---

## Next Steps

### Week 1
1. [ ] Post project kickoff in Slack channel
2. [ ] Send validation requests to Shin (phase model, container field)
3. [ ] Send validation request to Jen (scoring factors)
4. [ ] Start populating golden set

### Week 2
1. [ ] Lock golden set (20-50 items)
2. [ ] First weekly status post
3. [ ] Collect receipts from Shin/Jen validation

---

## Open Questions

| Question | Owner | Target |
|----------|-------|--------|
| Scoring factor weights (align with Confluence) | Brandon + Jen | Week 4 |
| Golden set item selection | Brandon + Shin | Week 2 |
| Station classification (hot vs cold) | Brandon + Jen | Week 3 |

---

## Files Removed/Simplified

The heavy governance docs were removed in favor of lightweight alternatives:
- ❌ `governance/CHARTER.md` → ✅ `SCOPE.md` (simpler)
- ❌ `governance/STAKEHOLDER-REGISTRY.md` → ✅ Removed (I know who cares about what)
- ❌ `governance/DECISIONS.md` → ✅ `LOG.md` (combined with receipts)
- ❌ `governance/FEEDBACK-LOG.md` → ✅ `LOG.md` (combined)

---

## Key Quotes from Session

> "The schema IS the product. If we nail the data model, the app is just a view layer."

> "Design for the future state, don't require it to ship."

> "I need receipts, not sign-offs."

> "I don't silently absorb scope changes."

