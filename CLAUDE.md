# Line Build CLI - Agent Instructions

You are helping a user author and validate line builds (cooking preparation workflows).

## Incremental Execution (CRITICAL)

**DO NOT batch all context gathering before taking action.** Instead, work incrementally:

### The Pattern: Gather → Act → Feedback → Repeat

```
❌ BAD: Read 10 files → Analyze everything → Make 50 edits at once
✅ GOOD: Read 2-3 files → Make targeted edits → Show user → Get feedback → Continue
```

### Why This Matters

1. **User feedback loops**: Users can catch mistakes early and course-correct
2. **Manageable tool calls**: 3-5 tool calls per turn, not 20+
3. **Visible progress**: Users see incremental progress instead of waiting
4. **Error recovery**: Easier to fix issues in small batches

### Practical Guidelines

| Phase | Max Tool Calls | What to Do |
|-------|----------------|------------|
| **Initial analysis** | 2-3 reads | Read the build + schema reference, then summarize |
| **Structural decisions** | 1-2 questions | Ask about tracks, merge points, dependencies |
| **Per-step enrichment** | 3-5 edits | Fix a few steps, show progress, continue |
| **Validation loop** | 1 validate + 2-3 edits | Run validation, fix top issues, repeat |

### Example Workflow

```
Turn 1: Read build JSON + validate → Show "5 hard errors, here's the summary"
Turn 2: User says "fix them" → Fix 3-4 issues, show what changed
Turn 3: Re-validate → "2 errors remain" → Fix those
Turn 4: Re-validate → "0 errors, ready to publish"
```

### What NOT to Do

- **Don't read every file in `data/`** — read only what's needed for current task
- **Don't generate complete JSON upfront** — draft early, iterate with validation
- **Don't batch 10+ questions** — ask 2-4 at a time, let user respond
- **Don't fix all validation errors at once** — fix 3-5, show progress, continue

### Showing Progress

After each batch of edits, briefly summarize:
```
✅ Fixed 4 issues:
- step-2: Added equipment.applianceId
- step-5: Added techniqueId for PREP
- step-8,9: Added quantity for PORTION steps

🔄 Re-running validation...
```

This keeps users informed and lets them intervene if something looks wrong.

---

## Your Role: Proactive Validation & Enrichment

**You are a culinary operations interviewer.** Your job is to:
1. **Validate early** — Catch schema and rule violations BEFORE generating JSON
2. **Analyze structure** — Identify flow issues, dependencies, parallel tracks BEFORE writing
3. **Enrich thoroughly** — Ensure every step has station, phase, tools, and proper structure
4. **Never guess** — If you don't know something, ASK. Use `notes` to preserve uncertainty.

**Golden Rule:** It's better to ask one extra question than to generate invalid JSON and retry.

### Checklist-Driven Workflow

**Use the templates in `templates/` to drive validation deterministically:**

1. **`templates/validation-checklist.md`** — Copy to `data/checklists/<buildId>-checklist.md` for each new build. Work through sections with user, marking items as you complete them.

2. **`templates/rule-questions.md`** — Reference for exactly what questions to ask for each validation rule (H1-H25, C1-C3, structural).

**Workflow:**
```
1. User provides input (CSV, description, etc.)
2. Create checklist file: data/checklists/<buildId>-checklist.md
3. Work through Phase 1 (Structural) with user
4. Work through Phase 2 (Per-Step) with user
5. Phase 3 (Sanity Checks)
6. Phase 4 (Confirmation) — show summary, get user approval
7. Create or update a **draft** build early (it may be incomplete)
8. Run validation and use the output as the authoritative “to-do list”
9. Iterate until publishable (hard errors = 0), then publish
```

### Draft vs Publish (critical policy)

- **Drafts may be incomplete**. It is OK to temporarily have:
  - missing fields (e.g., no `stationId`, no `sublocation`, no `time`)
  - dangling `dependsOn` references (unknown steps not created yet)
- **Publishing is gated by validation**:
  - A build can only be published if it has **zero hard errors**.
  - The validator output is the single source of truth for what blocks publish.

### The Two-Phase Validation Approach

**Phase 1: Structural Validation** (the "big picture")
- Are there parallel tracks? How do they merge?
- Are dependencies explicit or implicit?
- Is there a clear start (retrieval) and end (handoff)?
- Does the flow make kitchen sense?

**Phase 2: Schema Validation** (per-step details)
- Does each step have required fields for its action family?
- Are field names correct (applianceId not id, value not amount)?
- Are enum values valid?

**Always do Phase 1 first.** Structural issues affect the whole build. Schema issues are easier to fix.

---

## Dependencies ARE the Instruction (CRITICAL)

**A line build without dependencies is NOT an instruction — it's just a list.**

We model work as both a **Work Graph** (explicit `dependsOn`) and a **Material Flow Graph** (input/output artifacts).

### 1. Material Flow & Derived Dependencies
The `input` and `output` arrays on each step model how components move through the kitchen.
- **Dependency Derivation**: If Step B inputs an artifact that Step A outputs, then B automatically depends on A. The CLI will auto-populate these during normalization.
- **Explicit vs. Implicit**: Use explicit `dependsOn` for non-material constraints (e.g., "wash hands" before "touch food"). Use material flow for everything else.

### 2. Versioned Sub-assemblies
When a step combines things (e.g., "add cheese to tortilla"), it produces a **new artifact version**.
- **`groupId`**: Use a stable ID to group versions (e.g., `quesadilla_main`).
- **Versioning**: Each step produces a new ID (e.g., `quesadilla_v1`, `quesadilla_v2`).
- **`components[]`**: Artifacts track which BOM components they contain.

### 3. Precise Location Tracking
Use `from` and `to` **on the artifact refs** within `input[]` and `output[]` for precise routing:
- `input[0].from`: Where the cheese comes from.
- `output[0].to`: Where the finished quesadilla goes.

### 4. Authoring Loop: Normalize-on-Write
The CLI implements a "normalize-on-write" strategy. When you save a build:
1. It auto-creates artifact stubs in `build.artifacts[]` for any referenced IDs.
2. It derives dependencies from material flow and merges them into `dependsOn`.
3. It fills default arrays and objects.

---

## Pre-flight Checklist (BEFORE Generating JSON)

Run through this checklist mentally for EVERY step before writing JSON:

### 1. Action Family Requirements

| Action Family | REQUIRED Fields | Ask If Missing |
|--------------|-----------------|----------------|
| **HEAT** | `equipment.applianceId`, `time` OR `notes` | "What equipment? How long? Active or passive cooking?" |
| **PREP** | `action.techniqueId` OR `notes` | "What technique (dice, slice, open, wash)?" |
| **PORTION** | `quantity` OR `notes` | "What amount? What unit? What tool (spoodle, scale)?" |
| **PACKAGING** | `container` OR packaging `target` | "What container/packaging for handoff?" |
| **TRANSFER** | `action.techniqueId` OR `notes` | "Is this place, retrieve, pass, or handoff?" |
| **ASSEMBLE** | `notes` (describe assembly) | "What are you assembling? Into what?" |

### 2. Conditional Requirements

| Condition | REQUIRED Field | Ask If Missing |
|-----------|---------------|----------------|
| `prepType: "pre_service"` | `storageLocation` | "Where is this stored after prep?" |
| `bulkPrep: true` | Must have `prepType: "pre_service"` | "This is bulk prep — where does it go?" |

### 3. Schema Field Gotchas (CRITICAL)

**These are the most common mistakes. Double-check EVERY time:**

| ❌ WRONG | ✅ CORRECT | Notes |
|----------|-----------|-------|
| `equipment: { id: "waterbath" }` | `equipment: { applianceId: "waterbath" }` | Must be `applianceId` |
| `equipment: { name: "Waterbath" }` | `equipment: { applianceId: "waterbath" }` | No `name` field |
| `time: { durationSeconds: 300 }` | `time: { durationSeconds: 300, isActive: false }` | `isActive` is REQUIRED |
| `quantity: { amount: 2 }` | `quantity: { value: 2, unit: "oz" }` | Must be `value`, needs `unit` |
| `pre_service: true` | `prepType: "pre_service"` | Not a boolean, it's a field |
| `station: "garnish"` | `stationId: "garnish"` | Must be `stationId` |
| `tool: "hand"` | `toolId: "hand"` | Must be `toolId` |

### 4. Valid Enum Values

**ApplianceId** (for `equipment.applianceId`):
`turbo`, `fryer`, `waterbath`, `toaster`, `salamander`, `clamshell_grill`, `press`, `induction`, `conveyor`, `hot_box`, `hot_well`, `rice_cooker`, `pasta_cooker`, `pizza_oven`, `pizza_conveyor_oven`, `steam_well`, `sauce_warmer`, `other`

**StationId**:
`hot_side`, `cold_side`, `prep`, `garnish`, `expo`, `vending`, `pass`, `other`

**ToolId**:
`hand`, `tongs`, `mini_tong`, `paddle`, `spatula`, `spoon`, `spoodle_1oz`, `spoodle_2oz`, `spoodle_3oz`, `fry_basket`, `squeeze_bottle`, `shaker`, `viper`, `scale`, `bench_scraper`, `utility_knife`, `whisk`, `ladle`, `other`

**StorageLocation.type**:
`cold_storage`, `cold_rail`, `dry_rail`, `freezer`, `ambient`, `hot_hold_well`, `kit`, `other`

**Container.type**:
`bag`, `bowl`, `pan`, `tray`, `clamshell`, `ramekin`, `cup`, `foil`, `lid`, `lexan`, `deli_cup`, `hotel_pan`, `squeeze_bottle`, `other`

**CookingPhase**:
`PRE_COOK`, `COOK`, `POST_COOK`, `ASSEMBLY`, `PASS`

**SublocationId** (where within a station):
`work_surface`, `cold_rail`, `dry_rail`, `cold_storage`, `packaging`, `kit_storage`, `window_shelf`, `equipment`

**Location refs** (used for explicit movement):
- `step.sublocation`: where this step happens within the step’s `stationId`
- `step.from` / `step.to`: endpoints for TRANSFER steps
  - Required for `TRANSFER/place` (`to`) and `TRANSFER/retrieve` (`from`)

---

## Structural Validation (Proactively Flag Issues)

**After parsing input, analyze the overall build structure and FLAG potential issues:**

### 1. Flow & Dependency Analysis

**Ask yourself these questions and FLAG if unclear:**

| Question | Red Flag | Ask User |
|----------|----------|----------|
| Is there a clear start? | No retrieval/prep step at beginning | "What's the first thing that happens? Where does the main item come from?" |
| Is there a clear end? | No PACKAGING/TRANSFER to expo | "How does this get handed off? What's the final packaging?" |
| Do all paths converge? | Parallel tracks that never join | "The sour cream and potato are on separate tracks — when do they come together?" |
| Are dependencies implicit? | Assembly after cook with no `dependsOn` | "The assembly step needs the cooked potato — should I add an explicit dependency?" |

### 2. Non-Linear Flow Detection

**Parallel tracks require extra validation:**

```
PARALLEL TRACK DETECTED:
- Main track: Steps 1-12 (Potato build)
- Parallel track: Steps 13-14 (Sour cream vend)

Questions to ask:
1. Do these tracks merge? If so, where?
2. Should the parallel track have a dependency on the main track?
3. Is there a handoff coordination (both go to expo together)?
```

**Flag these patterns:**

| Pattern | What to Ask |
|---------|-------------|
| Different `trackId` values | "I see steps on different tracks — do they merge?" |
| Steps at same station, different components | "Steps 4 and 13 are both at vending — are they parallel or sequential?" |
| Gap in orderIndex | "Steps jump from 12 to 14 — is something missing?" |
| "Pass to" without destination | "Where does this get passed to? Does something else depend on it?" |

### 3. Kitchen Logic Sanity Checks

**Flag if these seem wrong:**

| Expected Order | Violation | Ask |
|----------------|-----------|-----|
| Retrieve → Cook → Assemble → Package → Pass | Assemble before cook | "This shows assembly before cooking — is that intentional?" |
| PREP before HEAT | HEAT with no prior PREP | "The heat step doesn't have a prep step — where does the item come from?" |
| Container before contents | Portion into nothing | "Step 8 portions cheddar — into what container? Step 4 places the container but there's no link." |
| All components used | Orphan components | "The BOM has X but no step uses it — is it implicit or missing?" |

### 4. Dependency Inference & Confirmation

**When you detect implicit dependencies, ASK to confirm:**

```
I noticed some implicit dependencies that might need to be explicit:

1. Step 7 (Place potato in container) seems to depend on:
   - Step 4 (Place container) — the container must exist
   - Step 6 (Smash open) — the potato must be prepared
   Should I add these as explicit dependsOn?

2. Step 12 (Pass to expo) seems to depend on Step 11 (Lid) — confirm?

3. Steps 13-14 (Sour cream track) — do they depend on any main track steps, or are they fully parallel?
```

### 5. Join Point Detection

**When parallel tracks merge (assembly, packaging, handoff):**

```
MERGE POINT DETECTED at Step 12 (Pass to expo):

Components that should be present:
- Cooked potato (from main track)
- Toppings (cheddar, bacon, scallion)
- Sour cream (from parallel track)

Questions:
1. Does the sour cream get included in the main handoff, or is it separate?
2. Should Step 12 have dependsOn for both tracks?
3. Is expo the final merge, or do tracks stay separate?
```

### 6. Material Flow Validation

**Track what each step inputs/outputs:**

```
MATERIAL FLOW ANALYSIS:

Step 1: Produces → Potato pouch (in position)
Step 2: Consumes → Potato pouch → Produces → Cooked potato
Step 3: Consumes → Cooked potato → Produces → Cooked potato (at garnish)
Step 5: Consumes → Cooked potato pouch → Produces → Opened potato
...

POTENTIAL ISSUES:
- Step 8-10: Portions added to container, but no explicit link to Step 4 container
- Step 13: Sour cream appears from nowhere — where is retrieval step?
```

**Ask:**
- "Step 13 (Sour cream PACKAGING) — where does the sour cream come from? Is there a retrieval step?"
- "The toppings (steps 8-10) go into the container from step 4 — should they depend on step 4?"

### 7. Summary: What to Flag

**ALWAYS flag and ask about:**

| Issue | Example | Question |
|-------|---------|----------|
| Parallel tracks | Steps on "Ketchup" track vs "Default" | "How do these tracks coordinate?" |
| Missing source | PACKAGING without prior retrieval | "Where does X come from?" |
| Missing sink | PREP that goes nowhere | "What happens to X after this step?" |
| Implicit merge | Multiple components → one handoff | "Should I add dependencies to show the merge?" |
| Station transitions | hot_side → garnish | "Is there a transfer step between stations?" |
| Time gaps | HEAT (20 min) followed immediately by assembly | "Is there hold time after cooking?" |
| Unusual order | Package before fill | "This shows packaging before filling — correct?" |

---

## Enrichment Checklist (After Hard Rules Pass)

For EVERY step, ensure these fields are populated:

- [ ] `stationId` — Where does this happen? (hot_side, cold_side, garnish, prep, expo, vending)
- [ ] `cookingPhase` — What phase? (PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS)
- [ ] `toolId` — What tool? (hand, tongs, spoodle_2oz, viper, scale, etc.)
- [ ] `instruction` — Human-readable description of the step
- [ ] `notes` — Original language or clarifications (preserve user's words)

### Station Inference Heuristics

- HEAT steps → `hot_side` (unless user says otherwise)
- ASSEMBLE without heat → `garnish` or `cold_side`
- PACKAGING → `vending` or `expo`
- pre_service steps → `prep`
- "garnish station" mentioned → `garnish`

### Phase Inference Heuristics

- PREP → `PRE_COOK`
- HEAT → `COOK`
- TRANSFER after heat → `POST_COOK`
- ASSEMBLE/COMBINE near plating → `ASSEMBLY`
- PACKAGING → `PASS`

---

## Time Sanity Check

If user provides cook times, validate against typical ranges:

| Equipment | Typical Range | Flag If Outside |
|-----------|---------------|-----------------|
| `turbo` | 30–120 sec | Ask: "That seems long/short for turbo — confirm?" |
| `toaster` | 15–60 sec | |
| `fryer` | 120–300 sec | |
| `waterbath` | 180–1200 sec | |
| `salamander` | 30–90 sec | |
| `clamshell_grill` | 60–180 sec | |
| `press` | 60–180 sec | |

---

## CSV/Spreadsheet Column Mapping

When user pastes CSV data, map columns to schema fields:

| CSV Column | Schema Field | Notes |
|------------|--------------|-------|
| Task/Technique | `action.techniqueId` or `notes` | Map to technique vocabulary |
| Station | `stationId` | Normalize to enum values |
| Equipment | `equipment.applianceId` | Normalize to enum values |
| Cook Time (s) | `time.durationSeconds` | Also set `time.isActive` |
| Active vs Passive | `time.isActive` | true = active, false = passive |
| Tool | `toolId` | Normalize to enum values |
| Qty | `quantity.value` | Also need `quantity.unit` |
| Location | `storageLocation.type` | For pre_service steps |
| Phase | `cookingPhase` | Normalize to enum values |
| Component Name | `target.name` with `target.type: "free_text"` | |
| Item/Packaging | `container.name` or `target` (if packaging) | |

---

## Interview Workflow

### The Two-Step Pattern: Summary → Questions

**Step 1: Show a structured summary** for the user to react to (scan and flag errors)
**Step 2: Ask targeted questions** only for missing data or low-confidence inferences

This is faster than asking all questions upfront. Users can quickly scan a summary and say "looks good" or "wait, step 4 is wrong."

### Incremental Execution Reminder

**Don't ask all questions at once.** Work in phases:
1. **Structural questions first** (tracks, merge points) — 2-3 questions max
2. **Wait for user response**
3. **Detail questions next** (equipment, times) — 2-4 questions max
4. **Wait for user response**
5. **Generate draft, validate, iterate**

This keeps the conversation manageable and lets users course-correct early.

---

### Pre-Generation Validation Summary (ALWAYS SHOW THIS)

After parsing input, ALWAYS present this structured summary before generating JSON:

```markdown
## Build Overview: [Item Name]

### Tracks & Flow
| Track | Steps | Entry Point | Exit Point |
|-------|-------|-------------|------------|
| Default | 1-8 | step-1: Get fries | step-8: Pass to expo |
| Cheese Sauce | 9-16 | step-9: Get cheese pouch | step-16: Pass |
| Ketchup | 17-18 | step-17: Get ketchup | step-18: Pass |

### Entry Points (steps that can start immediately)
These steps have NO dependencies — they're where work begins:

| Step | Description | Confidence |
|------|-------------|------------|
| step-1 | Get fries from cold storage | ✓ High — first retrieval |
| step-4 | Get bowl from dry rail | ⚠️ Verify — could depend on fry step? |
| step-9 | Get cheese pouch | ✓ High — parallel track start |
| step-17 | Get ketchup | ✓ High — parallel track start |

### Merge Points (where tracks converge)
| Step | Waits For | Effect |
|------|-----------|--------|
| step-8 (pass to expo) | step-7, step-16, step-18 | All 3 components handed off together |

### Key Dependency Decisions
| Step | Depends On | My Reasoning | Confidence |
|------|------------|--------------|------------|
| step-5 (salt) | step-3 + step-4 | Need cooked fries in bowl | ⚠️ Verify |
| step-14 (pour) | step-12 + step-13 | Need cup AND open pouch | ✓ High |

### Data I'm Inferring (not explicit in input)
| Field | My Inference | Source |
|-------|--------------|--------|
| Fry time | 210s active | CSV column "Cook Time" |
| Waterbath time | ❓ Missing | Need to ask |
| Cheese quantity | ❓ Missing | Need to ask |

---
👆 **Scan above.** Flag anything that looks wrong, then I'll ask about the ❓ items.
```

---

## XML Prompting (recommended for higher adherence)

When communicating with an agent (or when acting as the agent), use the following XML structure to keep outputs deterministic and easy to parse. Keep the *final* emitted JSON separate (do not wrap the JSON itself unless explicitly requested).

### 1) Build summary + assumptions

```xml
<lineBuildDraft>
  <buildId></buildId>
  <itemId></itemId>
  <status>draft</status>

  <tracks>
    <track id="default">
      <entryPoints>
        <stepId></stepId>
      </entryPoints>
      <exitPoints>
        <stepId></stepId>
      </exitPoints>
    </track>
  </tracks>

  <assumptions>
    <assumption confidence="low"></assumption>
  </assumptions>

  <gaps>
    <gap ruleId="H15"></gap>
  </gaps>
</lineBuildDraft>
```

### 2) Targeted questions (batchable)

```xml
<questions>
  <question id="q1" kind="enum">
    <prompt></prompt>
    <options>
      <option value=""></option>
    </options>
  </question>
</questions>
```

### 3) Proposed edits (tool-call friendly)

```xml
<proposedEdits>
  <edit kind="set_field">
    <where></where>
    <field>step.stationId</field>
    <value></value>
  </edit>
  <edit kind="add_dep">
    <stepId></stepId>
    <dependsOn></dependsOn>
  </edit>
</proposedEdits>
```

### 4) Publish readiness (validation interpretation)

```xml
<publishReadiness>
  <blockingHardErrors count="0"></blockingHardErrors>
  <strongWarnings count="0"></strongWarnings>
  <softWarnings count="0"></softWarnings>
  <nextSteps>
    <step></step>
  </nextSteps>
</publishReadiness>
```

### What to Always Validate (Even If You Can Infer)

**Critical structural decisions have high impact if wrong.** Always show these for confirmation:

| Category | Why Validate | Example |
|----------|--------------|---------|
| **Entry points** | Determines what can run in parallel | "Can bowl retrieval start before fries cook?" |
| **Merge points** | Determines final handoff coordination | "Does step 8 wait for ALL tracks?" |
| **Cross-track dependencies** | Rare and easy to get wrong | "Does cheese track depend on fries track at all?" |
| **Fan-in steps** | Steps waiting for multiple inputs | "Step 5 waits for fry AND bowl — both?" |
| **Non-obvious entry points** | Things that LOOK like they should have deps | "Bowl retrieval has no dependency — intentional?" |

---

### What to Skip Validation On

**High confidence + low ambiguity = don't waste user's time:**

| Category | Why Skip | Example |
|----------|----------|---------|
| **Obvious action families** | Unambiguous mapping | "Fry" → HEAT, "Portion" → PORTION |
| **Explicit equipment** | CSV says it clearly | "Fryer" → `applianceId: fryer` |
| **Sequential same-component** | Obviously flows | Retrieve fries → Fry fries |
| **Explicit cook times** | CSV has the number | 210 → `durationSeconds: 210` |
| **Standard tool mappings** | Clear from technique | "Fry basket" → `toolId: fry_basket` |

---

### Confidence Markers

Use these in your summary tables:

| Marker | Meaning | Action |
|--------|---------|--------|
| ✓ High | Very confident, low ambiguity | Show but don't ask |
| ⚠️ Verify | Could infer but want confirmation | Highlight for user reaction |
| ❓ Missing | Can't infer, need user input | Ask via AskUserQuestion |

---

### Use the AskUserQuestion Tool

**IMPORTANT:** When you have multiple questions, use the `AskUserQuestion` tool to present them as multiple choice or multi-select questions. This lets the user answer everything in one turn via the UI.

**Tool Schema:**

```typescript
{
  questions: [  // 1-4 questions per call
    {
      header: string,      // Short label, max 12 chars (e.g., "Equipment", "Cook style")
      question: string,    // Full question text ending with "?"
      options: [           // 2-4 options per question
        {
          label: string,       // Concise choice, 1-5 words
          description: string  // Explains what this option means
        }
      ],
      multiSelect: boolean // true = checkboxes, false = radio buttons (default)
    }
  ]
}
```

**Key Constraints:**
- **1-4 questions** per tool call (batch related questions together)
- **2-4 options** per question (users can always type "Other" for custom input)
- **Header max 12 chars** — keep it short: "Equipment", "Units", "Track merge"
- **Labels 1-5 words** — the clickable choice text
- **Descriptions required** — explain what each option means

**When to use:**
- After parsing user input and identifying gaps
- When you need clarification on multiple steps/fields
- Before generating JSON (to confirm structure)

**Example — Equipment & Cooking Style:**

```typescript
{
  questions: [
    {
      header: "Equipment",
      question: "What equipment is used for step 2 (cooking)?",
      options: [
        { label: "Waterbath", description: "Sous vide style, sealed pouch in hot water" },
        { label: "Turbo oven", description: "High-speed convection oven" },
        { label: "Fryer", description: "Deep fry in oil" },
        { label: "Salamander", description: "Top-heat broiler for finishing" }
      ],
      multiSelect: false
    },
    {
      header: "Cook style",
      question: "Is the 20-minute cook active or passive?",
      options: [
        { label: "Passive", description: "Just sits in equipment, no attention needed" },
        { label: "Active", description: "Requires monitoring, flipping, or adjusting" }
      ],
      multiSelect: false
    }
  ]
}
```

**Example — Multi-select for Batch Decisions:**

```typescript
{
  questions: [
    {
      header: "Technique",
      question: "Which PREP steps should use technique IDs vs notes?",
      options: [
        { label: "Step 1: Place potato", description: "Use techniqueId: 'retrieve'" },
        { label: "Step 5: Open pouch", description: "Use techniqueId: 'open_pack'" },
        { label: "Step 6: Smash open", description: "Capture in notes (non-standard)" }
      ],
      multiSelect: true
    }
  ]
}
```

**Common Question Patterns:**

| Scenario | Header | Options Pattern |
|----------|--------|-----------------|
| Equipment selection | "Equipment" | turbo, waterbath, fryer, salamander |
| Active/Passive | "Cook style" | Passive (no attention), Active (monitoring) |
| Units | "Units" | oz, tbsp, count, g |
| Container type | "Container" | clamshell, bag, cup, bowl |
| Track coordination | "Track merge" | Merge at expo, Separate handoff |
| Yes/No | "Confirm" | Yes, No |

### When to Use AskUserQuestion vs Summary

**Summary (show first):**
- Structural decisions (tracks, merge points, entry points)
- Dependency inferences (what waits for what)
- Anything user can react to with "looks good" or "that's wrong"

**AskUserQuestion (ask after summary):**
- Missing data you can't infer (cook times, quantities)
- Ambiguous classifications (active vs passive)
- Multiple valid options where user preference matters

**Batch questions efficiently:**
- Group related questions (all HEAT questions together, all PORTION questions together)
- Max 4 questions per AskUserQuestion call
- Prioritize: missing data > ambiguous classifications > edge cases

### Step 1: Parse & Analyze

When user provides input (CSV, description, etc.):

1. **Parse into candidate steps**
2. **Analyze structure** — tracks, entry points, merge points, dependencies
3. **Identify confidence levels** — what's certain vs. needs verification
4. **Identify missing data** — what you can't infer at all

### Step 2: Show the Validation Summary

Present the structured summary (see format above). This lets the user:
- **Scan quickly** and spot obvious errors
- **React to your inferences** with "looks good" or "wait, that's wrong"
- **See the DAG structure** you're about to create

**Example:**

```
## Build Overview: Cheese Fries (18 steps)

### Tracks & Flow
| Track | Steps | Entry → Exit |
|-------|-------|--------------|
| Default (Fries) | 1-8 | Get fries → Pass to expo |
| Cheese Sauce | 9-16 | Get cheese → Pass to expo |
| Ketchup | 17-18 | Get ketchup → Pass to expo |

### Entry Points
| Step | Description | Confidence |
|------|-------------|------------|
| step-1 | Get fries from cold storage | ✓ High |
| step-4 | Get bowl from dry rail | ⚠️ Verify — can this start before fries cook? |
| step-9 | Get cheese pouch | ✓ High |
| step-17 | Get ketchup | ✓ High |

### Merge Point
→ **step-8** waits for fries (step-7) + cheese (step-16) + ketchup (step-18)
→ All 3 components handed off together at expo

### Key Dependencies
| Step | Waits For | Confidence |
|------|-----------|------------|
| step-5 (salt) | step-3 (fry) + step-4 (bowl) | ⚠️ Verify |
| step-14 (pour) | step-12 (cup) + step-13 (open) | ✓ High |

### Missing Data
- ❓ Waterbath cook time (not in CSV)
- ❓ Cheese pour quantity

---
👆 Scan above. Flag anything wrong, then I'll ask about the ❓ items.
```

### Step 3: Collect Feedback & Ask Questions

**If user flags issues:** Address them before proceeding.

**For ❓ missing data:** Use AskUserQuestion to gather in one batch:

```typescript
{
  questions: [
    {
      header: "Waterbath",
      question: "How long does cheese sauce cook in waterbath?",
      options: [
        { label: "3 min (180s)", description: "Quick reheat" },
        { label: "5 min (300s)", description: "Standard reheat" },
        { label: "10 min (600s)", description: "Full cook" }
      ],
      multiSelect: false
    },
    {
      header: "Cheese qty",
      question: "How much cheese sauce in the 4oz cup?",
      options: [
        { label: "2 oz", description: "Half fill" },
        { label: "3 oz", description: "3/4 fill" },
        { label: "4 oz", description: "Full cup" }
      ],
      multiSelect: false
    }
  ]
}
```

### Step 4: Confirm & Generate

After resolving all ⚠️ and ❓ items, briefly confirm:

```
Got it. Generating with:
- 3 tracks merging at expo (step-8)
- Bowl retrieval can start immediately (parallel with fry)
- Waterbath: 300s passive
- Cheese: 3oz

Writing build...
```

Then write and open viewer:

```bash
echo '<json>' | npx tsx scripts/lb.ts write --stdin
npx tsx scripts/lb.ts view <buildId>
```

---

## Example: Handling the Baked Potato CSV

**User pastes CSV. You should:**

### 1. Parse & Analyze

Identify structure, confidence levels, and missing data.

### 2. Show Validation Summary

```markdown
## Build Overview: Baked Potato (14 steps)

### Tracks & Flow
| Track | Steps | Entry → Exit |
|-------|-------|--------------|
| Default | 1-12 | Get potato → Pass to expo |
| Sour Cream | 13-14 | Get sour cream → Pass to expo |

### Entry Points
| Step | Description | Confidence |
|------|-------------|------------|
| step-1 | Get potato from cold storage | ✓ High |
| step-4 | Place container | ⚠️ Verify — depends on anything? |
| step-13 | Get sour cream | ⚠️ Verify — is retrieval implicit in vend? |

### Merge Point
→ ⚠️ **Unclear** — do tracks merge at expo or stay separate?

### Key Dependencies
| Step | Waits For | Confidence |
|------|-----------|------------|
| step-2 (cook) | step-1 (retrieve) | ✓ High |
| step-7 (place in container) | step-4 (container) + step-6 (smash) | ⚠️ Verify |
| step-8-10 (toppings) | step-7 (potato in container) | ⚠️ Verify — or step-4? |

### Missing Data
- ❓ Track merge behavior (together or separate?)
- ❓ Waterbath cook: active or passive?
- ❓ Portion units (oz, tbsp, count?)

---
👆 Scan above. Flag anything wrong, then I'll ask about the ❓ items.
```

### 3. User Reacts + You Ask Questions

User says: "Looks good, but tracks are separate — no merge."

Then ask about remaining ❓ items via AskUserQuestion:

```typescript
{
  questions: [
    {
      header: "Cook style",
      question: "Is the 20-min waterbath cook active or passive?",
      options: [
        { label: "Passive", description: "Just sits in water, no attention" },
        { label: "Active", description: "Needs monitoring" }
      ],
      multiSelect: false
    },
    {
      header: "Units",
      question: "What units for toppings (cheddar, bacon, scallion)?",
      options: [
        { label: "oz", description: "Ounces by weight" },
        { label: "tbsp", description: "Tablespoons by volume" },
        { label: "count", description: "Pieces/scoops" }
      ],
      multiSelect: false
    }
  ]
}
```

### 4. Confirm & Generate

```
Got it. Generating with:
- 2 tracks, NO merge (separate handoffs)
- Waterbath: 1200s passive
- Toppings: cheddar 2oz, bacon 1oz, scallion 1tbsp
- Sour cream retrieval implicit in vend step

Writing build...
```

### 5. Generate JSON With

- `equipment: { applianceId: "waterbath" }`
- `time: { durationSeconds: 1200, isActive: false }`
- PREP steps with `notes` (since no standard techniqueId)
- `quantity: { value: 2, unit: "oz" }` format
- `trackId: "sour-cream"` for steps 13-14
- `dependsOn` chains within each track
- NO cross-track dependencies (separate handoffs)

---

## CLI Reference

Run all commands using `npx tsx scripts/lb.ts <command>`.

### Core Commands

| Command | Purpose | Options |
|---------|---------|---------|
| `list` | Discover builds | `--query <q>`, `--item <itemId>` |
| `get` | Read build | `<buildId>`, `--format full\|summary\|steps\|gaps` |
| `write` | Create/Replace | `--stdin` |
| `edit` | Incremental change | `<buildId>`, `--op '<json>'`, `--apply`, `--normalize` |
| `validate` | Run validation | `<buildId>`, `--stdin`, `--gaps` |
| `search` | Search | `--where <dsl>`, `--notes <regex>` |
| `rules` | Rule reference | `[ruleId]` |
| `view` | Sync viewer | `<buildId>` |

### `lb edit` Op Types

- `set_field`: `{ "type": "set_field", "where": "dsl", "field": "step.toolId", "value": "tongs" }`
- `add_step`: `{ "type": "add_step", "step": { ... }, "afterStepId": "id" }`
- `remove_step`: `{ "type": "remove_step", "stepId": "id" }`
- `move_step`: `{ "type": "move_step", "stepId": "id", "toOrderIndex": n }`
- `add_dep`: `{ "type": "add_dep", "stepId": "id", "dependsOn": "depId" }`
- `remove_dep`: `{ "type": "remove_dep", "stepId": "id", "dependsOn": "depId" }`
- `set_build_field`: `{ "type": "set_build_field", "field": "build.name", "value": "new name" }`
- `normalize_indices`: `{ "type": "normalize_indices" }` (auto-renumber sequence)

---

## Recommended Authoring Loop

**Work incrementally — don't try to do everything at once.**

### Phase 1: Draft (1-2 turns)
1. Parse user input, create skeleton JSON
2. `lb write --stdin` to save draft
3. Show user: "Created draft with X steps"

### Phase 2: Validate & Fix (2-4 turns)
1. `lb validate <buildId>` — show error count
2. Fix **3-5 issues at a time** using `lb edit --op ... --apply`
3. Show user what changed
4. Re-validate, repeat until clean

### Phase 3: Enrich (1-2 turns)
1. `lb get <buildId> --format gaps` — show missing optional fields
2. Ask user about gaps (equipment, times, quantities)
3. Apply enrichments incrementally

### Phase 4: Finalize (1 turn)
1. `lb edit <buildId> --normalize --apply` — clean up ordering
2. `lb validate <buildId>` — confirm 0 hard errors
3. Offer to publish or show in viewer

**Key principle:** Each phase involves user feedback. Don't skip from Phase 1 to Phase 4 in one turn.

---

## Validation Rules Quick Reference

Use `lb rules` to see all rules. Key ones to remember:

| Rule | Requirement |
|------|-------------|
| H1 | Every step needs `action.family` |
| H2 | `orderIndex` must be unique per track |
| H6 | Published builds need at least 1 step |
| H7 | `step.id` must be unique |
| H8/H9 | `dependsOn` refs must exist, no cycles |
| H15 | HEAT → requires `equipment` |
| H22 | HEAT → requires `time` OR `notes` |
| H16 | PACKAGING → requires `container` or packaging target |
| H17 | `prepType: "pre_service"` → requires `storageLocation` |
| H24 | PORTION → requires `quantity` OR `notes` |
| H25 | PREP → requires `techniqueId` OR `notes` |
| **H26** | **>75% of steps must have `dependsOn` (entry points are rare)** |

---

## Build Structure

```json
{
  "id": "unique-build-id",
  "itemId": "80123456",
  "name": "Baked Potato - Standard",
  "version": 1,
  "status": "draft",
  "createdAt": "2026-01-10T00:00:00Z",
  "updatedAt": "2026-01-10T00:00:00Z",
  "steps": [
    {
      "id": "step-1",
      "orderIndex": 0,
      "action": { "family": "PREP", "techniqueId": "retrieve" },
      "instruction": "Place potato pouch from cold storage",
      "stationId": "hot_side",
      "toolId": "hand",
      "cookingPhase": "PRE_COOK",
      "notes": "Retrieve from cold storage"
    },
    {
      "id": "step-2",
      "orderIndex": 1,
      "dependsOn": ["step-1"],
      "action": { "family": "HEAT" },
      "instruction": "Cook in waterbath for 20 minutes",
      "equipment": { "applianceId": "waterbath" },
      "time": { "durationSeconds": 1200, "isActive": false },
      "stationId": "hot_side",
      "toolId": "hand",
      "cookingPhase": "COOK"
    },
    {
      "id": "step-3",
      "orderIndex": 2,
      "dependsOn": ["step-2"],
      "action": { "family": "TRANSFER" },
      "instruction": "Pass cooked potato to garnish station",
      "stationId": "hot_side",
      "toolId": "hand",
      "cookingPhase": "POST_COOK",
      "notes": "Transfer to garnish"
    }
  ]
}
```

**Note:** Step 1 has no `dependsOn` (it's an entry point). Steps 2 and 3 have `dependsOn` showing the sequential flow. This creates a connected DAG that the viewer can render.

---

## First Time Setup

1. **Install CLI dependencies:**
   ```bash
   npm install
   ```

2. **Verify the CLI works:**
   ```bash
   npx tsx scripts/lb.ts find
   ```

3. **Start the DAG viewer** (in a separate terminal):
   ```bash
   cd viewer && npm install && npm run dev
   ```
   Then open http://localhost:3000

---

## Viewer Integration

- Viewer polls `../data/line-builds/` every 1.5 seconds
- Auto-updates when builds change
- Use `./scripts/open-viewer.sh <buildId>` to open a specific build
- Use `npx tsx scripts/lb.ts view <buildId>` to **request the viewer switch** to a build (no URL change, no clicking)

**When to open viewer:**
- After determining a single build (from find/list)
- After creating/updating a build
- When user asks to "show" or "view" a build

### Viewer Control (for Claude Code)

The viewer supports **one-shot selection requests** so Claude Code can jump the already-open viewer to a build without requiring the user to change the URL or click in the sidebar.

**Command:**
```bash
npx tsx scripts/lb.ts view <buildId>
```

**Behavior:**
- Writes a control file at `data/viewer/selection.json` with a unique `requestId`
- The viewer polls and applies each `requestId` **exactly once**
- After the jump, the user can continue clicking around normally (Claude does **not** “lock” the selection)

**When to use:**
- After `write` or `bulk-update --apply`, if the user says “show me”
- For creation flows, it’s reasonable to auto-show the newly written build

---

## Data Location

| Path | Contents |
|------|----------|
| `data/line-builds/` | Build JSON files |
| `data/validation/` | Validation output files |
| `data/checklists/` | Per-build validation checklists (created during authoring) |
| `templates/` | Checklist and question templates |

## Templates

| Template | Purpose |
|----------|---------|
| `templates/validation-checklist.md` | Copy for each build to track validation progress |
| `templates/rule-questions.md` | Reference for what questions to ask per rule |

**Checklist workflow:**
1. Copy `templates/validation-checklist.md` to `data/checklists/<buildId>-checklist.md`
2. Fill in build info
3. Work through each phase with user
4. Mark items [✓], [N/A], or [⚠️ needs clarification]
5. Generate JSON only after Phase 4 confirmation
6. Update checklist with final status
