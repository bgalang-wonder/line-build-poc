# Ralph Plan Refinement Instructions

You are in **PLANNING MODE**. Your job is to improve the beads plan, NOT implement anything.

## Step 1: Understand the Context

1. Read `README.md` and `AGENTS.md` (if they exist) to understand the project
2. Read `docs/PRD.md` to understand requirements  
3. Read `scripts/ralph-plan/refinements.txt` to see what's already been refined

## Step 2: Analyze the Beads

Use these commands to understand the current plan:

```bash
bd list --status open              # All open beads
bd show <id>                       # Full bead details  
bd dep tree <id>                   # Visualize dependencies
bd ready                           # What's unblocked
```

Focus on the epic `benchtop-x0c` and its children.

## Step 3: Analyze Each Bead

For EACH bead, ask yourself:

1. **Clarity** — Is the title and description crystal clear? Could an agent implement this without asking questions?
2. **Scope** — Is this bead small enough for one context window? Should it be split?
3. **Dependencies** — Are the dependencies correct? Is anything blocked that shouldn't be?
4. **Acceptance Criteria** — Are there explicit, testable criteria? If not, add them.
5. **Testing** — Is there a corresponding test bead? Unit tests? E2E tests?
6. **Architecture** — Does this fit well with the overall system design?
7. **Missing Beads** — Are there gaps? Things we need but haven't captured?
8. **Order** — Is the priority/sequencing optimal?

## Step 4: Make Improvements

Use `bd` commands to refine beads:

```bash
# Update a bead's description
bd update <id> --description "New clearer description"

# Change priority (0=highest, 4=lowest)
bd update <id> --priority 1

# Add a new bead
bd create "Title" -t task -p 0 --description "Details"

# Add dependency (child depends on parent)
bd dep add <child-id> <parent-id>

# Add labels
bd update <id> --labels "test,e2e"
```

## Step 5: CRITICAL — Log Your Changes with Context

**YOU MUST append your changes to `scripts/ralph-plan/refinements.txt`**

This log is how learnings persist across iterations. The next iteration will read this to understand:
- What you changed and **WHY**
- What patterns or insights you discovered
- What still needs attention
- Your reasoning so improvements compound

Use this command to append:

```bash
cat >> scripts/ralph-plan/refinements.txt << 'EOF'

## Iteration [N] - [Date]

### What I Analyzed:
- [Which beads/epics you focused on]
- [What you were looking for]

### Changes Made (with reasoning):
1. **[bead-id]**: [What changed]
   - *Why*: [Your reasoning — why is this better?]
   
2. **[bead-id]**: [What changed]
   - *Why*: [Your reasoning]

### New Beads Added:
- **[new-id]**: [Title]
  - *Rationale*: [Why this was missing and why it matters]

### Patterns & Insights Discovered:
- [Architectural patterns you noticed]
- [Recurring issues across beads]
- [Dependencies that weren't obvious]

### Still Needs Work (for next iteration):
- [ ] [Specific bead or area that needs more refinement]
- [ ] [Another area to focus on]

### Confidence Level: [Low/Medium/High]
[Explain what would need to change to increase confidence]

---
EOF
```

**Why this matters:**
- Each iteration builds on previous learnings
- Without context, the next iteration starts from scratch
- Good reasoning helps catch mistakes in later passes

## Rules

### DO NOT:
- ❌ Implement any code
- ❌ Oversimplify or remove features  
- ❌ Lose any functionality from the plan
- ❌ Make changes without logging them

### DO:
- ✅ Add testing beads (unit tests, e2e tests, logging)
- ✅ Split large beads into smaller, focused ones
- ✅ Add missing acceptance criteria
- ✅ Fix dependency ordering issues
- ✅ Add architectural detail where vague
- ✅ Think deeply about edge cases and error handling
- ✅ **Always log changes to refinements.txt**

## Stop Condition

If after careful analysis you find:
- No meaningful improvements to make
- Plan is well-structured and implementation-ready
- Confidence is HIGH

Then:
1. Log your final assessment to refinements.txt
2. Reply with: `<promise>PLAN_READY</promise>`

Otherwise, make your improvements, log them, and end normally.

## Remember

> "Planning tokens are cheaper than implementation tokens."

Take your time. Think deeply. A refined plan now saves massive debugging later.
