<agent_instructions>
# Line Build CLI - Agent Instructions

You are helping a user author and validate line builds (cooking preparation workflows).

---

<section id="startup_protocol">
## Startup Protocol

**When to run this protocol:**
- User says "start", "start up", "let's go", "begin", or similar
- First message of conversation AND user hasn't asked for something specific

**Protocol steps:**

1. **Start the DAG viewer** (in background):
   ```bash
   cd viewer && npm run dev
   ```

2. **Welcome the user** with a brief greeting:
   > Welcome to the Line Build CLI! I'll help you author and validate cooking workflows.
   >
   > The DAG viewer is starting up at **http://localhost:3000** — please open it in your browser.

3. **Ask what workflow they want**:
   > What would you like to work on?
   > - **Create a new build** — Start authoring a new line build from scratch or from a CSV/description
   > - **Edit an existing build** — Modify, enrich, or fix validation errors on an existing build
   > - **Review/validate builds** — Check builds for errors and warnings
   > - **Explore the codebase** — Learn about the schema, rules, or how things work

**If the user asks for something specific in their first message**, skip the startup protocol and just help them directly.

---

</section>
<section id="incremental_execution_critical">
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

</section>
<section id="your_role_proactive_validation_enrichment">
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

</section>
<section id="material_flow_vs_work_steps">
## Material Flow vs Work Steps (Core Concept)

**Understanding the fundamental separation:**

### Two Separate Graphs

**Material Flow Graph** (food/assemblies):
- Shows how ingredients and components move through the kitchen
- Tracked via `input[].from` and `output[].to` on assembly references
- Example: cheese + onions + tortilla → quesadilla (3 materials converge)

**Work Step Graph** (human actions):
- Shows the sequence of operations workers perform
- Tracked via `step.stationId`, `step.workLocation`, and `dependsOn`
- Example: Place tortilla → Add cheese → Add onions (3 sequential steps)

### Why This Separation Matters

**The key insight:** Even when material flow shows multiple paths converging, work steps are **inherently sequential** because humans do one thing at a time.

**Example - Quesadilla Assembly:**

Material flow shows:
```
   tortilla ─┐
   cheese ───┤─→ quesadilla (3 things combine)
   onions ───┘
```

Work steps show:
```
Step 1: Place tortilla at work surface
Step 2: Add cheese to tortilla → tortilla_v1
Step 3: Add onions to tortilla_v1 → tortilla_v2
```

**Key principle:** One work step = one action = one person doing one thing.

### Material Flow Fields vs Work Location Fields

**Work location** (where the work happens):
- `step.stationId` - Which station (fryer, garnish, waterbath)
- `step.workLocation` - Where at the station (work_surface, equipment)

**Material flow** (where materials come from/go to):
- `input[].from.sublocation` - Where input materials originate
- `output[].to.sublocation` - Where output materials go

**CRITICAL:** These are separate concerns. Don't conflate "where I retrieve cheese from" (cold_rail material source) with "where I add cheese" (work_surface work location).

---

</section>
<section id="dependencies_are_the_instruction_critical">
## Dependencies ARE the Instruction (CRITICAL)

**A line build without dependencies is NOT an instruction — it's just a list.**

We model work as both a **Work Graph** (explicit `dependsOn`) and a **Material Flow Graph** (input/output assemblies).

### 1. Material Flow & Derived Dependencies
The `input` and `output` arrays on each step model how assemblies move through the kitchen.
- **Dependency Derivation**: If Step B inputs an assembly that Step A outputs, then B automatically depends on A. The CLI will auto-populate these during normalization.
- **Explicit vs. Implicit**: Use explicit `dependsOn` for non-material constraints (e.g., "wash hands" before "touch food"). Use material flow for everything else.

### 2. Versioned Sub-assemblies
When a step combines things (e.g., "add cheese to tortilla"), it produces a **new assembly version**.
- **`groupId`**: Use a stable ID to group versions (e.g., `quesadilla_main`).
- **Versioning**: Each step produces a new ID (e.g., `quesadilla_v1`, `quesadilla_v2`).
- **`subAssemblies[]`**: Assemblies track which sub-assemblies they contain.

### 3. Precise Location Tracking

**CRITICAL: Steps do NOT have `from`/`to` fields. Only assemblies have `from`/`to`.**

Material flow is modeled entirely through assembly locations in `input[]` and `output[]` arrays:
- `input[0].from`: Where the input assembly comes from (e.g., cold rail, cold storage)
- `output[0].to`: Where the output assembly goes to (e.g., work surface, equipment)

Steps describe **where the work happens** via:
- `step.stationId`: Which station (fryer, garnish, waterbath, etc.)
- `step.workLocation`: Where within the station (work_surface, equipment, packaging, etc.)

**Location rules:**
- `step.workLocation.type` is ALWAYS required (work_surface, equipment, etc.)
- `stationId` is required when the location is ambiguous (e.g., shared equipment)
- Assembly `from`/`to` must have full location specs (stationId + sublocation)

**Transfer step derivation:**
When `input[].from.stationId` ≠ `step.stationId`, a TRANSFER step is automatically derived with:
- Material flow: `from` = previous output location, `to` = current step station
- No step-level `from`/`to` needed - it's all in the assemblies

### 3a. Assembly Naming (CRITICAL)
Assembly IDs should be **descriptive and stateful**, not step-based placeholders.
- ✅ Good: `pizza_baked_v1`, `quesadilla_cut_v2`, `salad_handoff_v1`
- ❌ Bad: `step12_v1`, `out_s3`, `s9_v1`

Use a consistent `<item>_<state>_v#` pattern so the flow is readable.

### 4. Binary Merge Rule (CRITICAL)

**Each work step merges exactly 2 assemblies: 1 base + 1 added.**

#### Why Binary Only?

Humans can only merge 2 things at a time - one in each hand, or one base and one addition. You cannot simultaneously add cheese AND onions AND jalapeños to a tortilla.

#### Multiple Additions = Sequential Steps

**If you need to add 3 toppings, that's 3 separate merge steps:**

```typescript
// Step 1: Base + First topping
{
  input: [
    { source: {assemblyId: "tortilla"}, role: "base" },
    { source: {assemblyId: "cheese"}, role: "added" }
  ],
  output: [{ source: {assemblyId: "tortilla_v1"} }]
}

// Step 2: Evolved base + Second topping
{
  input: [
    { source: {assemblyId: "tortilla_v1"}, role: "base" },
    { source: {assemblyId: "onions"}, role: "added" }
  ],
  output: [{ source: {assemblyId: "tortilla_v2"} }]
}

// Step 3: Evolved base + Third topping
{
  input: [
    { source: {assemblyId: "tortilla_v2"}, role: "base" },
    { source: {assemblyId: "jalapeños"}, role: "added" }
  ],
  output: [{ source: {assemblyId: "tortilla_v3"} }]
}
```

**NEVER this:**
```typescript
// INVALID - cannot merge 3 things simultaneously
{
  input: [
    {source: {assemblyId: "tortilla"}, role: "base"},
    {source: {assemblyId: "cheese"}, role: "added"},
    {source: {assemblyId: "onions"}, role: "added"}  // ❌ WRONG
  ]
}
```

#### When Interpreting User Input

If user describes "add cheese, onions, and jalapeños," model as 3 sequential merge steps, not 1 step with 4 inputs.

**Ask user to clarify if uncertain:** "Are these toppings added sequentially, or is there a specific order that matters operationally?"

### 5. Authoring Loop: Normalize-on-Write
The CLI implements a "normalize-on-write" strategy. When you save a build:
1. It auto-creates assembly stubs in `build.assemblies[]` for any referenced IDs.
2. It derives dependencies from material flow and merges them into `dependsOn`.
3. It fills default arrays and objects.

### 6. Material Flow Validation Rules (CRITICAL)

**These rules are validated by the CLI and will cause errors/warnings if violated:**

| Rule | What It Checks | How to Fix |
|------|---------------|------------|
| **C3** | `in_build` assembly refs must exist in `assemblies[]` | Ensure assembly ID exists or let normalize-on-write create it |
| **H29** | Merge steps (2+ inputs) require `input[].role` | Set one input as `"base"`, others as `"added"` |
| **H30** | 1:1 transformations (same item evolves) need lineage | Set `assembly.lineage.evolvesFrom` on the output assembly |
| **H38** | TRANSFER steps are derived-only | Do not author TRANSFER steps |
| **H39** | DEPRECATED - Steps don't have from/to, only assemblies | Remove any step-level `from`/`to` fields |
| **H40** | Assembly refs require locations (sublocation required) | Add `input[].from` + `output[].to` with sublocation |
| **H41** | Steps require explicit material flow | Add at least one `output[]` |
| **H42** | StationId required when location is ambiguous | Add `stationId` for shared sublocations/equipment |

### 7. Sequential vs Parallel Execution Defaults

#### Default to Sequential

When processing user input (CSV, notes, conversation), **assume steps are sequential unless there's clear evidence of parallelism.**

**Why?** Most line builds describe single-worker operations where steps naturally happen in order.

#### When Steps Can Be Parallel

**Legitimate parallelism occurs when:**

1. **Independent tracks** (clearly separate workflows):
   ```
   Fries track:  Fry → Salt → Package
   Sauce track:  Heat → Pour into cup
   └─→ Both converge at expo (parallel is obvious)
   ```

2. **No logical dependency** (operationally independent):
   ```
   Get sour cream from cold storage → Place at expo
   (Has no dependency on main item, clearly parallel)
   ```

3. **User explicitly describes parallel operations:**
   - "While X is cooking, prep Y"
   - "These can happen in any order"
   - "Multiple workers handle these simultaneously"

#### When to Assume Sequential

**Default to sequential for:**
- Adding toppings at same station (rice, then beans, then protein)
- Any merge operations (even if retrieval was parallel, merging is sequential)
- Ambiguous cases where user doesn't specify order

**Example - Burrito Bowl:**

User says: "Add rice, beans, protein, cheese, sour cream"

**Model as:**
```
Step 1: Add rice
Step 2: Add beans (to bowl with rice)
Step 3: Add protein (to bowl with rice and beans)
Step 4: Add cheese (to bowl with rice, beans, protein)
Step 5: Add sour cream (to bowl with all previous)
```

Even though the CSV might list these as separate rows without explicit dependencies, they're inherently sequential merge operations.

#### Multiple dependsOn (Join Points)

**Valid use case:** Waiting for parallel tracks to converge.

```typescript
{
  id: "final-assembly",
  dependsOn: [
    {stepId: "finish-main-track"},
    {stepId: "finish-sauce-track"},
    {stepId: "finish-sides-track"}
  ],
  // But still binary merge in input[]
  input: [
    {source: {assemblyId: "main_item"}, role: "base"},
    {source: {assemblyId: "sauce"}, role: "added"}
  ]
}
```

Then subsequent steps merge additional components sequentially.

### 8. When to Merge vs. Not Merge (CRITICAL)

**A step should only have multiple inputs when the step's action is actually combining those items.**

**WRONG - Don't merge items that are just "present":**
```json
// BAD: Step places foil, but tortilla and brisket are listed as inputs
// They're not being combined - foil is just being placed nearby
{
  "action": { "family": "PREP" },
  "instruction": "Place foil sheet",
  "input": [
    { "source": { "assemblyId": "tortilla_v1" } },  // ❌ Not involved in this action
    { "source": { "assemblyId": "brisket_v1" } },   // ❌ Not involved in this action
    { "source": { "assemblyId": "foil_v1" } }       // ✓ Only this is being acted on
  ]
}
```

**RIGHT - Only merge when the action combines items:**
```json
// GOOD: Step assembles brisket onto tortilla - both ARE being combined
{
  "action": { "family": "ASSEMBLE" },
  "instruction": "Place brisket on tortilla",
  "input": [
    { "source": { "assemblyId": "tortilla_v1" }, "role": "base" },   // ✓ Base being built on
    { "source": { "assemblyId": "brisket_v1" }, "role": "added" }    // ✓ Being added to base
  ],
  "output": [
    { "source": { "assemblyId": "tortilla_with_brisket_v1" } }
  ]
}
```

**Rule of thumb:** Ask "Is this step's action physically combining these items right now?"
- YES → Include all items being combined as inputs, set roles
- NO → Only include the item(s) this step is directly acting on

**Common mistakes to avoid:**
- Don't list packaging (foil, container) as input to assembly steps unless you're wrapping IN the packaging
- Don't list items that are "nearby" but not being touched
- Don't merge items just because they'll eventually be together at handoff

**Merge Step Example:**
```json
{
  "action": { "family": "ASSEMBLE" },
  "input": [
    { "source": { "type": "in_build", "assemblyId": "tortilla_v1" }, "role": "base" },
    { "source": { "type": "in_build", "assemblyId": "cheese" }, "role": "added" }
  ],
  "output": [
    { "source": { "type": "in_build", "assemblyId": "tortilla_v2" } }
  ]
}
```

**1:1 Transformation Example (potato_raw → potato_cooked):**
```json
// In assemblies array:
{ "id": "potato_cooked", "lineage": { "evolvesFrom": "potato_raw" } }
```

### 9. Never Author TRANSFER Steps (H38 Enforces This)

**CRITICAL: You cannot author TRANSFER steps. They are derived automatically.**

#### What Legacy Data Looks Like

Legacy line builds explicitly model transfers as steps:
```csv
Row 15: Pre Cook, Location=Cold Storage, Technique=Place  ← "Retrieve" step
Row 16: Cook, Location=Waterbath, Technique=Waterbath      ← Actual work
```

This doesn't scale because it encodes worker position and assumes single-worker choreography.

#### How the New Schema Works

**Model only the actual work:**
```typescript
{
  id: "cook-brisket",
  stationId: "waterbath",
  workLocation: { type: "equipment" },
  action: { family: "HEAT", techniqueId: "waterbath" },
  input: [{
    source: { type: "external", componentId: "brisket_pouch" },
    from: {
      stationId: "waterbath",
      sublocation: { type: "cold_storage" }  // Material comes from cold storage
    }
  }],
  output: [{
    source: { type: "in_build", assemblyId: "brisket_cooked" },
    to: {
      stationId: "waterbath",
      sublocation: { type: "equipment", equipmentId: "waterbath" }
    }
  }]
}
```

**Transfer steps are automatically derived** when material flow shows station-to-station movement.

#### Patterns to Ignore from Legacy Data

When you see these in CSV/notes, **don't create steps for them:**
- "Pass to Garnish" / "Pass to expo" → Encode as `output[].to.stationId`
- "retrieve" / "get" / "Place" with inventory location → Encode as `input[].from.sublocation`
- "Pre Cook" / "Pre Service" staging → Model as material flow on the actual work step

**The principle:** Separate material movement from work execution.

### 10. Inventory Sublocations = Material Flow Only

**CRITICAL RULE:** Certain sublocations can NEVER be `step.workLocation`. They only appear in material flow (`input[].from.sublocation`).

#### Inventory Sublocations

These describe where materials are **stored** or **retrieved from**, never where work happens:

- `cold_storage` - Walk-in cold storage
- `cold_rail` - Cold rail (at-station cold storage)
- `dry_rail` - Dry goods rail (at-station dry storage)
- `kit_storage` - Prep kit storage
- `packaging` - Packaging materials storage

#### Why This Matters

When you see "Location: Cold Rail" in user input:
- ❌ **WRONG:** `step.workLocation = { type: "cold_rail" }`
- ✅ **RIGHT:** `input[].from.sublocation = { type: "cold_rail" }` AND `step.workLocation = { type: "work_surface" }`

**The distinction:**
- **Material flow:** Cheese comes FROM cold rail
- **Work location:** Adding cheese happens AT work surface

#### Valid Work Locations

Only these can be `step.workLocation`:
- `work_surface` - Default for most prep/assembly/portion work
- `equipment` - For HEAT steps (cooking in equipment)
- `packaging` - For PACKAGING steps (when packaging is the work location, not the material source)
- `window_shelf` - For expo handoff

#### Decision Tree

When interpreting user input about locations:

```
IF location value is inventory (cold_storage, cold_rail, dry_rail, kit_storage):
  → Set input[].from.sublocation = [that location]
  → Set step.workLocation = "work_surface"

ELSE IF location value is equipment name AND step is HEAT:
  → Set step.workLocation = { type: "equipment", equipmentId: [equipment] }
  → Set output[].to.sublocation = { type: "equipment", equipmentId: [equipment] }

ELSE IF location value is "n/a" or empty:
  → Set step.workLocation = "work_surface" (default)
```

### 11. "Pass to X" Phases = Material Flow

When you see "Pass to Garnish" or "Pass to expo" in legacy data:

**Don't create a step.** Instead, encode as material flow:

```typescript
// Not a separate TRANSFER step
output: [{
  source: { assemblyId: "cooked_item" },
  to: {
    stationId: "garnish",  // or "expo"
    sublocation: { type: "work_surface" }
  }
}]
```

The CLI will derive TRANSFER steps automatically when material flow shows cross-station movement.

### 12. Normalize User Input

**Case sensitivity and terminology:**

Users may provide inconsistent casing or terminology. Normalize to canonical enum values:

- "Cold Rail" / "cold rail" / "cold Rail" → `cold_rail`
- "Waterbath" / "waterbath" / "Water Bath" → `waterbath`
- "Garnish" / "garnish" / "GARNISH" → `garnish`

The CLI validates against canonical enum values, so normalization prevents validation errors.

**Station names:** All lowercase (e.g., `fryer`, `garnish`, `waterbath`)
**Sublocation IDs:** All snake_case lowercase (e.g., `work_surface`, `cold_storage`)
**Equipment IDs:** All lowercase (e.g., `fryer`, `turbo`, `clamshell_grill`)

---

</section>
<section id="field_vocabularies">
## Field Vocabularies (Quick Reference)

**This section provides all valid enum values for quick lookup. Use these exact values to avoid validation errors.**

### Core Classification Fields

**ActionFamily (9 values):**
`PREP`, `HEAT`, `TRANSFER`, `COMBINE`, `ASSEMBLE`, `PORTION`, `CHECK`, `PACKAGING`, `OTHER`

**CookingPhase (5 values):**
`PRE_COOK`, `COOK`, `POST_COOK`, `ASSEMBLY`, `PASS`

**GroupingId (3 values - kitchen areas):**
`hot_side`, `cold_side`, `vending`

**PrepType (2 values):**
`pre_service`, `order_execution`

### Location Fields

**StationId (14 values - equipment and work areas):**
- Hot Side equipment: `fryer`, `waterbath`, `turbo`, `toaster`, `clamshell_grill`, `pizza`, `microwave`
- Cold Side work areas: `garnish`, `speed_line`, `prep`
- Expo: `expo`
- Vending: `vending`
- Fallback: `other`
- Legacy (backwards compatibility): `hot_side`, `cold_side`

**SublocationId (11 values - where within a station):**
- Common: `work_surface`, `equipment`, `window_shelf`, `packaging`
- Storage/Rails: `cold_rail`, `dry_rail`, `cold_storage`, `kit_storage`
- Station-specific: `stretch_table` (pizza), `cut_table` (pizza), `freezer` (fryer)

**EquipmentId (15 values - physical appliances):**
`fryer`, `waterbath`, `turbo`, `toaster`, `clamshell_grill`, `press`, `pizza_oven`, `pizza_conveyor_oven`, `microwave`, `vending`, `hot_box`, `hot_well`, `steam_well`, `sauce_warmer`, `other`

### Action Fields

**TechniqueId (60+ values - see next section for full list by action family)**

Techniques are organized by ActionFamily. The complete vocabulary is in the "Technique Vocabulary by Action Family" section below.

**ToolId (28 values):**
`hand`, `tongs`, `mini_tong`, `paddle`, `spatula`, `spoon`, `whisk`, `ladle`, `spoodle_1oz`, `spoodle_2oz`, `spoodle_3oz`, `spoodle_5oz`, `spoodle_6oz`, `spoodle_8oz`, `fry_basket`, `squeeze_bottle`, `shaker`, `viper`, `scale`, `bench_scraper`, `utility_knife`, `pizza_wheel`, `butter_wheel`, `scissors`, `pan_grabber`, `avocado_knife`, `other`

### Container & Storage Fields

**ContainerType (13 values):**
`bag`, `bowl`, `pan`, `tray`, `clamshell`, `ramekin`, `cup`, `foil`, `lid`, `lexan`, `deli_cup`, `hotel_pan`, `squeeze_bottle`, `other`

---

</section>
<section id="technique_vocabulary">
## Technique Vocabulary by Action Family

**All valid `action.techniqueId` values, organized by `action.family`.** These technique names are aligned with training data and operational terminology.

### PREP Techniques (17)
`cut`, `drain`, `open_kit`, `open_pack`, `open_pouch`, `remove_foil`, `scrape`, `smash_open`, `split_bun`, `massage`, `remove_lid`, `squeeze`, `crush`, `make_well`, `peel`, `pat_dry`, `flip`

**Common tools:** hand, viper, utility_knife, bench_scraper, spatula, tongs

### HEAT Techniques (7)
`clamshell_grill`, `fry`, `press`, `toast`, `turbo`, `waterbath`, `microwave`

**Common tools:** tongs, mini_tong, fry_basket, paddle, spatula, hand

**Note:** Some technique names overlap with equipment names (e.g., "waterbath", "turbo") - this is intentional for training consistency.

### TRANSFER Techniques (5)
`pass`, `place`, `lift_fold`, `pizza_slide`, `remove_from_pan`

**Common tools:** hand, tongs, spatula, paddle

**Note:** TRANSFER steps are usually derived automatically from material flow. See H38 rule.

### COMBINE Techniques (5)
`fold`, `shake`, `stir`, `toss`, `mix`

**Common tools:** spatula, spoon, tongs, hand, whisk

### ASSEMBLE Techniques (7)
`roll`, `spread`, `sprinkle`, `tear_and_place`, `pizza_sprinkle`, `shingle`, `dots`

**Common tools:** hand, spatula, spoon, tongs, squeeze_bottle, shaker

### PORTION Techniques (11)
`divide`, `drizzle`, `portion`, `pour`, `spray`, `pinch`, `fill`, `spiral_pour`, `line_pour`, `dollops`, `pizza_cut`

**Common tools:** spoodle_2oz (and other spoodles), squeeze_bottle, ladle, spoon, hand, pizza_wheel

### PACKAGING Techniques (5)
`cover`, `lid`, `sleeve`, `wrap`, `sticker`

**Common tools:** hand

### OTHER Techniques (3)
`butter_wheel`, `squeege`, `hot_held`

**Common tools:** butter_wheel, other, hand

**To see techniques for a specific action family via CLI:**
```bash
lb techniques --family PREP
lb techniques --family HEAT
```

---

</section>
<section id="station_equipment_relationships">
## Station & Equipment Relationships

**Understanding station-to-equipment mapping is critical for H36, H37, and H42 validation rules.**

### Station Categories

**Hot Side Equipment Stations:**
- `fryer` - Deep fryer station
- `waterbath` - Sous vide waterbath station
- `turbo` - Turbo Chef oven station
- `toaster` - Toaster station
- `clamshell_grill` - Clamshell grill station
- `pizza` - Pizza station (has stretch_table, cut_table sublocations)
- `microwave` - Microwave station

**Cold Side Work Areas:**
- `garnish` - Garnish/assembly station (has cold_rail, dry_rail, work_surface)
- `speed_line` - Speed line assembly (has cold_rail, dry_rail, work_surface)
- `prep` - Prep station

**Expo:**
- `expo` - Final handoff station (has window_shelf, work_surface)

**Vending:**
- `vending` - Vending machine station

**Fallback:**
- `other` - Catch-all for unclassified stations

### Equipment Classification (Unique vs Shared)

**This determines when `stationId` is required on steps with equipment.**

#### Unique Equipment (stationId auto-derived - H36)

These equipment types are available at **only one station**, so `stationId` can be inferred:

| Equipment | Auto-derived Station |
|-----------|---------------------|
| `fryer` | `fryer` |
| `clamshell_grill` | `clamshell_grill` |
| `pizza_oven` | `pizza` |
| `pizza_conveyor_oven` | `pizza` |
| `vending` | `vending` |

**Rule:** When step uses unique equipment, you don't need to specify `stationId` (it's auto-derived).

#### Shared Equipment (stationId REQUIRED - H37)

These equipment types are available at **multiple stations**, so `stationId` MUST be explicitly specified:

| Equipment | Available At Stations |
|-----------|----------------------|
| `waterbath` | waterbath, pizza, speed_line |
| `turbo` | turbo, speed_line |
| `toaster` | toaster, clamshell_grill, garnish |
| `press` | garnish, speed_line |
| `microwave` | microwave, speed_line |
| `hot_box` | fryer, waterbath, turbo, pizza, microwave, speed_line |
| `hot_well` | speed_line |
| `steam_well` | speed_line |
| `sauce_warmer` | pizza, speed_line |

**Rule:** When step uses shared equipment, you MUST specify `stationId` to clarify which station has the equipment.

**Example:**
```json
{
  "equipment": { "applianceId": "waterbath" },
  "stationId": "waterbath"  // REQUIRED because waterbath is at multiple stations
}
```

### Sublocation-to-Station Compatibility (H32)

**Valid sublocation types per station.** Violating these causes H32 errors.

| Sublocation | Valid At Stations |
|-------------|-------------------|
| `work_surface` | All stations |
| `equipment` | All stations (when equipment is present) |
| `cold_rail` | fryer, waterbath, turbo, toaster, clamshell_grill, pizza, garnish, speed_line, prep |
| `dry_rail` | fryer, waterbath, turbo, toaster, clamshell_grill, pizza, garnish, speed_line, prep |
| `cold_storage` | fryer, waterbath, turbo, toaster, clamshell_grill, pizza, garnish, speed_line, prep |
| `packaging` | fryer, waterbath, turbo, toaster, clamshell_grill, pizza, garnish, speed_line, prep, other |
| `kit_storage` | garnish, other |
| `window_shelf` | expo, other |
| `stretch_table` | pizza (station-specific) |
| `cut_table` | pizza (station-specific) |
| `freezer` | fryer (station-specific) |

**Common patterns:**
- HEAT steps at equipment → `workLocation.type = "equipment"`
- Most prep/assembly work → `workLocation.type = "work_surface"`
- Final handoff → `workLocation.type = "window_shelf"` (at expo station)

### Decision Tree for Station & Equipment

**When authoring a HEAT step:**

```
IF equipment is unique (fryer, clamshell_grill, pizza_oven, pizza_conveyor_oven, vending):
  → Set equipment.applianceId
  → stationId will be auto-derived (don't specify)

ELSE IF equipment is shared (waterbath, turbo, toaster, press, microwave, hot_box, etc.):
  → Set equipment.applianceId
  → MUST set stationId to clarify which station (H37 enforces this)

ELSE IF no equipment (non-HEAT step):
  → Set stationId based on where work happens (garnish, prep, expo, etc.)
  → H42 enforces stationId when location is ambiguous
```

**Common mistakes to avoid:**
- Using `cold_rail` as `step.workLocation` (it's a material source, not a work location - see H40)
- Omitting `stationId` for shared equipment (H37 violation)
- Using station-specific sublocations at wrong stations (H32 violation)

---

</section>
<section id="pre_flight_checklist_before_generating_json">
## Pre-flight Checklist (BEFORE Generating JSON)

Run through this checklist mentally for EVERY step before writing JSON:

### 1. Action Family Requirements

**Valid ActionFamily values:** `PREP`, `HEAT`, `TRANSFER`, `COMBINE`, `ASSEMBLE`, `PORTION`, `CHECK`, `PACKAGING`, `OTHER`

| Action Family | REQUIRED Fields | Ask If Missing |
|--------------|-----------------|----------------|
| **HEAT** | `equipment.applianceId`, `time` OR `notes` | "What equipment? How long? Active or passive cooking?" |
| **PREP** | `action.techniqueId` OR `notes` | "What technique (dice, slice, open, wash)?" |
| **PORTION** | `quantity` (with `value > 0`), OR `notes` | "What amount? What unit? What tool (spoodle, scale)?" |
| **PACKAGING** | `container` OR packaging `target` | "What container/packaging for handoff?" |
| **TRANSFER** | *Derived-only* | "Do not author TRANSFER steps — derive from material flow." |
| **ASSEMBLE** | `notes` (describe assembly) | "What are you assembling? Into what?" |
| **COMBINE** | `notes` (describe what's being combined) | "What ingredients are being combined?" |
| **CHECK** | `notes` (describe what's being checked) | "What quality check is performed?" |
| **OTHER** | `notes` (describe the action) | "What's happening in this step?" |

**CRITICAL: Every step MUST have a technique.**

| Source | Technique Assignment |
|--------|---------------------|
| **CSV "Technique" column present** | Use that value directly (training-aligned vocabulary) |
| **Derived TRANSFER steps** | Auto-assign `action.techniqueId = "transfer"` |
| **No CSV Technique column** | Ask user or use action family default |

**Never leave `action.techniqueId` empty.** The technique vocabulary is defined in `config/techniques.config.ts` and includes:
- PREP techniques: cut, drain, open_kit, open_pack, open_pouch, smash_open, etc.
- HEAT techniques: fry, waterbath, turbo, clamshell_grill, toast, press, microwave
- TRANSFER techniques: transfer, pass, place
- PORTION techniques: portion, pour, drizzle, sprinkle, fill, etc.
- ASSEMBLE techniques: spread, roll, fold, tear_and_place, etc.
- PACKAGING techniques: lid, wrap, sleeve, sticker, cover
- COMBINE techniques: mix, stir, toss, shake, fold

### 2. Conditional Requirements

| Condition | REQUIRED Field | Ask If Missing |
|-----------|---------------|----------------|
| `prepType: "pre_service"` | `storageLocation` | "Where is this stored after prep?" |
| `bulkPrep: true` | Must have `prepType: "pre_service"` | "This is bulk prep — where does it go?" |
| Merge step (multiple inputs) | `input[].role` ("base" or "added") | "Which input is the base, which are added?" |
| 1:1 transformation | `assembly.lineage.evolvesFrom` | "What assembly does this evolve from?" |

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
| `quantity: { value: 0 }` | `quantity: { value: 2, unit: "oz" }` | `value` must be > 0 |
| `input: [{ source: {...} }]` | `input: [{ source: {...}, from: {...} }]` | Assembly refs need `from`/`to` |

### 4. Valid Enum Values

**GroupingId** (kitchen area - 3 values):
`hot_side`, `cold_side`, `vending`

**StationId** (equipment/work area):
- Hot Side equipment: `fryer`, `waterbath`, `turbo`, `toaster`, `clamshell_grill`, `pizza`, `microwave`
- Cold Side work areas: `garnish`, `speed_line`, `prep`
- Expo: `expo`
- Vending: `vending`
- Backwards compatibility: `hot_side`, `cold_side` (legacy values, use `groupingId` for new builds)
- Fallback: `other`

**ApplianceId** (for `equipment.applianceId`):
`turbo`, `fryer`, `waterbath`, `toaster`, `salamander`, `clamshell_grill`, `press`, `induction`, `conveyor`, `hot_box`, `hot_well`, `rice_cooker`, `pasta_cooker`, `pizza_oven`, `pizza_conveyor_oven`, `steam_well`, `sauce_warmer`, `other`

**ToolId**:
`hand`, `tongs`, `mini_tong`, `paddle`, `spatula`, `spoon`, `spoodle_1oz`, `spoodle_2oz`, `spoodle_3oz`, `spoodle_5oz`, `spoodle_6oz`, `spoodle_8oz`, `fry_basket`, `squeeze_bottle`, `shaker`, `viper`, `scale`, `bench_scraper`, `utility_knife`, `whisk`, `ladle`, `pizza_wheel`, `butter_wheel`, `scissors`, `pan_grabber`, `avocado_knife`, `other`

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

</section>
<section id="structural_validation_proactively_flag_issues">
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

</section>
<section id="enrichment_checklist_after_hard_rules_pass">
## Enrichment Checklist (After Hard Rules Pass)

For EVERY step, ensure these fields are populated:

- [ ] `groupingId` — What kitchen area? (hot_side, cold_side, vending) - auto-derived if not set
- [ ] `stationId` — What equipment/work area? (fryer, waterbath, garnish, expo, etc.)
- [ ] `cookingPhase` — What phase? (PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS)
- [ ] `toolId` — What tool? (hand, tongs, spoodle_2oz, viper, scale, etc.)
- [ ] `instruction` — Human-readable description of the step
- [ ] `notes` — Original language or clarifications (preserve user's words)

### Grouping Inference (auto-derived if not set)

- HEAT steps → `hot_side`
- ASSEMBLE/PORTION → `cold_side`
- Vending PACKAGING → `vending`
- Default fallback → `cold_side`

### Station Derivation Model

**Two-layer model:** Builds have a canonical authored layer (what we store) and a derived per-HDR view (what the resolver produces for specific hardware configurations).

**Station derivation from equipment:**

The CLI auto-derives `stationId` from `equipment.applianceId` when possible. This happens during normalization:

| Equipment Type | stationId Behavior |
|---------------|-------------------|
| **Unique equipment** (fryer, clamshell_grill, pizza_oven, pizza_conveyor_oven, vending) | Auto-derived — no need to specify stationId |
| **Shared equipment** (waterbath, turbo, toaster, press, microwave, hot_box, hot_well, steam_well, sauce_warmer) | **Required** — must specify stationId because equipment is at multiple stations |
| **No equipment** (garnish, prep, expo, speed_line) | **Required** — must specify stationId |

**When to ask vs. infer:**

- Unique equipment → Don't ask about station, it's auto-derived
- Shared equipment → Ask: "Which station has the {equipment}?"
- Non-equipment stations → Ask: "Which station?" (garnish, prep, expo, speed_line)

**Validation rules:**

- **H36:** Step requires stationId OR unique equipment (to derive from)
- **H37:** Shared equipment requires explicit stationId

**Note:** The shared/unique equipment classification is config-driven from `config/stations.config.ts`. See `EQUIPMENT_TO_STATIONS` for the source of truth.

### Phase Inference Heuristics

- PREP → `PRE_COOK`
- HEAT → `COOK`
- TRANSFER after heat → `POST_COOK`
- ASSEMBLE/COMBINE near plating → `ASSEMBLY`
- PACKAGING → `PASS`

### Tool Assignment (IMPORTANT)

**Always assign `toolId` when the tool is mentioned or can be inferred.** Tool data is valuable for training and operational analysis.

**Extract tools from notes/instructions:** If the input mentions a tool (e.g., "Tool: 8 oz Spoodle" in notes), map it to the appropriate `toolId` and set it on the step.

**Tool mapping patterns:**

| Text Pattern | `toolId` |
|--------------|----------|
| "hand", "by hand" | `hand` |
| "tongs", "tong" | `tongs` |
| "mini tong" | `mini_tong` |
| "spoodle X oz", "X oz spoodle" | `spoodle_Xoz` (e.g., `spoodle_2oz`, `spoodle_8oz`) |
| "spoon", "disher" | `spoon` |
| "spatula" | `spatula` |
| "paddle" | `paddle` |
| "fry basket", "basket" | `fry_basket` |
| "squeeze bottle" | `squeeze_bottle` |
| "shaker" | `shaker` |
| "viper", "bag cutter" | `viper` |
| "scale", "weigh" | `scale` |
| "bench scraper" | `bench_scraper` |
| "utility knife", "knife" | `utility_knife` |
| "whisk" | `whisk` |
| "ladle" | `ladle` |
| "pizza wheel", "pizza cutter" | `pizza_wheel` |
| "butter wheel" | `butter_wheel` |
| "scissors" | `scissors` |
| "pan grabber" | `pan_grabber` |
| "avocado knife" | `avocado_knife` |
| Unknown/unspecified | `other` |

**Common defaults by action family:**

| Action Family | Default Tool | When to Override |
|--------------|--------------|------------------|
| PREP (retrieve) | `hand` | Unless specific tool mentioned |
| HEAT | `hand` or `tongs` | `fry_basket` for frying, `paddle` for stirring |
| PORTION | Based on portion size | Spoodles for liquids/soft items, `hand` for solid items |
| ASSEMBLE | `hand` | Unless spreading (spatula) or portioning (spoodle) |
| PACKAGING | `hand` | Unless sealing (scissors) or cutting (utility_knife) |

**When `notes` contains tool info:**
1. Parse the tool name from notes
2. Map to valid `toolId`
3. Set `toolId` on the step
4. Keep the original text in `notes` for reference

---

</section>
<section id="time_sanity_check">
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

</section>
<section id="csv_spreadsheet_column_mapping">
## CSV/Spreadsheet Column Mapping

When user pastes CSV data, map columns to schema fields:

| CSV Column | Schema Field | Notes |
|------------|--------------|-------|
| Technique | `action.techniqueId` | ALWAYS use CSV Technique value - training-aligned vocabulary |
| Station | `stationId` | Normalize to enum values |
| Equipment | `equipment.applianceId` | Normalize to enum values |
| Cook Time (s) | `time.durationSeconds` | Also set `time.isActive` |
| Active vs Passive | `time.isActive` | true = active, false = passive |
| Tool | `toolId` | Normalize to enum values |
| Qty | `quantity.value` | Also need `quantity.unit` |
| Location | See "CSV Location Column Interpretation" section below | Context-dependent: FROM for most steps, TO for cook steps, derives transfers |
| Phase | `cookingPhase` | Normalize to enum values |
| Component Name | `target.name` with `target.type: "free_text"` | |
| Item/Packaging | `container.name` or `target` (if packaging) | |

---

</section>
<section id="csv_location_interpretation">
## CSV Location Column Interpretation (CRITICAL)

**The "Location" column in the test CSV is context-dependent and does NOT directly map to `step.sublocation`.**

Shannon's CSV uses "Location" to encode **material flow** (where components come FROM or go TO), not where the work happens.

### Location Column Interpretation Rules

| CSV Location Value | Step Context | Meaning | Schema Mapping |
|-------------------|--------------|---------|----------------|
| **"Cold Storage"** | Non-cook step | Component retrieved FROM cold storage | `input[].from.sublocation.type = "cold_storage"` |
| **"Cold Rail"** | Non-cook step | Component retrieved FROM cold rail | `input[].from.sublocation.type = "cold_rail"` |
| **"Dry Rail"** | Non-cook step | Component retrieved FROM dry rail | `input[].from.sublocation.type = "dry_rail"` |
| **"Kit"** | Non-cook step | Component retrieved FROM kit | `input[].from.sublocation.type = "kit_storage"` |
| **"packaging"** | Non-cook step | Packaging retrieved FROM packaging storage | `input[].from.sublocation.type = "packaging"` |
| **Equipment name** (Waterbath, Fryer, Turbo, Press) | HEAT/Cook step | Placing INTO equipment (destination) | `step.sublocation.type = "equipment"`, `equipment.applianceId = [equipment]` |
| **"From [Station] Station"** | Any step | Receiving FROM another station | Derives TRANSFER step with `from.stationId = [station]` |
| **"n/a"** | Any step | No explicit retrieval; work at current station | `step.sublocation.type = "work_surface"` |

### Critical Distinction

- **CSV "Location" column** = Material flow SOURCE (FROM) or DESTINATION (TO)
- **Schema `step.sublocation`** = Where the WORK happens (always work_surface or equipment for non-transfer steps)

### Sublocation Inference Logic

```
IF step.action.family == "HEAT" AND equipment specified:
  step.sublocation.type = "equipment"

ELSE IF CSV Location == "n/a":
  step.sublocation.type = "work_surface"

ELSE IF CSV Location is a storage/rail name (Cold Storage, Cold Rail, Dry Rail, Kit):
  step.sublocation.type = "work_surface"  # Work happens at work surface
  input[].from.sublocation.type = [CSV Location value]  # Material comes FROM this location

ELSE IF CSV Location == "packaging":
  step.sublocation.type = "work_surface"  # Retrieving packaging happens at work surface
  input[].from.sublocation.type = "packaging"
```

### Transfer Step Derivation from "From [Station] Station"

When `CSV Location = "From [Station] Station"`, this indicates a **station-to-station transfer**:

1. The CSV step is receiving material from another station
2. Derive a TRANSFER step BEFORE this step with:
   - `from.stationId = [previous station]`
   - `to.stationId = [current step station]`
   - `action.techniqueId = "transfer"`
3. Current step's sublocation = "work_surface" (where the receiving work happens)

### Examples from Test Data

**Example 1: Baked Potato Row 2**
```csv
Station=Waterbath, Phase=Pre Cook, Location="Cold Storage", Technique="Place"
```
**Interpretation:**
- Material flow: Retrieve potato FROM cold storage
- Work location: Place it at waterbath work surface (prep for cooking)
- Schema:
  - `input[].from.sublocation.type = "cold_storage"`
  - `step.stationId = "waterbath"`
  - `step.sublocation.type = "work_surface"`
  - `action.techniqueId = "place"`

**Example 2: Baked Potato Row 3**
```csv
Station=Waterbath, Phase=Cook, Location="Waterbath", Technique="Waterbath"
```
**Interpretation:**
- Material flow: Place potato INTO waterbath equipment
- Work location: At equipment (cooking happens in the equipment)
- Schema:
  - `step.stationId = "waterbath"`
  - `step.sublocation.type = "equipment"`
  - `equipment.applianceId = "waterbath"`
  - `action.techniqueId = "waterbath"`

**Example 3: Baked Potato Row 5**
```csv
Station=Garnish, Phase=Build, Location="From Waterbath Station", Technique="Open Pouch"
```
**Interpretation:**
- Derive TRANSFER step: `from.stationId = "waterbath"`, `to.stationId = "garnish"`
- Current step: Open pouch at garnish work surface
- Schema:
  - Derived TRANSFER step first
  - Then: `step.stationId = "garnish"`, `step.sublocation.type = "work_surface"`, `action.techniqueId = "open_pouch"`

**Example 4: Cheese Fries Row 8**
```csv
Station=Garnish, Phase=Build, Location="Cold Rail", Technique="place"
```
**Interpretation:**
- Material flow: Cheddar FROM cold rail
- Work location: Portioning at garnish work surface
- Schema:
  - `input[].from.sublocation.type = "cold_rail"`
  - `step.stationId = "garnish"`
  - `step.sublocation.type = "work_surface"`
  - `action.techniqueId = "place"`

---

</section>
<section id="interview_workflow">
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
</section>
<section id="build_overview_item_name">
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

</section>
<section id="xml_prompting_recommended_for_higher_adherence">
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
</section>
<section id="build_overview_cheese_fries_18_steps">
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

</section>
<section id="example_handling_the_baked_potato_csv">
## Example: Handling the Baked Potato CSV

**User pastes CSV. You should:**

### 1. Parse & Analyze

Identify structure, confidence levels, and missing data.

### 2. Show Validation Summary

```markdown
</section>
<section id="build_overview_baked_potato_14_steps">
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

</section>
<section id="cli_reference">
## CLI Reference

Run all commands using `npx tsx scripts/lb.ts <command>`.

### Core Commands

| Command | Purpose | Key Options |
|---------|---------|-------------|
| `list` | Discover builds | `--query <q>`, `--item <itemId>` |
| `get` | Read build | `<buildId>`, `--format full\|summary\|steps\|gaps` |
| `write` | Create/Replace | `--stdin`, `--file <path>` |
| `edit` | Incremental change | `<buildId>`, `--op '<json>'`, `--apply`, `--normalize` |
| `validate` | Validation & diagnostics | See below |
| `search` | Search steps | `--where <dsl>`, `--notes <regex>` |
| `rules` | Rule reference | `[ruleId]` |
| `view` | Sync viewer | `<buildId>`, `--step <stepId>` |
| `help` | Command help | `<command>` |

### `lb validate` — The Diagnostics Powerhouse

**Single build:**
```bash
lb validate <buildId>              # Basic validation
lb validate <buildId> --ops        # Include candidate EditOps for auto-fixable rules
lb validate <buildId> --gaps       # Show structural gaps
```

**Batch validation:**
```bash
lb validate --all                  # Validate all builds
lb validate --all --summary        # Portfolio health snapshot (counts, top failing rules)
lb validate --changed 15           # Validate builds modified in last 15 minutes
lb validate --all --item <itemId>  # Filter to specific itemId
```

**Watch mode (file watcher):**
```bash
lb validate watch                  # Watch for changes, auto-validate
lb validate watch --log /tmp/lb.jsonl  # Write JSONL events for agent parsing
lb validate watch --once           # Validate all once and exit (no watching)
lb validate watch --quiet          # Suppress human output (use with --log)
```

**Diff (compare builds):**
```bash
lb validate diff <buildId> --against <otherId>      # Compare two builds
lb validate diff <buildId> --against normalized     # Compare against normalized version
lb validate diff <buildId> --against /path/to.json  # Compare against file
```

### Agent Workflow

```
1. Orient:     lb validate --all --summary     # Quick portfolio health
2. Diagnose:   lb validate <buildId> --ops     # Errors + candidate fixes
3. Fix:        lb edit <id> --op '...' --apply
4. Verify:     lb validate <id>                # Confirm clean
5. Diff:       lb validate diff <id> --against normalized
6. Coordinate: lb view <id> --step <stepId>    # Sync with human reviewer
```

### Query DSL Patterns (for `lb search` and `lb edit --where`)

**Syntax:** `<field-path> <operator> <value>`

**Operators:**
- `=` - Equality
- `!=` - Inequality
- `in [...]` - Set membership (comma-separated values)
- `exists(<field>)` - Field presence check
- `NOT` - Negation

**Field paths (examples):**
- `step.action.family` - Action family enum
- `step.equipment.applianceId` - Equipment type
- `step.workLocation.type` - Work location sublocation
- `step.stationId` - Station identifier
- `step.time.durationSeconds` - Cook time
- `step.toolId` - Tool identifier
- `step.action.techniqueId` - Technique identifier

**Combining conditions:**
- Use `AND` to require all conditions
- Use `OR` for alternatives
- Group with parentheses for complex logic

**Common search patterns:**

```bash
# Find all HEAT steps
lb search --where "step.action.family = HEAT"

# Find HEAT steps without equipment
lb search --where "step.action.family = HEAT AND NOT exists(step.equipment)"

# Find HEAT steps missing time information
lb search --where "step.action.family = HEAT AND NOT exists(step.time)"

# Find steps at garnish station
lb search --where "step.stationId = garnish"

# Find steps using waterbath equipment
lb search --where "step.equipment.applianceId = waterbath"

# Find PORTION steps without quantity
lb search --where "step.action.family = PORTION AND NOT exists(step.quantity)"

# Find steps at multiple stations
lb search --where "step.stationId in [garnish, speed_line, prep]"

# Find PREP steps without technique
lb search --where "step.action.family = PREP AND NOT exists(step.action.techniqueId)"
```

### `lb edit` Operation Templates

**All edit operations use `--op` flag and require `--apply` to execute.**

#### `set_field` - Update field value for matching steps

**Basic example - Set tool for all HEAT steps:**
```bash
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = HEAT",
  "field": "step.toolId",
  "value": "tongs"
}' --apply
```

**Add equipment to HEAT steps missing it:**
```json
{
  "type": "set_field",
  "where": "step.action.family = HEAT AND NOT exists(step.equipment)",
  "field": "step.equipment",
  "value": {"applianceId": "waterbath"}
}
```

**Set workLocation for all steps without one:**
```json
{
  "type": "set_field",
  "where": "NOT exists(step.workLocation)",
  "field": "step.workLocation",
  "value": {"type": "work_surface"}
}
```

**Add time to HEAT steps:**
```json
{
  "type": "set_field",
  "where": "step.action.family = HEAT AND NOT exists(step.time)",
  "field": "step.time",
  "value": {"durationSeconds": 180, "isActive": true}
}
```

**Set stationId for shared equipment:**
```json
{
  "type": "set_field",
  "where": "step.equipment.applianceId = waterbath",
  "field": "step.stationId",
  "value": "waterbath"
}
```

#### `add_step` - Insert new step into build

```json
{
  "type": "add_step",
  "step": {
    "id": "new-step-1",
    "orderIndex": 5,
    "action": {"family": "PREP", "techniqueId": "open_pouch"},
    "workLocation": {"type": "work_surface"},
    "stationId": "garnish",
    "toolId": "hand",
    "instruction": "Open the pouch",
    "input": [],
    "output": [{"source": {"type": "in_build", "assemblyId": "output-1"}}]
  },
  "afterStepId": "step-4"
}
```

**Note:** `afterStepId` is optional. If omitted, step is appended to end.

#### `remove_step` - Delete step from build

```json
{
  "type": "remove_step",
  "stepId": "step-to-delete"
}
```

**Warning:** Removing a step with dependents will break dependencies. Fix manually or re-validate.

#### `move_step` - Reorder step

```json
{
  "type": "move_step",
  "stepId": "step-5",
  "toOrderIndex": 2
}
```

**Note:** Use `normalize_indices` after moving to clean up orderIndex sequence.

#### `add_dep` - Add dependency between steps

```json
{
  "type": "add_dep",
  "stepId": "step-5",
  "dependsOn": "step-3"
}
```

**Use case:** Making implicit dependencies explicit (e.g., assembly step must wait for cook step).

#### `remove_dep` - Remove dependency

```json
{
  "type": "remove_dep",
  "stepId": "step-5",
  "dependsOn": "step-3"
}
```

**Use case:** Breaking incorrect dependencies in parallel tracks.

#### `set_build_field` - Update build-level metadata

```json
{
  "type": "set_build_field",
  "field": "build.name",
  "value": "Baked Potato - Updated"
}
```

**Other build fields:** `build.status`, `build.version`, `build.notes`

#### `normalize_indices` - Clean up orderIndex sequence

```json
{
  "type": "normalize_indices"
}
```

**Use case:** After adding/removing/moving steps, renumber to sequential 0, 1, 2, ...

### Watch Mode for Continuous Validation

**For agent workflows, use watch mode to monitor validation state:**

```bash
# Watch for file changes and auto-validate
lb validate watch

# Write validation events to JSONL for parsing
lb validate watch --log /tmp/validation.jsonl --quiet

# Validate once and exit (no watching)
lb validate watch --once
```

**JSONL event format:**
```json
{"event": "validation_complete", "buildId": "...", "hardErrors": 0, "strongWarnings": 2}
```

**Agent workflow:**
1. Start watch mode in background with `--log`
2. Make edits using `lb edit --apply`
3. Parse JSONL events to check validation status
4. Continue editing until `hardErrors: 0`

### Batch Edit Example

**Fix multiple validation errors in one turn:**

```bash
# 1. Add equipment to HEAT steps
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = HEAT AND NOT exists(step.equipment)",
  "field": "step.equipment",
  "value": {"applianceId": "waterbath"}
}' --apply

# 2. Add quantity to PORTION steps
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = PORTION AND NOT exists(step.quantity)",
  "field": "step.quantity",
  "value": {"value": 2, "unit": "oz"}
}' --apply

# 3. Set workLocation for all steps
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "NOT exists(step.workLocation)",
  "field": "step.workLocation",
  "value": {"type": "work_surface"}
}' --apply

# 4. Normalize indices
lb edit <buildId> --op '{"type": "normalize_indices"}' --apply

# 5. Re-validate
lb validate <buildId>
```

---

</section>
<section id="recommended_authoring_loop">
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

</section>
<section id="common_validation_errors">
## Common Validation Errors & Fixes

**The top validation errors agents encounter, with fix patterns for each.** Use this section to quickly resolve issues without exploring code.

### H15: HEAT step requires equipment

**Error message:** `H15: HEAT action requires equipment (field: equipment)`

**Cause:** Step has `action.family = "HEAT"` but missing `equipment` object.

**Fix pattern:**
```bash
# Add equipment to all HEAT steps missing it
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = HEAT AND NOT exists(step.equipment)",
  "field": "step.equipment",
  "value": {"applianceId": "waterbath"}
}' --apply
```

**When to use which equipment:**
- Frying → `{"applianceId": "fryer"}`
- Sous vide cooking → `{"applianceId": "waterbath"}`
- High-speed oven → `{"applianceId": "turbo"}`
- Toasting → `{"applianceId": "toaster"}`
- Clamshell grilling → `{"applianceId": "clamshell_grill"}`
- Pressing → `{"applianceId": "press"}`
- Microwaving → `{"applianceId": "microwave"}`

### H22: HEAT step requires time or notes

**Error message:** `H22: HEAT step requires time or non-empty notes`

**Cause:** HEAT steps must specify either `time` (how long to cook) or have explanatory `notes` (if time varies).

**Fix pattern - Add time:**
```bash
# Add time to HEAT steps (example: 3 minutes active)
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = HEAT AND NOT exists(step.time)",
  "field": "step.time",
  "value": {"durationSeconds": 180, "isActive": true}
}' --apply
```

**Fix pattern - Add notes for variable times:**
```json
{
  "type": "set_field",
  "where": "step.id = step-5",
  "field": "step.notes",
  "value": "Cook time varies based on batch size"
}
```

**Time examples:**
- Frying fries: `{"durationSeconds": 210, "isActive": false}`
- Waterbath sous vide: `{"durationSeconds": 1200, "isActive": false}`
- Turbo oven: `{"durationSeconds": 60, "isActive": false}`
- Toasting: `{"durationSeconds": 30, "isActive": true}`

### H24: PORTION step requires quantity or notes

**Error message:** `H24: PORTION step requires quantity or non-empty notes`

**Cause:** PORTION steps must specify how much (quantity) or explain why quantity varies (notes).

**Fix pattern:**
```bash
# Add quantity to PORTION steps (example: 2 oz)
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.action.family = PORTION AND NOT exists(step.quantity)",
  "field": "step.quantity",
  "value": {"value": 2, "unit": "oz"}
}' --apply
```

**Common quantity patterns:**
- Spoodle portions: `{"value": 2, "unit": "oz"}`, `{"value": 3, "unit": "oz"}`
- Ladle portions: `{"value": 4, "unit": "oz"}`
- Pinch/sprinkle: `{"value": 1, "unit": "pinch"}`
- Counted items: `{"value": 3, "unit": "count"}`

### H25: PREP step requires technique or notes

**Error message:** `H25: PREP step requires techniqueId or non-empty notes`

**Cause:** PREP steps should use controlled vocabulary (`action.techniqueId`) or explain in `notes`.

**Fix pattern:**
```bash
# Add techniqueId to PREP steps
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.id = step-3",
  "field": "step.action.techniqueId",
  "value": "open_pouch"
}' --apply
```

**Common PREP techniques (see "Technique Vocabulary" section for full list):**
- Opening packages: `open_pouch`, `open_pack`, `open_kit`
- Cutting: `cut`, `split_bun`
- Cleaning: `drain`, `remove_foil`, `remove_lid`
- Processing: `smash_open`, `squeeze`, `crush`, `peel`

### H32: workLocation invalid for station

**Error message:** `H32: workLocation 'cold_rail' is not valid for station 'fryer'`

**Cause:** Step's `workLocation.type` isn't valid for the station. See "Station & Equipment Relationships" section for valid combinations.

**Common mistakes:**
- Using `cold_rail` as work location (it's a material source, use `work_surface` for work location)
- Using station-specific sublocations at wrong stations (`stretch_table` only at pizza, `freezer` only at fryer)

**Fix pattern:**
```bash
# Change invalid workLocation to work_surface
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.id = step-5",
  "field": "step.workLocation",
  "value": {"type": "work_surface"}
}' --apply
```

### H33: Invalid techniqueId

**Error message:** `H33: techniqueId 'xxx' is not in the controlled vocabulary`

**Cause:** Technique name doesn't match canonical vocabulary. See "Technique Vocabulary by Action Family" section.

**Common mismatches:**
- `"clamshell-grill"` → should be `"clamshell_grill"` (underscore not hyphen)
- `"waterbath_cook"` → should be `"waterbath"`
- `"retrieve"` → not in vocabulary, use `"place"` or describe in notes

**Fix pattern:**
```bash
# Use exact technique from vocabulary
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.id = step-3",
  "field": "step.action.techniqueId",
  "value": "clamshell_grill"
}' --apply
```

**Quick lookup:**
```bash
# See all techniques for an action family
lb techniques --family HEAT
lb techniques --family PREP
```

### H36: Step requires stationId or unique equipment

**Error message:** `H36: Step requires stationId or unique equipment (to derive from)`

**Cause:** Step doesn't have `stationId` and doesn't have unique equipment to auto-derive from.

**Fix pattern:**
```bash
# Add stationId to steps missing it
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "NOT exists(step.stationId)",
  "field": "step.stationId",
  "value": "garnish"
}' --apply
```

**Which station to use:**
- HEAT steps → Use equipment station (fryer, waterbath, turbo, etc.)
- ASSEMBLE/PORTION → `garnish` or `speed_line` (cold side assembly)
- Final handoff → `expo`
- Prep work → `prep`

### H37: Shared equipment requires stationId

**Error message:** `H37: Equipment 'waterbath' is available at multiple stations - stationId required`

**Cause:** Step uses shared equipment (waterbath, turbo, toaster, press, microwave) without explicit `stationId`.

**Shared equipment list (requires stationId):**
- `waterbath` - at: waterbath, pizza, speed_line
- `turbo` - at: turbo, speed_line
- `toaster` - at: toaster, clamshell_grill, garnish
- `press` - at: garnish, speed_line
- `microwave` - at: microwave, speed_line

**Fix pattern:**
```bash
# Add stationId to steps with waterbath
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "step.equipment.applianceId = waterbath AND NOT exists(step.stationId)",
  "field": "step.stationId",
  "value": "waterbath"
}' --apply
```

### H40: Assembly refs require locations

**Error message:** `H40: Assembly reference requires location (input[].from or output[].to)`

**Cause:** Material flow (input/output assemblies) must specify where materials come from and go to.

**Fix pattern - Add material source location:**
```json
{
  "input": [
    {
      "source": {"type": "in_build", "assemblyId": "cheese"},
      "from": {
        "stationId": "garnish",
        "sublocation": {"type": "cold_rail"}
      }
    }
  ]
}
```

**Fix pattern - Add material destination:**
```json
{
  "output": [
    {
      "source": {"type": "in_build", "assemblyId": "cooked_item"},
      "to": {
        "stationId": "waterbath",
        "sublocation": {"type": "equipment", "equipmentId": "waterbath"}
      }
    }
  ]
}
```

### H41: Steps require explicit material flow

**Error message:** `H41: Step requires at least one output (material flow)`

**Cause:** Every step must produce output (what it creates/modifies).

**Fix pattern:**
```json
{
  "type": "set_field",
  "where": "step.id = step-5",
  "field": "step.output",
  "value": [
    {
      "source": {"type": "in_build", "assemblyId": "output-assembly"},
      "to": {
        "stationId": "garnish",
        "sublocation": {"type": "work_surface"}
      }
    }
  ]
}
```

### H46: step.workLocation.type is required

**Error message:** `H46: step.workLocation.type is required`

**Cause:** Every step must specify where work happens.

**Fix pattern:**
```bash
# Set default workLocation for steps without one
lb edit <buildId> --op '{
  "type": "set_field",
  "where": "NOT exists(step.workLocation)",
  "field": "step.workLocation",
  "value": {"type": "work_surface"}
}' --apply
```

**Valid workLocation types:**
- `work_surface` - Most prep/assembly/portion work (default choice)
- `equipment` - HEAT steps (cooking in equipment)
- `window_shelf` - Expo handoff
- `packaging` - PACKAGING steps at packaging location

**Note:** Storage/rail types (`cold_rail`, `cold_storage`, `dry_rail`) are for material flow (`input[].from`), NOT work location.

### H29: Merge steps require input roles

**Error message:** `H29: Step has 2+ inputs but missing input[].role`

**Cause:** When step merges multiple inputs, must specify which is `base` and which is `added`.

**Fix pattern - Edit JSON directly:**
```json
{
  "input": [
    {"source": {"assemblyId": "tortilla"}, "role": "base", "from": {...}},
    {"source": {"assemblyId": "cheese"}, "role": "added", "from": {...}}
  ]
}
```

**Rule:** Exactly one input must be `"role": "base"`, others must be `"role": "added"`.

### H8: Missing dependsOn reference

**Error message:** `H8: dependsOn references unknown step 'xxx'`

**Cause:** Step's `dependsOn` array references a step ID that doesn't exist.

**Fix options:**

1. **Remove invalid dependency:**
```json
{
  "type": "remove_dep",
  "stepId": "step-5",
  "dependsOn": "step-999"
}
```

2. **Create the referenced step** (if it's missing)

3. **Fix the step ID** (if typo in dependency reference)

---

</section>
<section id="validation_rules_quick_reference">
## Validation Rules Quick Reference

Use `lb rules` to see all rules. Key ones to remember:

**Hard Errors (block publish):**

| Rule | Requirement |
|------|-------------|
| H1 | Every step needs `action.family` (valid enum) |
| H3 | `time.durationSeconds` > 0, `time.isActive` is boolean |
| H6 | Published builds need at least 1 step |
| H7 | `step.id` must be unique |
| H8/H9 | `dependsOn` refs must exist, no cycles |
| H10 | `quantity.value` > 0 |
| H15 | HEAT → requires `equipment.applianceId` |
| H16 | PACKAGING → requires `container` or packaging target |
| H17 | `prepType: "pre_service"` → requires `storageLocation` |
| H18 | `bulkPrep: true` → requires `prepType: "pre_service"` |
| H22 | HEAT → requires `time` OR `notes` |
| H24 | PORTION → requires `quantity` OR `notes` |
| H25 | PREP → requires `techniqueId` OR `notes` |
| H33 | `action.techniqueId` must be in the controlled vocabulary |
| H38 | TRANSFER steps are derived-only (do not author) |
| H39 | DEPRECATED - Steps don't have from/to; only assemblies do (H40) |
| H40 | Assembly refs require locations (sublocation required) |
| H41 | Steps require explicit material flow (output required) |
| H42 | StationId required when location is ambiguous |
| H43 | Material flow continuity required for published builds (no teleports) |
| H29 | Merge steps (2+ inputs) → requires `input[].role` with exactly one "base" |
| H30 | 1:1 transformations → requires `assembly.lineage.evolvesFrom` |
| C3 | `in_build` assembly refs must exist in `assemblies[]` |

Tip: Use `lb techniques --family PREP` (or other action families) to see valid `techniqueId` values.

**Warnings (won't block but should fix):**

| Rule | Requirement |
|------|-------------|
| H2 | `orderIndex` is derived for UX; duplicates are OK unless you need custom ordering |
| H26 | **>75% of steps should have `dependsOn` (soft warning; entry points can be parallel starts)** |
| S16a | Grouping bouncing (strong): build leaves kitchen area and returns |
| S16b | Station bouncing (soft): build leaves station and returns within same grouping |
| S12 | Published steps should set `stationId` |
| S21 | Assembly IDs should be descriptive (avoid step-based names like `step3_v1`) |
| S22 | Material flow continuity: input location should align with producer output (teleport check) |

---

</section>
<section id="build_structure">
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
      "groupingId": "hot_side",
      "stationId": "other",
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
      "groupingId": "hot_side",
      "stationId": "waterbath",
      "toolId": "hand",
      "cookingPhase": "COOK"
    },
    {
      "id": "step-3",
      "orderIndex": 2,
      "dependsOn": ["step-2"],
      "action": { "family": "TRANSFER" },
      "instruction": "Pass cooked potato to garnish station",
      "groupingId": "cold_side",
      "stationId": "pass",
      "toolId": "hand",
      "cookingPhase": "POST_COOK",
      "notes": "Transfer to garnish"
    }
  ]
}
```

**Note:**
- `groupingId` identifies the kitchen area (hot_side, cold_side, vending)
- `stationId` identifies the equipment or work area (waterbath, fryer, garnish, etc.)
- Step 1 has no `dependsOn` (it's an entry point). Steps 2 and 3 have `dependsOn` showing the sequential flow. This creates a connected DAG that the viewer can render.

---

</section>
<section id="first_time_setup">
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

</section>
<section id="viewer_integration">
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

</section>
<section id="data_location">
## Data Location

| Path | Contents |
|------|----------|
| `data/line-builds/` | Build JSON files |
| `data/validation/` | Validation output files |
| `data/checklists/` | Per-build validation checklists (created during authoring) |
| `templates/` | Checklist and question templates |

</section>
<section id="templates">
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
</section>
</agent_instructions>