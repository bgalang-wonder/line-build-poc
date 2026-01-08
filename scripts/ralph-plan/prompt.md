# Ralph Plan Refinement Instructions

You are in **PLANNING MODE**. Your job is to improve the beads plan, NOT implement anything.

## Step 1: Understand the Context

1. Read `docs/PRD-FULL.md` **THOROUGHLY** — this is the source of truth for requirements
2. Read `docs/schema/SPEC-TECHNICAL.md` for technical schema details
3. Read `scripts/ralph-plan/refinements.txt` to see what's already been refined

**CRITICAL:** The PRD contains Must-Have requirements (P1), acceptance criteria, and domain knowledge. Every bead should trace back to PRD requirements.

## Step 2: Analyze the Beads

Use these commands to understand the current plan:

```bash
bd list --status open              # All open beads
bd list --status closed            # Already implemented beads
bd show <id>                       # Full bead details  
bd dep tree <id>                   # Visualize dependencies
bd ready                           # What's unblocked
```

Focus on the epic `benchtop-x0c` and its children.

## Step 3: THREE Key Tasks

### Task A: Audit Already-Implemented Beads

Some beads were implemented WITHOUT full PRD context. For each **closed** bead:

1. Check if the implementation likely aligns with PRD requirements
2. If there's a gap (missing field, wrong behavior, incomplete feature), create an **audit bead**:

```bash
bd create --title "Audit: [Original Title] - [Gap Description]" \
  --type task \
  --priority P1 \
  --label "audit,prd-alignment" \
  --description "## PRD Alignment Check

### Original Bead: [id]
[What was implemented]

### PRD Requirement:
[Quote the relevant PRD section]

### Potential Gap:
[What might be missing or misaligned]

### Acceptance Criteria:
- [ ] Verify [specific thing]
- [ ] Fix if needed: [specific fix]
"
```

**Common gaps to look for:**
- Missing `prepType`, `storageLocation`, `bulkPrep` fields (PRD P1.9)
- Missing `cookingPhase` / `phase` field (PRD P1.4)
- Override UI without reason capture (PRD validation philosophy)
- Complexity scoring not computed/displayed (PRD P1.5)

### Task B: Enrich Open Beads

For each **open** bead that lacks a description:

1. Write a clear description with context
2. Add explicit acceptance criteria
3. Reference PRD requirements where applicable

```bash
bd update <id> --description "## [Feature Name]

Per PRD [section]: [Quote or summarize requirement]

### Context
[What this feature does and why it matters]

### Acceptance Criteria
- [ ] [Specific, testable criterion]
- [ ] [Another criterion]
- [ ] [Edge case handling]

### Technical Notes
[Any implementation hints]
"
```

### Task C: Create Missing Beads

Review the PRD and check if any requirements are NOT covered by existing beads:

**PRD Must-Haves to verify:**
- P1.1: Work types (action field) ✓
- P1.2: BOM linking (target field) ✓
- P1.3: Equipment + duration ✓
- P1.4: Cooking phase (PRE_COOK, COOK, POST_COOK, etc.)
- P1.5: Complexity scoring display
- P1.6: Overlays/variants
- P1.7: Natural language authoring ✓
- P1.9: Pre-service prep tags

## Step 4: Analyze Each Bead

For EACH bead, ask yourself:

1. **PRD Alignment** — Does this trace to a PRD requirement? Which one?
2. **Clarity** — Is the title and description crystal clear?
3. **Scope** — Is this bead small enough for one context window?
4. **Dependencies** — Are the dependencies correct?
5. **Acceptance Criteria** — Are there explicit, testable criteria?
6. **Testing** — Is there a corresponding test bead?

## Step 5: Make Improvements

Use `bd` commands to refine beads:

```bash
# Update a bead's description
bd update <id> --description "New clearer description"

# Change priority (P0=highest, P4=lowest)
bd update <id> --priority P1

# Add a new bead
bd create --title "Title" --type task --priority P0 --description "Details"

# Add dependency (child depends on parent)
bd dep add <child-id> <parent-id>

# Add labels
bd update <id> --label "test,e2e,audit"
```

## Step 6: CRITICAL — Log Your Changes with Context

**YOU MUST append your changes to `scripts/ralph-plan/refinements.txt`**

```bash
cat >> scripts/ralph-plan/refinements.txt << 'EOF'

## Iteration [N] - [Date]

### PRD Requirements Reviewed:
- [Which PRD sections you analyzed]

### Audit Beads Created:
- **[new-id]**: [Title]
  - *Gap found*: [What was missing]
  - *PRD ref*: [P1.x]

### Beads Enriched:
- **[bead-id]**: Added description + acceptance criteria
  - *PRD alignment*: [Which requirement this supports]

### New Beads Created:
- **[new-id]**: [Title]
  - *Rationale*: [Why this was missing]
  - *PRD ref*: [P1.x]

### Patterns & Insights:
- [What you noticed about the plan]

### Still Needs Work:
- [ ] [Specific area needing attention]

### Confidence Level: [Low/Medium/High]

---
EOF
```

## Rules

### DO NOT:
- ❌ Implement any code
- ❌ Oversimplify or remove features  
- ❌ Lose any functionality from the plan
- ❌ Make changes without logging them

### DO:
- ✅ Create audit beads for closed features that may not align with PRD
- ✅ Enrich open beads with descriptions and acceptance criteria
- ✅ Add missing beads for PRD requirements not yet covered
- ✅ Reference PRD section numbers (P1.x, P2.x) in descriptions
- ✅ Add testing beads where missing
- ✅ **Always log changes to refinements.txt**

## Stop Condition

If after careful analysis you find:
- All closed beads have been audited (or audit beads created)
- All open beads have descriptions and acceptance criteria
- All PRD P1 requirements have corresponding beads
- Confidence is HIGH

Then:
1. Log your final assessment to refinements.txt
2. Reply with: `<promise>PLAN_READY</promise>`

Otherwise, make your improvements, log them, and end normally.

## Remember

> "Planning tokens are cheaper than implementation tokens."
> 
> Features implemented without PRD context may need rework. Audit beads catch this early.

Take your time. Think deeply. A refined plan now saves massive debugging later.
