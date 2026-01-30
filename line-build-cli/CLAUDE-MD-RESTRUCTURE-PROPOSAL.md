# CLAUDE.md Restructure Proposal

## Problem Statement

Current CLAUDE.md (1597 lines) has strong content but poor information architecture for agents handling unstructured input (CSV, natural language). Key issues:

1. **CSV interpretation buried at line 646** (should be front-and-center)
2. **No clear "User gives CSV → What do I do?" workflow**
3. **Missing decision tree for "when to stop and ask questions"**
4. **Pre-flight checklist doesn't say WHEN to apply it**
5. **Over-emphasis on "CRITICAL" (6+ times) dilutes importance**

## Proposed Structure (Optimized for Unstructured Input)

### Part 1: Mission & Workflows (Lines 1-250)

**Goal:** Agent immediately understands role and common workflows

```markdown
1. Your Role: Validation Interviewer (NEW - 20 lines)
   - Mission: Help users build CORRECT line builds, not just valid ones
   - Golden rules: Never guess, ask questions, validate early
   - Two validation phases: Structural (flow) → Schema (fields)

2. Common Workflows (NEW - 80 lines)

   A. CSV Import Workflow (40 lines)
      - Pre-validation: Required columns check
      - Row-by-row interpretation with decision points
      - When to stop and ask: Decision tree
      - Post-processing: Generate draft, validate, iterate

   B. Natural Language to Build (20 lines)
      - Extract: Steps, dependencies, locations
      - Clarify: Ambiguous stations, times, quantities
      - Draft: Generate JSON with notes for uncertainties

   C. Validation Error Fixing (20 lines)
      - Read validation output as authoritative to-do list
      - Fix 3-5 errors at a time, show progress
      - Re-validate until publishable

3. CSV Interpretation Guide (MOVED from line 646 - 120 lines)
   - Column mapping table (concise version)
   - CSV "Location" column interpretation (CRITICAL)
     - Context-dependent mapping table
     - Examples: Cold Storage, Equipment names, "From [Station]"
     - Inference logic flowchart
   - CSV "Technique" column → always use directly
   - Common CSV patterns and their meanings

4. Startup Protocol (20 lines - simplified)
   - Start viewer
   - Ask user: New build / Edit existing / Review / Explore
```

**Why this order?**
- Agent learns mission FIRST
- Agent sees "CSV comes in → Do this" BEFORE deep-diving into rules
- CSV interpretation is accessible (line ~150) not buried (line 646)

---

### Part 2: Pre-flight Validation (Lines 250-450)

**Goal:** Checklist for EVERY step before generating JSON

```markdown
5. Pre-flight Checklist - When to Apply (NEW - 30 lines)

   **Apply BEFORE generating JSON for ANY step:**
   - When processing CSV row → Run through action family checks
   - When user describes step in natural language → Validate required fields
   - When uncertain about field value → Add to `notes`, ask user

   **Stop and Ask Questions If:**
   - Action family requires field (e.g., HEAT needs equipment)
   - CSV Location is ambiguous (e.g., "Kitchen" - which station?)
   - Multiple valid interpretations (e.g., "Cut" - dice/slice/julienne?)
   - Time/quantity missing for HEAT/PORTION
   - Merge step without clear base/added roles

6. Action Family Requirements (CURRENT - 80 lines)
   - Table of required fields per family
   - Questions to ask if missing
   - Technique requirements (EVERY step needs one)

7. Schema Field Gotchas (CURRENT - 40 lines)
   - Common mistakes table
   - Correct field names

8. Valid Enum Values (CURRENT - 60 lines)
   - GroupingId, StationId, ApplianceId, ToolId
   - SublocationId, CookingPhase

9. Decision Tree: "Should I Ask?" (NEW - 40 lines)

   **For each CSV row / natural language step, check:**

   ```
   ┌─ HEAT step?
   │  ├─ Equipment specified? NO → ASK: "What equipment?"
   │  ├─ Time specified? NO → ASK: "How long? Active or passive?"
   │  └─ Technique specified? NO → ASK: "Waterbath/Fry/Turbo/Press?"
   │
   ┌─ PREP step?
   │  ├─ Technique specified? NO → ASK: "Cut/Dice/Slice/Open/Wash?"
   │  └─ CSV Location = storage name? → SET input[].from, step.sublocation=work_surface
   │
   ┌─ PORTION step?
   │  ├─ Quantity specified? NO → ASK: "How much? What unit?"
   │  └─ Tool specified? NO → ASK: "Spoodle size? Scale? Squeeze bottle?"
   │
   ┌─ CSV Location = "From [Station] Station"?
   │  └─ YES → DERIVE TRANSFER step, SET current step sublocation=work_surface
   │
   ┌─ CSV Location = equipment name (Waterbath, Fryer)?
   │  └─ YES → SET step.sublocation=equipment, equipment.applianceId=[name]
   │
   ┌─ CSV Location = storage name (Cold Storage, Cold Rail)?
   │  └─ YES → SET input[].from.sublocation.type=[name], step.sublocation=work_surface
   │
   ┌─ StationId ambiguous (e.g., "garnish" or "prep")?
   │  └─ YES → ASK: "Which station? Garnish line or prep area?"
   ```

10. Common CSV Ambiguities → Questions (NEW - 50 lines)

    | CSV Pattern | Ambiguity | Ask User |
    |-------------|-----------|----------|
    | Location = "Kitchen" | Which station? | "Where in the kitchen? Garnish/Prep/Fryer/Waterbath?" |
    | Location = "Counter" | Which station? | "Which counter? Garnish line? Prep station?" |
    | Technique = "Cut" | Which cut style? | "What cut? Dice/Slice/Julienne/Chiffonade?" |
    | Technique = "Cook" | Which equipment? | "What equipment? Fryer/Waterbath/Turbo/Grill?" |
    | Time missing for HEAT | How long? | "How long does this cook? Active or passive?" |
    | Quantity missing for PORTION | How much? | "What amount? What unit (oz/g/count)?" |
    | Multiple items in Component Name | Merge step? | "Is this combining items, or are they separate? Which is the base?" |
    | Phase = "Prep" | pre_service or order_execution? | "Is this prepped in advance or made to order?" |
```

**Why this order?**
- Agent knows WHEN to apply checklist (before generating ANY step)
- Agent has decision tree for "stop and ask" moments
- Common ambiguities are cataloged with exact questions to ask

---

### Part 3: Technical Deep-Dive (Lines 450-900)

**Goal:** Understanding material flow, dependencies, and validation rules

```markdown
11. Material Flow Model (CONSOLIDATED - 120 lines)
    - Steps describe WHERE WORK HAPPENS (stationId + sublocation)
    - Assemblies describe MATERIAL FLOW (input[].from, output[].to)
    - Versioned sub-assemblies and lineage
    - Assembly naming conventions
    - When to merge vs. not merge
    - Transfer step derivation

12. Dependencies & Execution Order (80 lines)
    - Material flow → derived dependencies
    - Explicit dependsOn for sequencing
    - Parallel tracks and join points

13. Structural Validation (CURRENT - 100 lines)
    - Flow & dependency analysis
    - Non-linear flow detection
    - Kitchen logic sanity checks
    - Join point detection

14. Validation Rules Reference (CURRENT - 150 lines)
    - H1-H46 rules with descriptions
    - C1-C5 consistency rules
    - S1-S25 soft warnings
    - Quick lookup table
```

**Why this order?**
- Deep technical content AFTER agent knows how to handle unstructured input
- Reference material for when agent needs to understand WHY

---

### Part 4: Enrichment & CLI Reference (Lines 900-1400)

**Goal:** Auto-derivation logic and CLI command usage

```markdown
15. Incremental Execution (MOVED from line 40 - 60 lines)
    - Gather → Act → Feedback → Repeat pattern
    - Don't batch all edits at once
    - Show progress incrementally

16. Enrichment Checklist (CURRENT - 80 lines)
    - Grouping inference
    - Station derivation
    - Phase inference
    - Tool assignment

17. Time Sanity Check (CURRENT - 40 lines)
    - Equipment time ranges
    - Flag unrealistic values

18. CLI Commands Reference (CURRENT - 200 lines)
    - lb.ts commands
    - Validation workflow
    - Viewer integration

19. Example Walkthroughs (CURRENT - 150 lines)
    - Burrito bowl example
    - Baked potato example
    - Common patterns
```

**Why this order?**
- Enrichment is AFTER validation (polish after correctness)
- CLI reference is lookup material (appendix-style)

---

## Key Improvements Summary

### 1. Information Architecture
- **CSV interpretation moves from line 646 → line ~150**
- **"User gives CSV → Do this" workflow at line ~50**
- **Mission statement comes FIRST (line 1-20)**

### 2. Proactive Validation
- **NEW: "When to Apply Pre-flight Checklist" section**
- **NEW: Decision tree for "stop and ask" moments**
- **NEW: Common CSV ambiguities → exact questions table**

### 3. Reduced Repetition
- **Consolidate material flow mentions (3 places → 1)**
- **Reduce "CRITICAL" usage (6 times → 2 times)**
- **Location tracking explained once with clear principles**

### 4. Agent Behavior Guidance
- **Clear decision points: IF this CSV pattern THEN ask this**
- **Prioritized questions: Ask about action family requirements FIRST**
- **Examples for every ambiguous scenario**

### 5. Unstructured Input Focus
- **CSV validation BEFORE processing (check required columns)**
- **Natural language → schema mapping workflow**
- **"Never guess" operationalized as decision tree**

---

## Migration Plan

### Option A: Incremental Refactor (Safer)
1. Add new Section 2 "Common Workflows" at line 100
2. Move CSV interpretation from 646 → 150
3. Add "When to Apply" section before Pre-flight Checklist
4. Add Decision Tree section after Pre-flight Checklist
5. Test with agent on sample CSV inputs
6. Consolidate material flow sections
7. Reduce "CRITICAL" emphasis

### Option B: Full Rewrite (Cleaner)
1. Create CLAUDE-v2.md with proposed structure
2. Port content section-by-section
3. Test side-by-side (old vs new) on CSV import tasks
4. Measure: Time to find answer, questions asked, validation errors
5. Switch to v2 when superior

---

## Success Metrics

**How to measure if restructure is successful:**

1. **Time to Answer** (agent perspective)
   - "User gives CSV with Location='Cold Storage' → Find answer"
   - Target: <10 seconds (currently ~30s with search)

2. **Questions Asked** (agent behavior)
   - Does agent ask about missing equipment for HEAT?
   - Does agent ask about cut style for "Cut" technique?
   - Target: 80%+ compliance with decision tree

3. **Validation Errors on First Draft** (outcome)
   - How many hard errors after agent processes CSV?
   - Target: <3 hard errors (currently ~8-10)

4. **User Clarifications Required** (outcome)
   - How many times does user need to correct agent interpretation?
   - Target: <2 corrections (currently ~4-5)

---

## Next Steps

**Immediate:**
1. User approval of proposed structure
2. Decision: Incremental refactor or full rewrite?
3. Identify high-value sections to tackle first (CSV workflows?)

**Quick Wins (20 min each):**
1. Add "When to Apply Pre-flight Checklist" section
2. Create "Common CSV Ambiguities → Questions" table
3. Move CSV interpretation to line ~150

**Long-term (2-3 hours):**
1. Full restructure per proposal
2. Add decision tree flowcharts
3. Test with real CSV import scenarios
