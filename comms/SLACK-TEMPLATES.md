---
type: templates
status: active
project: line-build-redesign
created: 2025-12-31
author: Brandon Galang
---

# Slack Communication Templates

Copy-paste templates for project communication. Customize as needed.

---

## Weekly Status Update

Post every week, same day (e.g., Friday), same channel.

```
📍 Line Build Schema — Week [X] Update

**Status:** 🟢 On Track | 🟡 At Risk | 🔴 Blocked

**This week:**
- [Accomplishment 1]
- [Accomplishment 2]
- [Accomplishment 3]

**Next week:**
- [Plan 1]
- [Plan 2]
- Need: [Dependency from someone]

**Risks/Blockers:**
- [None currently] OR [Risk description]

**Timeline check:** [On track for Week 9 schema lock] OR [At risk because X]
```

---

## Commitment Receipt

When someone agrees to something, reply in thread to create a receipt:

```
Thanks [Name] — confirming:

[Restate what they agreed to in your words]

I'll proceed with this design. Let me know if anything changes.
```

**Example:**
```
Thanks Shin — confirming:

The phase model (PRE_COOK / COOK / POST_COOK) matches how you structure the spreadsheet, and this is sufficient for complexity scoring.

I'll proceed with this design. Let me know if anything changes.
```

---

## Validation Request

When you need someone to confirm something works for them:

```
Hey [Name],

Quick validation request on the line build schema:

[Specific thing you need validated]

Here's how I'm modeling it: [link or snippet]

Does this work for [their use case]? Specifically:
- [Specific question 1]
- [Specific question 2]

Let me know by [date] if possible — this feeds into [milestone].
```

**Example:**
```
Hey Jen,

Quick validation request on the line build schema:

I need to confirm the complexity scoring factors are derivable from the schema.

Here's the scoring derivation table: [link]

Does this capture what you need? Specifically:
- Can you compute hot/cold ratio from equipment.applianceId?
- Is the "short appliance step" threshold still <45 seconds?

Let me know by Friday if possible — this feeds into the Week 4 scoring proof.
```

---

## Scope Change Announcement

When scope changes, make it visible:

```
📌 Scope Change — [Date]

**Added:** [What's being added]
**Requested by:** [Name]
**Impact:** Timeline moves from Week [X] → Week [Y]

Proceeding unless I hear otherwise by [date].

cc: [relevant people]
```

---

## Blocker Announcement

When you're blocked on someone:

```
🚧 Blocked — [Date]

**Waiting on:** [Team/Person] to [deliver X]
**Impact:** Can't proceed with [Y] until this is resolved
**Timeline risk:** If not resolved by [date], [milestone] moves to Week [X]

@[person] — can you confirm timing?
```

---

## Pre-Mortem (Before Key Milestones)

Post before major milestones to set expectations:

```
⚠️ Pre-Mortem — [Milestone Name] (Week [X])

For [milestone] to happen on time, we need:
- [ ] [Dependency 1] by [date]
- [ ] [Dependency 2] by [date]
- [ ] [Constraint] (e.g., no new requirements after Week 6)

If any of these slip, I'll flag immediately with revised timeline.

Current confidence: 🟢 High | 🟡 Medium | 🔴 Low
```

---

## Milestone Completion

When you hit a milestone:

```
✅ [Milestone Name] Complete — [Date]

**What's done:**
- [Deliverable 1]
- [Deliverable 2]

**Key decisions made:**
- [Decision 1]
- [Decision 2]

**Next milestone:** [Name] by Week [X]

Thanks to [people who helped] for input.
```

---

## Deferred Request Response

When someone asks for something out of scope:

```
Thanks for the input — that's a great idea for future work.

For v1, I'm focused on [current scope]. I've noted this for v2 consideration.

Here's why: [brief rationale, or link to scope doc]

Happy to discuss if you think this should block v1.
```

---

## "I Told You So" (Use Sparingly, Stay Calm)

When someone claims they didn't know or didn't agree:

```
I flagged this on [date]: [link to Slack post]

The timeline impact was communicated on [date]: [link]

Happy to discuss what we can do now to get back on track.
```

---

## Project Kickoff Post

For the initial announcement:

```
📢 Line Build Schema v1 — Project Kickoff

**What:** Defining a canonical schema for line builds that enables complexity scoring and is extensible for future routing/sequencing.

**Why:** Complexity scoring currently happens in spreadsheets. We need structured data to automate this and enable bulk operations.

**Timeline:** Q1 2026 (12 weeks)
- Weeks 1-2: Setup, golden set definition
- Weeks 3-6: Schema iteration, stakeholder validation
- Weeks 7-9: Schema lock, stability window
- Weeks 10-12: Documentation, handoff

**Key stakeholders:**
- Jen West — Complexity scoring validation
- Shin Izumi — Authoring/data quality validation
- Michelle Schotter — Sequencing/KDS compatibility

**What I need from you:**
- Jen/Shin: ~30 min/week for validation
- Michelle: Monthly check-in on extensibility

I'll post weekly updates here. Questions/input welcome anytime.

Scope doc: [link to SCOPE.md]
```

