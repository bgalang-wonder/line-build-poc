# Line Build CLI - Agent Instructions

You are helping a user author and validate line builds (cooking preparation workflows).

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
7. Generate JSON only after all [✓] or [N/A]
8. Write build, open viewer
9. Update checklist with final status
```

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

The `dependsOn` relationships encode the actual workflow logic:
- **What can happen in parallel** (independent steps with no shared dependencies)
- **What MUST happen after something else** (sequential dependencies)
- **The critical path** through the workflow
- **Merge points** where parallel work converges

### Why This Matters

| Without `dependsOn` | With `dependsOn` |
|---------------------|------------------|
| 22 disconnected nodes | A directed acyclic graph (DAG) |
| No execution guidance | Clear parallel vs. sequential paths |
| Useless as instruction | Actionable workflow |

### The Rule: Every Step Needs a Reason to Exist

1. **Entry points** — Steps with NO `dependsOn` are legitimate starting points:
   - Retrieval from storage (cold rail, dry rail, etc.)
   - Independent parallel prep that can start immediately

2. **All other steps** — MUST have `dependsOn` to show what they wait for:
   - A step that uses cooked protein depends on the cooking step
   - A step that assembles into a container depends on the container placement step
   - A step that applies a lid depends on the filling step

3. **Exit points** — Final VEND/TRANSFER steps that complete the build

### Asking About Dependencies

**During the interview, proactively ask:**

| Scenario | Question |
|----------|----------|
| Step follows another with same component | "Does step N depend on step N-1, or can they run in parallel?" |
| Multiple components merge | "Step 12 assembles protein + toppings — which prior steps does it depend on?" |
| Station transition | "The quesadilla moves from garnish to press — should the press step depend on the fold step?" |
| Parallel tracks | "The salsa track and main track both go to expo — do they merge, or are they independent?" |

### What Qualifies as an Entry Point?

**Entry points are RARE.** A step qualifies as an entry point ONLY if:

| Legitimate Entry Point | Example | Why No Dependency |
|------------------------|---------|-------------------|
| First retrieval of a component | "Get brisket from cold storage" | Nothing happens before this |
| First step of a parallel track | "Retrieve salsa" (on salsa track) | Independent workflow start |
| Truly independent parallel prep | "Spray press with Vegalene" | Can happen anytime before press step |

**These are NOT entry points** (they MUST have `dependsOn`):

| Step Type | Why It Has Dependencies |
|-----------|------------------------|
| Cooking something | Depends on retrieval of that item |
| Assembly/portion into container | Depends on container placement |
| Transfer to another station | Depends on what you're transferring |
| Applying lid | Depends on filling the container |
| Folding/cutting | Depends on assembly |
| Pass to expo | Depends on packaging completion |

### Entry Point Heuristic

**Flag if too many entry points:**
- A 20-step build should have ~2-4 entry points, not 10
- Each track typically has 1-2 entry points (retrieval steps)
- If >25% of steps lack `dependsOn`, something is wrong

**Ask yourself:** "Can this step literally start before anything else happens?"
- If NO → it needs `dependsOn`
- If YES → it's a legitimate entry point

### Rule H26: Graph Connectivity

**Validation rule H26** checks that the build forms a connected graph:
- Entry points (no `dependsOn`) must be intentional starting points
- Non-entry steps must have at least one `dependsOn`
- A build with many disconnected steps is likely missing dependencies

**Note:** `orderIndex` determines step ordering within a track for display purposes, but it does NOT create execution dependencies. You must use `dependsOn` to model the actual workflow.

---

## Pre-flight Checklist (BEFORE Generating JSON)

Run through this checklist mentally for EVERY step before writing JSON:

### 1. Action Family Requirements

| Action Family | REQUIRED Fields | Ask If Missing |
|--------------|-----------------|----------------|
| **HEAT** | `equipment.applianceId`, `time` OR `notes` | "What equipment? How long? Active or passive cooking?" |
| **PREP** | `action.techniqueId` OR `notes` | "What technique (dice, slice, open, wash)?" |
| **PORTION** | `quantity` OR `notes` | "What amount? What unit? What tool (spoodle, scale)?" |
| **VEND** | `container` OR packaging `target` | "What container/packaging for handoff?" |
| **TRANSFER** | `notes` (describe what/where) | "Transfer what? From where to where?" |
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
`turbo`, `fryer`, `waterbath`, `toaster`, `salamander`, `clamshell_grill`, `press`, `induction`, `conveyor`, `hot_box`, `hot_well`, `other`

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

---

## Structural Validation (Proactively Flag Issues)

**After parsing input, analyze the overall build structure and FLAG potential issues:**

### 1. Flow & Dependency Analysis

**Ask yourself these questions and FLAG if unclear:**

| Question | Red Flag | Ask User |
|----------|----------|----------|
| Is there a clear start? | No retrieval/prep step at beginning | "What's the first thing that happens? Where does the main item come from?" |
| Is there a clear end? | No VEND/TRANSFER to expo | "How does this get handed off? What's the final packaging?" |
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

**Track what each step produces/consumes:**

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
- "Step 13 (Sour cream VEND) — where does the sour cream come from? Is there a retrieval step?"
- "The toppings (steps 8-10) go into the container from step 4 — should they depend on step 4?"

### 7. Summary: What to Flag

**ALWAYS flag and ask about:**

| Issue | Example | Question |
|-------|---------|----------|
| Parallel tracks | Steps on "Ketchup" track vs "Default" | "How do these tracks coordinate?" |
| Missing source | VEND without prior retrieval | "Where does X come from?" |
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
- VEND → `vending` or `expo`
- pre_service steps → `prep`
- "garnish station" mentioned → `garnish`

### Phase Inference Heuristics

- PREP → `PRE_COOK`
- HEAT → `COOK`
- TRANSFER after heat → `POST_COOK`
- ASSEMBLE/COMBINE near plating → `ASSEMBLY`
- VEND → `PASS`

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

### Generating Build-Specific Questions

After parsing input, dynamically generate questions based on **which rules apply to this specific build**:

1. **Scan steps for action families** → generate questions only for families present
2. **Detect structural issues** → generate questions about parallel tracks, dependencies, etc.
3. **Identify missing required fields** → generate questions for each gap
4. **Batch into 1-4 question groups** → prioritize structural questions first

**Example Analysis → Questions:**

```
Input: CSV with 14 steps

Analysis:
- HEAT steps found: 1 (step 2) → need H15 (equipment) + H22 (time/isActive)
- PREP steps found: 3 (steps 1, 5, 6) → need H25 (technique or notes)
- PORTION steps found: 3 (steps 8-10) → need H24 (quantity or notes)
- Parallel tracks detected → need structural clarification

Batch 1 (structural + heat):
  Q1: header="Track merge", question="Do the potato and sour cream tracks merge at expo?"
  Q2: header="Equipment", question="What equipment for step 2?"
  Q3: header="Cook style", question="Is the 20-min cook passive?"

Batch 2 (portions + techniques):
  Q1: header="Units", question="What units for portions (steps 8-10)?"
  Q2: header="Technique", question="Which PREP steps use technique IDs?" (multiSelect)
```

### Step 1: Parse Input → Identify ALL Issues

When user provides input (CSV, description, etc.):

1. **Parse into candidate steps**
2. **Run Pre-flight Checklist** (schema/rule requirements)
3. **Run Structural Validation** (flow, dependencies, parallel tracks)
4. **Collect ALL issues** (both types)
5. **Ask about ALL issues in ONE batch** (prioritize structural issues first)

### Step 2: Present Issues in Priority Order

**Order of questions:**

1. **Structural/Flow issues first** (these affect the whole build)
   - Parallel tracks and merge points
   - Missing dependencies
   - Unusual ordering
   
2. **Schema/Rule issues second** (these are per-step)
   - Missing required fields (equipment, time, quantity)
   - Technique IDs vs notes

**Example response:**

```
I've parsed 14 steps for Baked Potato. Before I generate the build, I have some questions:

**STRUCTURAL QUESTIONS:**

1. **Parallel Tracks**: Steps 1-12 are on "Default" track, steps 13-14 are on "Ketchup" track.
   - Do these tracks merge at expo?
   - Should the sour cream (step 13) depend on any main track steps?
   - Or are they fully independent (handed off separately)?

2. **Missing Retrieval**: Step 13 vends sour cream but I don't see where it's retrieved from.
   - Is there a "grab sour cream from cold rail" step that's missing?
   - Or does the vend step include retrieval implicitly?

3. **Dependency Confirmation**: The assembly steps (7-11) seem to depend on step 4 (place container).
   - Which assembly steps need the container to exist first?
   - Should I add `dependsOn: ["step-4"]` to those steps?

**FIELD QUESTIONS:**

4. **Waterbath cooking** (step 2): Is the 20-minute cook passive (just sitting in waterbath)?

5. **Portions** (steps 8-10): What units? oz, tbsp, or count?
```

### Step 3: Confirm Understanding

After user answers, summarize your understanding:

```
Got it. Here's what I'll create:

**Structure:**
- Main track (Default): Steps 1-12, potato build with sequential dependencies
- Parallel track (Ketchup): Steps 13-14, sour cream vend (independent track)
- Tracks are INDEPENDENT (no merge, separate handoff)
- Each track has internal `dependsOn` chains

**Key details:**
- Waterbath: 1200s, passive cooking
- Portions: all in oz (cheddar 2oz, bacon 1oz, scallion 1tbsp)
- Sour cream: retrieval implicit in vend step (from cold storage)

Does this match your intent?
```

### Step 4: Generate, Write, and Open Viewer

```bash
# Write the build
echo '<json>' | npx tsx scripts/lb.ts write

# If successful, automatically open in viewer
./scripts/open-viewer.sh <buildId>
```

---

## Example: Handling the Baked Potato CSV

**User pastes CSV. You should:**

### 1. Parse and Run BOTH Checklists

**Structural Analysis:**
- ⚠️ Two tracks detected: "Default" (steps 1-12) and "Ketchup" (steps 13-14)
- ⚠️ Step 13 (Sour Cream VEND) has no prior retrieval step
- ⚠️ No explicit merge point — do tracks converge at expo?
- ⚠️ Station transitions: Waterbath → Garnish (step 3 is "Pass to")

**Schema/Rule Analysis:**
- ⚠️ Step 2: HEAT with waterbath, 1200s — need `isActive`
- ⚠️ Step 5: "Open Pouch" is PREP — need `techniqueId` or `notes`
- ⚠️ Step 6: "Smash Open" is PREP — need `techniqueId` or `notes`
- ⚠️ Steps 8-10: PORTION — have qty but unclear units

### 2. Ask ALL Questions (Structural First)

> I've parsed the baked potato build (14 steps). Some clarifications:
>
> **STRUCTURE:**
> 1. **Parallel tracks**: Steps 1-12 are on "Default", steps 13-14 are on "Ketchup".
>    - Do these merge at expo (both go together)?
>    - Or are they handed off separately?
>
> 2. **Missing retrieval**: Step 13 vends sour cream, but where does it come from?
>    - Should I add a retrieval step from cold storage?
>    - Or is retrieval implicit in the vend?
>
> 3. **Station flow**: Steps go Waterbath → Garnish with a "Pass to" step.
>    - Is there any hold time between cooking and assembly?
>    - Does the pass require any dependency modeling?
>
> **FIELDS:**
> 4. Waterbath (1200s / 20 min) — passive cooking?
> 5. Portions (cheddar 2, bacon 1, scallion 1) — what units?
> 6. "Open Pouch" and "Smash Open" — should I capture as technique ID or notes?

### 3. Confirm Understanding

> Got it. Here's what I'll create:
>
> **Structure:**
> - Main track: Steps 1-12 (potato build from waterbath through garnish)
> - Parallel track: Steps 13-14 (sour cream from cold storage to expo)
> - **No merge** — they're handed off independently
> - Sour cream retrieval is implicit in vend step
>
> **Key details:**
> - Waterbath: 1200s, passive
> - Portions: cheddar 2oz, bacon 1oz, scallion 1tbsp
> - Techniques: captured in notes ("Open pouch with viper", "Smash open")
>
> Does this match your intent?

### 4. Generate JSON With

- Correct `equipment: { applianceId: "waterbath" }`
- Correct `time: { durationSeconds: 1200, isActive: false }`
- PREP steps with `notes` (since no standard techniqueId)
- `quantity: { value: 2, unit: "oz" }` format
- `trackId: "ketchup"` for steps 13-14
- `dependsOn` chains within each track (steps flow sequentially)
- `instruction` and `stationId` for every step

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

1. **Initial Draft**: Create skeleton JSON → `lb write` (or `lb validate --stdin` to check).
2. **Review Gaps**: `lb get <buildId> --format gaps` to see what's missing.
3. **Refine**: Use `lb edit <buildId> --op ... --apply` for incremental fixes.
4. **Normalize**: `lb edit <buildId> --normalize --apply` to clean up step ordering.
5. **Finalize**: `lb validate <buildId>` to confirm 100% health.

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
| H16 | VEND → requires `container` or packaging target |
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
