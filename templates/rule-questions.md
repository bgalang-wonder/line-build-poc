# Validation Rules → Questions Reference

> **Instructions for Claude Code:** Use this reference to generate questions for the **ask questions tool**. For each rule that applies to the build, generate a question using the format and options specified below.

> **Question Types:**
> - `multiple_choice` — User selects ONE option
> - `multi_select` — User selects MULTIPLE options  
> - `free_text` — User types a value (use sparingly)
> - `yes_no` — Simple yes/no confirmation

---

## Hard Rules (H1-H25)

### H1 — Every Step Has ActionFamily

**Applies to:** All steps

**Required:** `action.family` must be one of: `PREP`, `HEAT`, `TRANSFER`, `COMBINE`, `ASSEMBLE`, `PORTION`, `CHECK`, `PACKAGING`, `OTHER`

**Questions:**
- "What type of action is this? (prep, heat, portion, assemble, transfer, vend)"
- "Is this heating, prepping, portioning, assembling, or handing off?"

**Inference heuristics:**
- "cook", "heat", "warm", "fry", "bake" → HEAT
- "cut", "dice", "slice", "wash", "open" → PREP
- "portion", "scoop", "weigh", "measure" → PORTION
- "place", "add", "top", "layer" → ASSEMBLE
- "pass", "move", "transfer" → TRANSFER
- "bag", "package", "lid", "wrap" → PACKAGING
- "mix", "combine", "fold", "stir" → COMBINE

---

### H2 — OrderIndex Unique Within Scope

**Applies to:** All steps

**Required:** `orderIndex` is unique per `trackId` (or build-wide if no tracks)

**Questions:**
- "What order do these steps happen in?"
- "Can any of these steps happen in parallel?" (if yes, may need different tracks)

**Auto-assign:** Usually sequential (0, 1, 2...). Ask if gaps or parallels detected.

---

### H6 — Published Builds Need Steps

**Applies to:** Build

**Required:** At least 1 step if `status: "published"`

**Questions:**
- (Only if empty) "There are no steps — what should happen in this build?"

---

### H7 — Step IDs Unique

**Applies to:** Build

**Required:** No duplicate `step.id` values

**Auto-assign:** Generate unique IDs like `step-1`, `step-2`, etc.

---

### H8 — DependsOn References Exist

**Applies to:** Steps with `dependsOn`

**Required:** Every ID in `dependsOn` must reference an existing step

**Questions:**
- "You mentioned step X depends on Y — is Y the correct step ID?"

---

### H9 — No Circular Dependencies

**Applies to:** Steps with `dependsOn`

**Required:** Dependency graph must be acyclic (DAG)

**Questions:**
- "I see a potential cycle: A → B → C → A. Is this correct?" (should never be)

---

### H10 — Quantity Value > 0

**Applies to:** Steps with `quantity`

**Required:** `quantity.value > 0`

**Questions:**
- "What's the quantity? (must be greater than 0)"

---

### H15 — HEAT Steps Require Equipment ⚠️ CRITICAL

**Applies to:** Steps where `action.family === "HEAT"`

**Required:** `equipment.applianceId` must exist

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Step [N] ([description]) - What equipment?"
Options:
  - turbo (Turbo oven / rapid cook)
  - fryer (Deep fryer)
  - waterbath (Sous vide / retherm)
  - toaster (Toaster / conveyor toaster)
  - salamander (Broiler / salamander)
  - clamshell_grill (Flat top / contact grill)
  - press (Panini press)
  - induction (Induction burner)
  - hot_well (Hot holding well)
  - other (Other - will ask for details)
```

**Common mappings:**
- "turbo oven" → `turbo`
- "deep fryer" → `fryer`
- "sous vide" / "retherm" → `waterbath`
- "toaster" / "conveyor toaster" → `toaster`
- "broiler" → `salamander`
- "panini press" → `press`
- "flat top" / "grill" → `clamshell_grill`

---

### H16 — PACKAGING Steps Require Container ⚠️ CRITICAL

**Applies to:** Steps where `action.family === "PACKAGING"`

**Required:** `container` OR `target.type === "packaging"`

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Step [N] (PACKAGING [description]) - Container/packaging?"
Options:
  - bag (Bag)
  - clamshell (Clamshell container)
  - cup (Cup)
  - deli_cup (Deli cup)
  - bowl (Bowl)
  - tray (Tray)
  - foil (Foil wrap)
  - other (Other - will ask for details, e.g., "box" stored in container.name)
```

**Note:** If user says "box", use `container.type: "other"` and store "box" in `container.name`.

---

### H17 — Pre-Service Steps Require StorageLocation ⚠️ CRITICAL

**Applies to:** Steps where `prepType === "pre_service"`

**Required:** `storageLocation.type` must exist

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Step [N] (pre-service [description]) - Where is this stored?"
Options:
  - cold_storage (Walk-in / reach-in fridge)
  - cold_rail (Cold rail at station)
  - dry_rail (Dry storage / shelf at station)
  - freezer (Freezer)
  - ambient (Room temp / counter)
  - hot_hold_well (Hot holding / steam table)
  - kit (Pre-assembled kit)
  - other (Other location)
```

**Common mappings:**
- "walk-in" / "reach-in" / "fridge" → `cold_storage`
- "cold rail" / "line" / "station rail" → `cold_rail`
- "dry storage" / "shelf" → `dry_rail`
- "freezer" → `freezer`
- "room temp" / "counter" → `ambient`
- "hot holding" / "steam table" → `hot_hold_well`

---

### H18 — BulkPrep Requires Pre-Service

**Applies to:** Steps where `bulkPrep === true`

**Required:** `prepType === "pre_service"`

**Questions:**
- "This is marked as bulk prep — confirm this is done during morning prep (pre-service)?"
- "Where is the bulk prep stored?" (triggers H17)

---

### H22 — HEAT Steps Require Time OR Notes ⚠️ CRITICAL

**Applies to:** Steps where `action.family === "HEAT"`

**Required:** `time` object OR non-empty `notes`

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Step [N] ([description]) - Cooking style?"
Options:
  - Active (actively attending/monitoring)
  - Passive (set and wait)
```

```
Type: multiple_choice (if time provided seems unusual)
Question: "Step [N] shows [X] seconds ([Y] min) - confirm?"
Options:
  - Yes, that's correct
  - No, should be different (will ask for correct time)
```

```
Type: yes_no (if time not provided)
Question: "Step [N] - Do you know the exact cook time?"
Options:
  - Yes (will ask for time in seconds)
  - No (will capture target outcome in notes)
```

**Schema reminder:**
```json
"time": {
  "durationSeconds": 300,  // REQUIRED
  "isActive": false        // REQUIRED (true = actively cooking, false = passive/waiting)
}
```

---

### H24 — PORTION Steps Require Quantity OR Notes ⚠️ CRITICAL

**Applies to:** Steps where `action.family === "PORTION"`

**Required:** `quantity` object OR non-empty `notes`

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "PORTION steps [list steps] - What unit?"
Options:
  - oz (fluid ounces)
  - tbsp (tablespoons)
  - tsp (teaspoons)
  - count (pieces/count)
  - g (grams)
  - ml (milliliters)
  - other (will ask for details)
```

```
Type: multiple_choice
Question: "Step [N] ([description]) - Portioning tool?"
Options:
  - spoodle_1oz (1 oz spoodle)
  - spoodle_2oz (2 oz spoodle)
  - spoodle_3oz (3 oz spoodle)
  - scale (Scale)
  - hand (By hand)
  - ladle (Ladle)
  - other (Other tool)
```

**Schema reminder:**
```json
"quantity": {
  "value": 2,      // REQUIRED, must be > 0
  "unit": "oz"     // REQUIRED
}
```

---

### H25 — PREP Steps Require TechniqueId OR Notes ⚠️ CRITICAL

**Applies to:** Steps where `action.family === "PREP"`

**Required:** `action.techniqueId` OR non-empty `notes`

**Ask Questions Tool Format:**
```
Type: multi_select (for multiple PREP steps)
Question: "Which PREP steps should use a technique ID?"
Options:
  - Step [N]: [description] → use technique ID
  - Step [N]: [description] → capture in notes only
  (repeat for each PREP step)
```

```
Type: multiple_choice (per step needing technique)
Question: "Step [N] ([description]) - Technique?"
Options:
  - wash (Wash / rinse)
  - cut_diced (Dice)
  - cut_sliced (Slice)
  - cut_julienne (Julienne)
  - cut_chiffonade (Chiffonade)
  - open_pack (Open pack / bag)
  - peel (Peel)
  - grate (Grate / shred)
  - mince (Mince / fine chop)
  - portion (Pre-portion)
  - other (Other - capture in notes)
```

**Common mappings:**
- "dice" → `cut_diced`
- "slice" → `cut_sliced`
- "julienne" → `cut_julienne`
- "open pack" / "open bag" → `open_pack`
- "grate" / "shred" → `grate`
- "mince" / "fine chop" → `mince`
- "wash" / "rinse" → `wash`

**If technique doesn't fit standard vocabulary:**
- Capture the original language in `notes`
- Example: "smash open" → `notes: "Smash potato open by hand"`

---

## Composition Rules (C1-C3)

### C1 — RequiresBuilds Unique and Not Self-Referential

**Applies to:** Builds with `requiresBuilds`

**Questions:**
- "Does this build use any pre-prepped components from other builds?"
- "What's the item ID of the component build?"

---

### C2 — External Build Consumes Must Be Declared

**Applies to:** Steps that consume from external builds

**Required:** If `step.input[].source.type === "external_build"`, the `itemId` must be in `build.requiresBuilds`

**Questions:**
- "This step uses a component from another build — what's the item ID?"
- "I'll add it to the requiresBuilds list."

---

### C3 — In-Build Artifact Refs Must Exist

**Applies to:** Steps that consume in-build artifacts

**Required:** If `step.input[].source.type === "in_build"`, the `artifactId` must exist in `build.artifacts`

**Auto-check:** Verify artifact IDs exist before writing.

---

## Structural Validation Questions

### Parallel Tracks

**Detection:** Different `trackId` values, or station names like "Ketchup" vs "Default"

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Tracks detected: [Track A] (steps X-Y) and [Track B] (steps Z-W). How do they relate?"
Options:
  - Merge at expo (both go to same handoff)
  - Separate handoff (independent deliveries)
  - Track B depends on Track A (sequential)
  - Track A depends on Track B (sequential)
  - Other relationship (will describe)
```

```
Type: yes_no
Question: "Should there be cross-track dependencies?"
Options:
  - Yes (will ask which steps depend on which)
  - No (tracks are independent)
```

---

### Missing Retrieval

**Detection:** HEAT/PORTION/PACKAGING step with no prior PREP/retrieval step for that component

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Step [N] ([action] [component]) - No retrieval step found. Where does it come from?"
Options:
  - Add retrieval step from cold_storage
  - Add retrieval step from cold_rail
  - Retrieval is implicit in this step
  - Component comes from previous step
  - Other (will describe)
```

---

### Missing Handoff

**Detection:** Last step isn't PACKAGING or TRANSFER to expo/pass

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Build ends at Step [N] ([description]). How is final handoff done?"
Options:
  - Add PACKAGING step to expo
  - Add TRANSFER step to pass window
  - Last step IS the handoff (update action family)
  - No handoff needed (prep build only)
```

---

### Unusual Ordering

**Detection:** Steps that violate typical kitchen flow (Retrieve → Prep → Cook → Assemble → Package → Pass)

**Ask Questions Tool Format:**
```
Type: yes_no
Question: "Step [N] ([action A]) comes before Step [M] ([action B]). Usually [B] happens before [A]. Is this intentional?"
Options:
  - Yes, this order is correct
  - No, should be reversed
```

---

### Station Transitions

**Detection:** Steps at different stations with no TRANSFER between them

**Ask Questions Tool Format:**
```
Type: multiple_choice
Question: "Steps go from [station A] to [station B] with no transfer. What happens?"
Options:
  - Add TRANSFER step between them
  - Same person works both stations (no transfer needed)
  - Item is passed implicitly (capture in notes)
```

---

## Quick Reference: Questions by Action Family

| Family | Rule | Question Type | Options |
|--------|------|---------------|---------|
| **HEAT** | H15 | `multiple_choice` | turbo, fryer, waterbath, toaster, salamander, etc. |
| **HEAT** | H22 | `multiple_choice` | Active, Passive |
| **PREP** | H25 | `multi_select` | technique ID vs notes (per step) |
| **PREP** | H25 | `multiple_choice` | wash, cut_diced, cut_sliced, open_pack, etc. |
| **PORTION** | H24 | `multiple_choice` | oz, tbsp, tsp, count, g, ml |
| **PORTION** | - | `multiple_choice` | spoodle_1oz, spoodle_2oz, scale, hand, etc. |
| **PACKAGING** | H16 | `multiple_choice` | bag, clamshell, cup, bowl, tray, etc. |
| **pre_service** | H17 | `multiple_choice` | cold_storage, cold_rail, dry_rail, freezer, etc. |

## Quick Reference: Structural Questions

| Issue | Question Type | Options |
|-------|---------------|---------|
| Parallel tracks | `multiple_choice` | Merge at expo, Separate handoff, Depends on other |
| Cross-track deps | `yes_no` | Yes, No |
| Missing retrieval | `multiple_choice` | Add from cold_storage, Add from cold_rail, Implicit, etc. |
| Missing handoff | `multiple_choice` | Add PACKAGING, Add TRANSFER, Last step IS handoff, etc. |
| Unusual order | `yes_no` | Yes intentional, No reverse it |
| Station transition | `multiple_choice` | Add TRANSFER, Same person, Implicit |
