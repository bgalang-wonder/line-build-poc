---
type: requirements
status: draft
project: line-build-redesign
created: 2025-01-05
updated: 2025-01-05
author: Brandon Galang
priority: high
tags: [requirements, acceptance-criteria, jobs-to-be-done]
related: [agent-mediated-line-build-spec.md]
---

# Line Build System: Functional Requirements & Acceptance Criteria

## Scope Statement

**We are building:** A structured schema and authoring tool for line builds that enables automatic complexity scoring and variant management.

**We are NOT building:** A KDS, an inventory system, a routing engine, or a scheduling system.

---

## P1 — Must-Have (v1 Success Criteria)

These are the capabilities we must support to say "this worked."

### P1.1 Capture Work Types in a Computable Way

**Job to be done:** Given any point in a line build, we can identify what type of work is happening.

**Acceptance Criteria:**
- [ ] We can categorize work into a bounded set of action types (prep, heat, transfer, combine, assemble, portion, check, package, other)
- [ ] We can query "show me all heating work across the menu"
- [ ] We can count how many distinct types of work a dish requires
- [ ] A step cannot be published without identifying its work type

**How we test:** Create 10 sample line builds. All pass validation without using "other" for more than 10% of steps.

---

### P1.2 Identify What's Being Acted On

**Job to be done:** Given any point in a line build, we can identify what ingredient/item is involved.

**Acceptance Criteria:**
- [ ] We can link work to a known ingredient (BOM reference) when one exists
- [ ] We can fall back to human-readable name when no BOM link exists
- [ ] We can distinguish "this is an ingredient" from "this is a container/tool"
- [ ] If user enters "bowl" as a target, system asks "Is this a container or ingredient?"

**How we test:** Migrate 20 items. Verify ingredient references are captured correctly.

---

### P1.3 Capture Equipment + Duration

**Job to be done:** For work that uses equipment, we can identify which equipment and how long it takes.

**Acceptance Criteria:**
- [ ] We can query "show me all work that uses the fryer"
- [ ] We can count equipment variety per dish
- [ ] We can ask "can this dish be made at a location without a turbo?"
- [ ] HEAT steps produce a warning if equipment is missing
- [ ] HEAT steps produce a warning if time is missing
- [ ] We can distinguish active labor time from passive waiting time

**How we test:** Score 20 items using the new system. Compare to legacy spreadsheet. Variance is within tolerance.

---

### P1.4 Capture "When" in the Process

**Job to be done:** We can identify whether work happens before cooking, during cooking, after cooking, or as a handoff.

**Acceptance Criteria:**
- [ ] We can group work by phase (pre-cook, cook, post-cook, pass)
- [ ] We can answer "what needs to happen after the timer goes off?"
- [ ] This information is queryable, not buried in text
- [ ] If text contains "post cook" but phase is not POST_COOK, system flags it

**How we test:** Migrate 10 items with post-cook steps. Confirm phase is populated correctly without manual intervention.

---

### P1.5 Calculate Complexity Without Manual Entry

**Job to be done:** Given the captured information, we can compute a complexity score automatically.

**Acceptance Criteria:**
- [ ] Score accounts for: work variety, equipment variety, station changes, time breakdown
- [ ] Two different authors creating the same dish produce scores within 10% of each other
- [ ] Score matches legacy spreadsheet calculation within 15% for migrated items
- [ ] Score is explainable (breakdown of contributing factors)

**How we test:** Score 20 items using the new system. Compare to Shin's spreadsheet. Variance is within tolerance.

---

### P1.6 Handle Variations Without Duplication

**Job to be done:** A single dish definition can produce different outputs for different contexts.

**Acceptance Criteria:**
- [ ] We can express "if location has X equipment, do it this way; otherwise, do it that way"
- [ ] We can express "if customer selects Y modifier, change Z"
- [ ] Changing the base definition updates all variations automatically
- [ ] We don't maintain separate copies for each scenario

**How we test:** Create one line build for "Chicken Sandwich" that resolves differently for turbo vs. conveyor locations. Change the base. Confirm both resolutions update.

---

### P1.7 Author From Natural Language

**Job to be done:** A user can describe a dish in plain language and end up with usable structured data.

**Acceptance Criteria:**
- [ ] User doesn't need to know the schema
- [ ] System asks questions to resolve ambiguity
- [ ] Output is consistent regardless of how user phrases input
- [ ] User can publish once all hard requirements are met

**How we test:** Give 3 different users the same dish description. All produce valid, publishable builds within 10 minutes.

---

### P1.8 Migrate Existing Data

**Job to be done:** Legacy line builds can be converted to the new representation with minimal manual effort.

**Acceptance Criteria:**
- [ ] Majority of legacy data converts automatically (95%+)
- [ ] Only edge cases require human review (< 5%)
- [ ] Human review uses the same question-and-answer flow as new authoring
- [ ] Converted data supports all the capabilities above

**How we test:** Migrate 50 items. Measure: what % required human intervention? Target: < 5%.

---

## P2 — Should-Have (Operational Completeness)

These are important, but we can ship v1 without fully nailing them.

### P2.1 Benchtop vs Production Separation

**Job to be done:** Support a "gold standard" definition (benchtop) and a "KDS-optimized" view (production) managed by Ops/Training.

**Acceptance Criteria:**
- [ ] Production is derived (rules/transforms), not manually cloned
- [ ] CE can update benchtop without touching production rules
- [ ] Ops can update production transforms without touching benchtop

**How we test:** Create benchtop build. Apply production transforms. Change benchtop. Confirm production updates automatically.

---

### P2.2 Order-In / Sandbag vs Hot-Hold Clarity

**Job to be done:** We can represent different cooking cadences and holding methods.

**Acceptance Criteria:**
- [ ] We can distinguish "cook it now" timing (à la minute) from "cook it ahead" timing (order-in/sandbag)
- [ ] We can capture hot holding as a holding method (water bath hold) with its own rules/times/limits
- [ ] We can represent items that are hot held but still require a "finish" step before serving
- [ ] We can answer "what's the hot-hold time for this item?"

**How we test:** For 5 items that support hot holding, confirm all three timings are captured and queryable.

---

### P2.3 Kitchen Reality Constraints

**Job to be done:** We capture "how KDS actually works" as first-class constraints so we don't build metrics on false assumptions.

**Acceptance Criteria:**
- [ ] We document batch/swimlane behavior, forced batch completion, post-cook visibility issues
- [ ] We acknowledge timer-silence ambiguity (cooks silence timers to stop beeping, not because work is done)
- [ ] Any metrics based on "when cook hit complete" are flagged as unreliable

**How we test:** Document 5 KDS behavioral constraints. Ensure they're referenced in schema docs.

---

### P2.4 Scenario Preview

**Job to be done:** Ability to preview resolved outputs for an equipment profile / location context.

**Acceptance Criteria:**
- [ ] User can preview "what will this look like for Store X?" without leaving the editor
- [ ] Preview shows how overlays resolve for different equipment profiles
- [ ] Preview shows how customizations affect the build

**How we test:** Create build with overlays. Preview for 3 different equipment profiles. Confirm correct resolution.

---

## P3 — Nice-to-Have (Future Enhancements)

These are powerful but expand scope significantly. We can defer them.

### P3.1 Routing Graph + Transit Modeling

**Job to be done:** Explicit station-to-station routing edges, pathfinding, and dynamic rerouting.

**Acceptance Criteria:**
- [ ] We can model station-to-station flow as a directed graph
- [ ] We can compute optimal routing paths
- [ ] We can handle dynamic rerouting when stations are overloaded

**How we test:** TBD (out of scope for v1)

---

### P3.2 Rich Digital Work Instructions

**Job to be done:** Media attachments, step-level confirmations, structured QC checks.

**Acceptance Criteria:**
- [ ] Steps can include images/videos
- [ ] Steps can require quality check confirmations before proceeding
- [ ] Instructions are interactive, not just static text

**How we test:** TBD (out of scope for v1)

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

These came up in research but we're consciously deferring:

1. **"Busy vs compacted" as automatic** — We capture the data; KDS decides which to show
2. **Pod capacity constraints** — Not modeling physical space limits
3. **Inventory availability routing** — Assume inventory is present
4. **Station-to-station transit time** — Not modeling movement time
5. **"Next batch" lookahead** — KDS problem, not authoring problem
6. **Printer-based workarounds** — Temporary hack, not our concern

---

## Agreement

By proceeding, we agree:

- ✅ This scope is fixed for v1
- ✅ New requirements go to v2 backlog
- ✅ Success = the 8 metrics above are met
- ✅ "Nice to have" is not "must have"








