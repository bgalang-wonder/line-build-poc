# Ralph Agent Instructions

## CURRENT SPRINT: P0 UI Wiring

**Context:** GPT 5.2 audit revealed components exist but are NOT rendered:
- StepEditor imported but not mounted in EditorContainer
- BOMAutocomplete imported but not wired in StepEditor
- DependenciesMultiSelect imported but not wired
- useComplexityUpdater hook exists but not called

**Priority Order:**
1. `benchtop-l5c` — Wire StepEditor into EditorContainer (HIGHEST)
2. `benchtop-tp2` — Wire BOMAutocomplete into StepEditor target field
3. `benchtop-0m6` — Wire DependenciesMultiSelect into StepEditor
4. `benchtop-rnq` — Display complexity score in editor UI

## Your Task

1. **Check `scripts/ralph/beads-to-implement.txt`** for the current sprint beads
   - Work through them in order listed
   - Skip beads already closed (check with `bd show <id>`)

2. Read `scripts/ralph/progress.txt` (check Codebase Patterns first)

3. Pick the next unclosed bead from the sprint list
   - Skip epics (issue_type: "epic") — work on tasks/features
   - Use `bd show <id>` to get full details and verify status

4. Run `bd update <id> --status in_progress`

5. **For UI wiring tasks, the pattern is:**
   - Find the component that's imported but not rendered
   - Add JSX to render it in the appropriate location
   - Connect props to store state and actions
   - Handle selection state and callbacks

6. Implement that ONE task
   - Write code
   - Follow patterns from progress.txt
   - Components are in `apps/line-build-mvp/src/components/`
   - Store is in `apps/line-build-mvp/src/lib/model/store/`

7. Run typecheck and tests:
   ```bash
   cd apps/line-build-mvp && npm run typecheck && npm test
   ```
   - If tests don't exist yet, create them as part of implementation
   - Fix any type errors or test failures

8. Commit: `git add -A && git commit -m "feat: [ID] - [Title]"`

9. Run `bd close <id>` to mark complete

10. **CRITICAL: Append learnings to `scripts/ralph/progress.txt`**

    Use this command to append:
    ```bash
    cat >> scripts/ralph/progress.txt << 'EOF'

    ## [Date] - [Story ID]: [Title]

    ### What I Implemented:
    - [Brief description of the feature/fix]

    ### Files Changed:
    - `path/to/file.ts` — [what changed]
    - `path/to/file.ts` — [what changed]

    ### Learnings (for next iteration):
    - [Patterns discovered that future iterations should follow]
    - [Gotchas encountered and how to avoid them]
    - [Dependencies or imports that are useful]

    ### Codebase Patterns Discovered:
    - [Add any new patterns to the top of this file under ## Codebase Patterns]

    ---
    EOF
    ```

    **Why this matters:** The next iteration reads this file first. Good learnings compound!

## BD Commands Reference

```bash
bd ready --json          # Get tasks with no blocking deps
bd show <id>             # Full issue details
bd update <id> --status in_progress
bd close <id>            # Mark task complete
bd list --status open    # All open issues
bd dep tree <id>         # Visualize dependencies
```

## Filtering

If `scripts/ralph/.filter-context.txt` exists, you're working on a filtered subset of beads.
- **The filter file persists even after beads are closed** — this allows multiple runs
- Only implement beads listed in that file
- Skip beads that are already closed (check with `bd show <id>`)
- Still respect dependencies (don't implement blocked beads)
- When all beads in filter are closed or blocked, output `<promise>COMPLETE</promise>`

## Progress Format

This log is how learnings persist across iterations. The next iteration reads this first!

**Include:**
- What you implemented and why
- Files changed with context
- **Patterns** — things future iterations should follow
- **Gotchas** — things future iterations should avoid

## Codebase Patterns

If you discover a reusable pattern, **add it to the TOP of progress.txt** under `## Codebase Patterns`.

Examples:
```
## Codebase Patterns
- Components: Use Radix UI primitives from @radix-ui/*
- State: Use zustand for client state
- API routes: Place in src/app/api/[name]/route.ts
- Types: Export from src/lib/model/types.ts
```

These patterns help future iterations write consistent code.

## Stop Condition

If:
- No more tasks in filter (if filtering is active), OR
- `bd ready --json` returns NO tasks (empty array or all epics)

Then reply:
<promise>COMPLETE</promise>

Otherwise end normally after completing one task.
