# Ralph Improve Agent Instructions

You are in **IMPROVE MODE**. Your job is to identify gaps between the PRD and implementation, choose the right skill to address the gap, and make targeted improvements.

## Step 1: Understand Context

Read these files **THOROUGHLY**:

1. **`docs/PRD-FULL.md`** — The source of truth for ALL requirements
2. **`scripts/ralph-improve/improvements.txt`** — Previous iterations and progress

**PRD Key Sections:**
- Solution Overview → Three-panel interface (Chat, DAG/Gantt, Structured Form)
- Data Model → WorkUnit, LineBuild, Override schemas
- Functional Requirements → P1.1-P1.9 (Must-Have), P2.1-P2.4 (Should-Have)
- Pre-Service Prep → prepType, storageLocation, bulkPrep fields
- Schema Reference → All tag types and equipment rules
- Definition of Done → Checklist for v1 completion

## Step 2: Analyze Implementation

Explore the codebase to understand current state:

```bash
# Key areas to inspect
apps/line-build-mvp/src/lib/model/types.ts       # Data models
apps/line-build-mvp/src/components/              # UI components
apps/line-build-mvp/src/lib/                     # Business logic
apps/line-build-mvp/src/app/                     # Routes
```

**Ask yourself:**
1. Does the data model match PRD's WorkUnit/LineBuild schema?
2. Does the UI have the three panels described in PRD?
3. Are all P1 fields implemented (action, target, equipment, time, phase)?
4. Is pre-service prep (P1.9) fully supported?
5. Do validations match PRD's "hard block with override" philosophy?
6. Is complexity scoring (P1.5) computed and displayed?

## Step 3: Identify the Gap

Based on your analysis, identify **ONE** high-impact gap between PRD and implementation.

**Prioritization:**
1. **P1 Missing Features** — If a P1 requirement is not implemented
2. **UX Misalignment** — If user workflows don't match PRD Solution Overview
3. **Schema Gaps** — If data model doesn't match PRD
4. **Quality Issues** — Code patterns, edge cases, accessibility

## Step 4: Choose the Right Skill

Based on the gap type, load the appropriate openskill:

| Gap Type | Skill to Load | Command |
|----------|---------------|---------|
| User workflow, trade-offs, mental models | `ux-strategy` | `openskills read ux-strategy` |
| State machines, edge cases, accessibility | `ux-engineering` | `openskills read ux-engineering` |
| Visual polish, typography, aesthetics | `ui-polish` | `openskills read ui-polish` |
| System architecture, design patterns | `senior-architect` | `openskills read senior-architect` |
| Code quality, best practices, security | `code-reviewer` | `openskills read code-reviewer` |

**Run the command to load the skill**, then follow its methodology when making your improvement.

## Step 5: Make the Improvement

Apply the loaded skill's methodology to fix the gap:

1. **Read the skill output** and understand its approach
2. **Apply the methodology** to your specific gap
3. **Make targeted changes** — code, types, components, or documentation
4. **Keep changes focused** — ONE improvement per iteration

## Step 6: Verify Changes

If you made code changes:
```bash
cd apps/line-build-mvp && npm run typecheck && npm test
```

Fix any errors before proceeding.

## Step 7: Commit (if code changed)

```bash
git add -A && git commit -m "improve: [Skill Used] - [What you fixed]

Applied [skill-name] methodology to address [gap].
PRD ref: [P1.x or section]"
```

## Step 8: CRITICAL — Log Your Work

**YOU MUST append to `scripts/ralph-improve/improvements.txt`:**

```bash
cat >> scripts/ralph-improve/improvements.txt << 'EOF'

## Iteration [N] - [Date]

### Gap Identified:
- **PRD says:** [Quote requirement]
- **Implementation had:** [What was missing/wrong]
- **Gap type:** [UX / Schema / Code Quality / Feature]

### Skill Applied:
- **Skill:** [skill-name]
- **Why:** [Why this skill was appropriate]
- **Key methodology used:** [What approach from the skill you applied]

### Improvement Made:
- [What you changed]
- Files: [list of files modified]

### Verification:
- [ ] Types check: [pass/fail]
- [ ] Tests pass: [pass/fail]
- [ ] Committed: [yes/no]

### PRD Alignment Progress:
- P1.1 Action types: [done/partial/not started]
- P1.2 Target linking: [done/partial/not started]
- P1.3 Equipment + duration: [done/partial/not started]
- P1.4 Cooking phase: [done/partial/not started]
- P1.5 Complexity scoring: [done/partial/not started]
- P1.6 Overlays/variants: [done/partial/not started]
- P1.7 Natural language: [done/partial/not started]
- P1.9 Pre-service prep: [done/partial/not started]

### Next Priority:
[What gap should be addressed next iteration]

---
EOF
```

## Stop Condition

If after thorough analysis:
- ALL P1 requirements (P1.1-P1.9) are implemented
- UX matches PRD Solution Overview
- Data model matches PRD schema
- Validation philosophy is correctly implemented
- No high-impact gaps remain

Then reply: `<promise>ALIGNED</promise>`

Otherwise, make ONE improvement, log it, and end normally.

## Rules

### DO NOT:
- Make multiple unrelated changes in one iteration
- Skip loading the appropriate skill
- Skip logging your work
- Implement P2 features before all P1s are done

### DO:
- Read PRD and previous improvements first
- Choose the skill that best matches the gap
- Load and follow the skill's methodology
- Verify with typecheck and tests
- Log everything including which skill you used

## Available Skills Reference

```
ux-strategy        → User workflows, trade-offs, mental models (START HERE for UX)
ux-engineering     → State machines, edge cases, accessibility (AFTER ux-strategy)
ui-polish          → Visual polish, branding (AFTER ux-engineering)
senior-architect   → System design, architecture patterns
code-reviewer      → Code quality, best practices, security
```

## PRD Quick Reference

**P1 Must-Haves:**
- P1.1: Action types (PREP, HEAT, TRANSFER, etc.)
- P1.2: Target linking (BOM ID)
- P1.3: Equipment + duration
- P1.4: Cooking phase (PRE_COOK, COOK, etc.)
- P1.5: Complexity scoring
- P1.6: Overlays/variants
- P1.7: Natural language authoring
- P1.8: Migration (95%+ auto)
- P1.9: Pre-service prep (prepType, storageLocation, bulkPrep)

**Definition of Done:**
- Schema documented and stable
- Conversational input → structured output
- Complexity scores match legacy
- Overlays work
- Cooking phases are structured
- Pre-service prep captured
- Validation overrides tracked
- Source conversations preserved
- Gantt visualization available
