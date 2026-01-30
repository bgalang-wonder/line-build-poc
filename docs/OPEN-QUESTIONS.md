# Open Questions

Questions that need SME verification before finalizing schema/derivation rules.

---

## Q1: Packaging Sublocation Direction

**Question:** Is the `packaging` sublocation one-way (out only)?

**Context:** The `packaging` sublocation at each station stores packaging supplies (containers, lids, bags). When a step has `location: "packaging"`, we believe this means "retrieve packaging FROM there" - not "place something INTO packaging area."

**Current Assumption:** `packaging` sublocation is a **source** for packaging materials, never a destination.

**Implication for derivation:**
- `technique: place` + `locationHint: "packaging"` → `from: { sublocation: "packaging" }` (getting a container)
- We would never derive `to: { sublocation: "packaging" }`

**Status:** Needs verification

**Added:** 2026-01-23

---

## Q2: "From X Station" Location Hints

**Question:** When the CSV shows `Location: "From Turbo Station"`, is this always indicating a cross-station transfer?

**Context:** In the Chicken Vindaloo CSV, step 17 shows:
- Station: Garnish
- Location: "From Turbo Station"
- Technique: stir

This seems to indicate the component arrived from the turbo station (was passed in a previous step).

**Current Assumption:** "From X Station" in the Location column indicates the **source station** for this component, useful for traceability but the actual transfer happens in a prior `pass` step.

**Implication:** This is metadata/provenance, not a derivable `from` location for THIS step.

**Status:** Needs verification

**Added:** 2026-01-23

---

## Template

```markdown
## QN: [Short Title]

**Question:** [The actual question]

**Context:** [Why this matters, example data]

**Current Assumption:** [What we're assuming for now]

**Implication:** [How this affects schema/derivation]

**Status:** Needs verification | Verified | Rejected

**Added:** YYYY-MM-DD
```
