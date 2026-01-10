# Bulk Operations Strategy

> **Status:** Draft / Open Design Question
> **Purpose:** Define how bulk edits and search interact with free text (`notes`) vs. structured fields.

---

## The Problem

The schema allows `notes` as an escape hatch (H5), but this creates tension:

1. **Structured fields** are reliable for bulk operations (query, update, validate)
2. **Free text (`notes`)** preserves nuance but is unreliable for programmatic operations

**Example scenario:**
> "Change all waterbath cook temps from 165°F to 155°F"

If temperature lives in `step.notes` as "cook until 165°F internal", a bulk edit can't reliably find and update it without semantic parsing and human review.

---

## Design Principles

### P1: Structured Fields Are Source of Truth for Bulk Ops

Bulk operations (search, update, validate) operate on structured fields by default. This is reliable, auditable, and fast.

### P2: Notes Are Not Forbidden, But Have Trade-offs

`notes` is allowed for:
- Edge cases that don't fit the schema yet
- Human context and rationale
- Preserving original chef language

But: **content in `notes` cannot be reliably bulk-edited**. Authors should understand this trade-off.

### P3: Agent-Assisted Operations for Notes Content

When bulk operations need to touch `notes` content:
1. Agent surfaces affected steps via semantic search
2. Agent proposes structured extraction or text replacement
3. Human reviews and confirms before applying

This is slower but safer than blind text replacement.

---

## What Belongs Where

| Content Type | Where It Goes | Bulk Editable? |
|--------------|---------------|----------------|
| Equipment, time, container, station | Structured fields | Yes |
| Target ingredient/item | `target.bomUsageId` or `target.name` | Yes |
| Cooking phase, prep type | Structured fields | Yes |
| "Cook until golden brown" | `notes` (if no duration known) | No (requires review) |
| "Chef prefers X technique" | `notes` | No |
| Temporary workaround / exception | `notes` | No |

### Guidance for Authors

**Put in structured fields when:**
- The info is operationally meaningful (affects scoring, routing, queries)
- The info follows a known pattern (equipment, time, phase, etc.)
- You want it to be bulk-editable later

**Put in `notes` when:**
- The info is context/rationale, not operational
- The info doesn't fit any structured field yet
- You're preserving original language that would lose meaning if structured

---

## Bulk Operation Modes

### Mode 1: Structured-Only (Default)

```
Query: { "equipment.applianceId": "waterbath" }
Update: { "time.durationSeconds": 300 }
```

- Fast, reliable, no human review needed
- Only touches structured fields

### Mode 2: Agent-Assisted (For Notes Content)

```
Request: "Find all steps mentioning 165°F and change to 155°F"
```

Agent workflow:
1. **Search** - Scan `notes` fields for pattern (semantic or regex)
2. **Surface** - Show matched steps with context
3. **Propose** - Suggest either:
   - Text replacement in `notes`
   - Extraction to structured field (e.g., new `targetTemp` field)
4. **Review** - Human confirms each change (or batch confirms)
5. **Apply** - Execute with audit trail

### Mode 3: Schema Evolution (For Repeated Patterns)

When the same info appears in `notes` across many builds:

1. **Detect** - Agent identifies pattern (e.g., "until X°F" appears 50+ times)
2. **Propose** - Suggest new structured field or enum value
3. **Migrate** - Extract from `notes` to new field across affected builds
4. **Update schema** - Add field to SCHEMA-REFERENCE.md

---

## Quality Metrics

Track these to measure notes discipline:

| Metric | Definition | Target |
|--------|------------|--------|
| Structured coverage | % of operationally meaningful data in structured fields | >90% |
| Notes-only steps | % of steps where `notes` is the only meaningful content | <10% |
| Repeated patterns in notes | Count of patterns appearing 5+ times in `notes` | Decreasing |
| Bulk edit review rate | % of bulk edits requiring human review | <20% |

---

## Open Questions

- [x] Split free text into `instruction` (operational/executable) vs `notes` (context/audit/uncertainty).
- [ ] What's the threshold for "pattern appears enough to warrant schema change"?
- [ ] Should bulk ops on `notes` be blocked entirely, or just flagged for review?
- [ ] How do we handle cross-build bulk ops (e.g., "all builds using chicken")?

---

## References

- [SCHEMA-REFERENCE.md](./SCHEMA-REFERENCE.md) — `notes` field definition
- [HARD-RULES.md](./HARD-RULES.md) — H5 (notes always allowed), H22/H24/H25 (structure-or-notes requirements)
- [AI-AGENT-PROMPT.md](./AI-AGENT-PROMPT.md) — "preserve human truth in notes" guidance
