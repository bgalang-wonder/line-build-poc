# Build Validation Checklist

> **Instructions for Claude Code:** Copy this template to `data/checklists/<buildId>-checklist.md` when starting a new build. Use this to analyze the input and generate questions dynamically based on which rules apply.

> **IMPORTANT: Use the ask questions tool!** After analysis, use Claude Code's ask questions tool to present all questions as multiple choice / multi-select. Don't ask questions one at a time in chat.

---

## Build Info

| Field | Value |
|-------|-------|
| Build ID | `<to-be-assigned>` |
| Menu Item ID | `<from-user>` |
| Build Name | `<from-user>` |
| Source | `<csv/description/existing-build>` |
| Date | `<today>` |

---

## Phase 1: Structural Validation

### 1.1 Flow Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Clear start point (retrieval/prep) | [ ] | |
| Clear end point (PACKAGING/handoff) | [ ] | |
| All stations accounted for | [ ] | |
| Station transitions make sense | [ ] | |

**Potential questions (add to Questions Batch if needed):**
- [ ] "What's the first thing that happens? Where does the main item come from?"
- [ ] "How does this get handed off? What's the final packaging?"
- [ ] "What stations does this touch? (hot side, cold side, garnish, expo)"

**Notes:**
```
<notes from analysis>
```

### 1.2 Parallel Tracks

| Check | Status | Notes |
|-------|--------|-------|
| Single track (linear flow) | [ ] | |
| Multiple tracks detected | [ ] | List: |
| Tracks merge at known point | [ ] | Merge point: |
| Tracks stay independent | [ ] | |

**If multiple tracks detected, ask:**
- [ ] "I see steps on different tracks — do they merge?"
- [ ] "Where do [track A] and [track B] come together?"
- [ ] "Are they handed off together or separately?"

**User's answers:**
```
<capture user responses here>
```

### 1.3 Dependencies

| Check | Status | Notes |
|-------|--------|-------|
| Dependencies are implicit (orderIndex only) | [ ] | |
| Explicit dependsOn needed | [ ] | Which steps: |
| No circular dependencies | [ ] | |
| Cross-track dependencies identified | [ ] | |

**Questions to ask:**
- [ ] "Does step B need step A to finish first, or can they happen in parallel?"
- [ ] "Should I add explicit dependencies, or is step order sufficient?"
- [ ] "For the parallel tracks, does [track B] depend on anything from [track A]?"

**User's answers:**
```
<capture user responses here>
```

### 1.4 Material Flow

| Check | Status | Notes |
|-------|--------|-------|
| All components have a source | [ ] | |
| All components have a destination | [ ] | |
| No orphan outputs | [ ] | |
| No missing inputs | [ ] | |

**If issues found, ask:**
- [ ] "Step X uses [component] but I don't see where it comes from — is there a retrieval step?"
- [ ] "Step Y has output [X] but nothing uses it — what happens to it?"
- [ ] "The BOM has [item] but no step references it — is it implicit or missing?"

**User's answers:**
```
<capture user responses here>
```

---

## Questions to Generate (for Ask Questions Tool)

> **Instructions:** After analysis, generate questions dynamically based on which rules apply to THIS build. Use Claude Code's ask questions tool to present them.

### Question Generation Logic

**Step 1: Identify which rules apply**

| Rule | Applies If | Steps Affected |
|------|-----------|----------------|
| H15 (HEAT equipment) | Any HEAT steps | |
| H22 (HEAT time) | Any HEAT steps | |
| H25 (PREP technique) | Any PREP steps | |
| H24 (PORTION quantity) | Any PORTION steps | |
| H16 (PACKAGING container) | Any PACKAGING steps | |
| H17 (storage location) | Any pre_service steps | |
| Parallel tracks | Multiple trackIds detected | |
| Dependencies | Implicit ordering unclear | |

**Step 2: Generate questions for each applicable rule**

For each rule that applies, generate a question:

```
Rule: H15 (HEAT equipment)
Steps: [list affected steps]
Question type: Multiple choice
Question: "Step X ([description]) - What equipment?"
Options: turbo, fryer, waterbath, toaster, salamander, clamshell_grill, press, other
```

```
Rule: H22 (HEAT time)
Steps: [list affected steps]  
Question type: Multiple choice
Question: "Step X - Is the cooking active or passive?"
Options: Active (attending the cook), Passive (just waiting)
```

```
Rule: H25 (PREP technique)
Steps: [list affected steps]
Question type: Multi-select OR multiple choice per step
Question: "Which PREP steps should use technique IDs vs notes?"
Options: [Step 1: Use technique ID, Step 1: Capture in notes, Step 5: Use technique ID, ...]
```

```
Rule: H24 (PORTION quantity)
Steps: [list affected steps]
Question type: Multiple choice
Question: "Steps X, Y, Z - What unit for portions?"
Options: oz, tbsp, tsp, count, g, ml
```

```
Structural: Parallel tracks
Question type: Multiple choice
Question: "Tracks [A] and [B] detected - how do they relate?"
Options: Merge at expo, Separate handoff, Track B depends on Track A, Other
```

**Step 3: Present via ask questions tool**

Use Claude Code's ask questions tool with the generated questions. Capture responses below.

### Generated Questions

<!-- Fill in the actual questions generated for this build -->

| # | Rule | Question | Type | Options |
|---|------|----------|------|---------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### User's Responses

| # | Response |
|---|----------|
| 1 | |
| 2 | |
| 3 | |

---

## Phase 2: Per-Step Validation

### Step Template

Copy this block for each step:

```
### Step [N]: [Description]

| Field | Status | Value |
|-------|--------|-------|
| action.family | [✓/⚠️] | <PREP/HEAT/PORTION/etc> |
| orderIndex | [✓] | <number> |
| trackId | [✓/N/A] | <if parallel tracks> |

**Action-specific requirements:**

<For HEAT steps>
| Requirement | Status | Value |
|-------------|--------|-------|
| equipment.applianceId | [ ] | <turbo/fryer/waterbath/etc> |
| time.durationSeconds | [ ] | <seconds> |
| time.isActive | [ ] | <true/false> |
| OR notes (if time unknown) | [ ] | |

<For PREP steps>
| Requirement | Status | Value |
|-------------|--------|-------|
| action.techniqueId | [ ] | <dice/slice/open_pack/etc> |
| OR notes | [ ] | |

<For PORTION steps>
| Requirement | Status | Value |
|-------------|--------|-------|
| quantity.value | [ ] | <number> |
| quantity.unit | [ ] | <oz/tbsp/count/etc> |
| OR notes | [ ] | |

<For PACKAGING steps>
| Requirement | Status | Value |
|-------------|--------|-------|
| container.type | [ ] | <bag/clamshell/cup/etc> |
| container.name | [ ] | |
| OR target (packaging) | [ ] | |

<For pre_service steps>
| Requirement | Status | Value |
|-------------|--------|-------|
| prepType | [✓] | pre_service |
| storageLocation.type | [ ] | <cold_rail/cold_storage/etc> |

**Enrichment (nice to have):**
| Field | Status | Value |
|-------|--------|-------|
| stationId | [ ] | |
| cookingPhase | [ ] | |
| toolId | [ ] | |
| instruction | [ ] | |
| notes | [ ] | |

**Questions for this step:**
- [ ] <specific questions>

**User's answers:**
```
<capture>
```
```

---

## Phase 2: Step-by-Step Checklist

<!-- Generate one section per step below -->

### Step 1: [Description]

| Field | Status | Value |
|-------|--------|-------|
| action.family | [ ] | |
| orderIndex | [ ] | 0 |

**Action-specific requirements:**
| Requirement | Status | Value |
|-------------|--------|-------|
| (based on family) | [ ] | |

**Enrichment:**
| Field | Status | Value |
|-------|--------|-------|
| stationId | [ ] | |
| cookingPhase | [ ] | |
| toolId | [ ] | |
| instruction | [ ] | |

---

## Phase 3: Sanity Checks

### 3.1 Time Validation

| Step | Equipment | Time | Expected Range | Status |
|------|-----------|------|----------------|--------|
| | | | | [ ] |

**Flag if outside range:**
- turbo: 30–120 sec
- toaster: 15–60 sec
- fryer: 120–300 sec
- waterbath: 180–1200 sec
- salamander: 30–90 sec

### 3.2 Kitchen Logic

| Check | Status | Notes |
|-------|--------|-------|
| Retrieve before cook | [ ] | |
| Cook before assemble | [ ] | |
| Container before contents | [ ] | |
| Package before pass | [ ] | |

**If violations found:**
- [ ] "This shows [X] before [Y] — is that intentional?"

---

## Phase 4: Final Confirmation

### Summary for User

```
Here's what I'll create:

**Build:** [name] (ID: [id])
**Menu Item:** [itemId]
**Structure:** [single track / X parallel tracks]
**Steps:** [count]

| Step | Action | Description | Station |
|------|--------|-------------|---------|
| 1 | | | |
| 2 | | | |
...

**Key decisions:**
- Dependencies: [implicit via orderIndex / explicit dependsOn]
- Parallel tracks: [merge at X / independent]
- [any other notable decisions]

Does this look correct?
```

### User Confirmation

- [ ] User confirmed structure
- [ ] User confirmed all steps
- [ ] Ready to generate JSON

---

## Generated JSON

```json
<paste generated JSON here after user confirms>
```

---

## Validation Result

| Check | Result |
|-------|--------|
| Schema validation | [ ] Pass / [ ] Fail |
| Hard rules (H1-H25) | [ ] Pass / [ ] Fail |
| Warnings | |

**If failed, issues:**
```
<paste validation errors>
```

**Resolution:**
```
<what was fixed>
```

---

## Final Status

- [ ] Build written successfully
- [ ] Opened in viewer
- [ ] User approved

**Build ID:** `<final-id>`
**File:** `data/line-builds/<id>.json`
