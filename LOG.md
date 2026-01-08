---
type: log
status: active
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
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

## Decisions

### DEC-001: Container as first-class field
**Date:** 2025-12-31  
**Decision:** Add `container` field to Step (type, name, size)  
**Why:** 5,613 occurrences in legacy data; prevents "container parsed as target" errors  
**Input:** (Pending validation with Shin)

---

### DEC-002: Cooking phase as first-class field
**Date:** 2025-12-31  
**Decision:** Add `cookingPhase` enum (PRE_COOK, COOK, POST_COOK, PASS)  
**Why:** 1,928 occurrences of phase markers; critical for cold-to-hot rotation scoring  
**Input:** (Pending validation with Shin)

---

### DEC-003: Exclude flag for negation
**Date:** 2025-12-31  
**Decision:** Add `exclude?: boolean` to Step  
**Why:** 271 cases of "No X" patterns; explicit flag clearer than parsing notes  
**Input:** (Pending validation with Shin)

---

### DEC-004: Defer equipment-based filtering
**Date:** 2025-12-31  
**Decision:** Include `conditions` as optional field, don't require for v1  
**Why:** Upstream equipment profile data doesn't exist; design for it, don't block on it  
**Input:** (Pending confirmation with Michelle)

---

### DEC-005: Tracks as optional
**Date:** 2025-12-31  
**Decision:** `tracks` is optional authoring structure, not required  
**Why:** Not all items have meaningful parallel structure; orderIndex sufficient for v1  
**Input:** (Pending validation with Shin)

---

## Receipts

*Template:*
```
### [Date] — [Topic]
**Who:** [Name]
**What they said:** [Quote or summary]
**Link:** [Slack/doc link]
**Implication:** [What I'm doing with this]
```

### (Example — replace with real receipts)
```
### 2025-01-07 — Phase model confirmation
**Who:** Shin Izumi
**What they said:** "Yeah, PRE_COOK / COOK / POST_COOK matches how I structure the spreadsheet"
**Link:** [Slack link]
**Implication:** Proceeding with cookingPhase enum as designed
```

---

## Feedback (Input I'm Not Acting On)

### FB-001: Add dependency graph for parallel cooking
**From:** Michelle Schotter  
**Date:** 2025-12-31  
**Request:** "For sequencing, we'd need to know which steps can run in parallel"  
**Disposition:** Deferred to v2  
**Why:** v1 focus is complexity scoring; `dependsOn` is an extension point for later  

---

### FB-002: Require BOM reference for all component steps
**From:** (Hypothetical eng feedback)  
**Date:** 2025-12-31  
**Request:** "Shouldn't we require bomUsageId for all component steps?"  
**Disposition:** Declined for v1  
**Why:** Legacy data has only 10.6% structured references; would block adoption  

---

## Timeline Changes

*Log any scope changes that affect timeline:*

```
### [Date] — [What changed]
**Requested by:** [Name]
**Impact:** Timeline moves from Week X → Week Y
**Communicated:** [Link to Slack post]
```

---

## Weekly Status Posts

*Links to weekly Slack updates for reference:*

| Week | Date | Link | Status |
|------|------|------|--------|
| 1 | 2025-01-XX | [link] | 🟢 On Track |
| 2 | 2025-01-XX | [link] | |
| ... | | | |

