# Ralph Implementation Loop

Autonomous coding loop that implements beads one at a time.

## Quick Start

### 1. Generate Filter File (Recommended)

Since beads get **closed** after implementation, use a filter file to persist your list:

```bash
# Generate filter from current ready beads
./scripts/ralph/generate-filter.sh

# Or specify custom path
./scripts/ralph/generate-filter.sh scripts/ralph/my-beads.txt
```

### 2. Run Ralph

```bash
# Use the generated filter file
./scripts/ralph/ralph.sh 25 file:scripts/ralph/beads-to-implement.txt
```

## Why Filter Files?

**Problem**: Once Ralph closes a bead, it won't show up in `bd ready` anymore.

**Solution**: Filter files persist your bead list even after they're closed, allowing:
- Multiple runs on the same set of beads
- Resuming after interruptions
- Version controlling your implementation plan

## Filter Modes

```bash
# 1. Filter file (persists through closes)
./scripts/ralph/ralph.sh 25 file:scripts/ralph/beads-to-implement.txt

# 2. Label-based (dynamic, but labels persist)
./scripts/ralph/ralph.sh 25 label:phase1

# 3. Epic-based (all beads under epic)
./scripts/ralph/ralph.sh 25 epic:benchtop-x0c.1

# 4. All ready beads (default, but won't persist after closes)
./scripts/ralph/ralph.sh 25
```

## Workflow Example

```bash
# Step 1: Plan refinement (do this first!)
./scripts/ralph-plan/ralph-plan.sh 6

# Step 2: Generate filter from ready beads
./scripts/ralph/generate-filter.sh

# Step 3: Review/edit the filter file
cat scripts/ralph/beads-to-implement.txt

# Step 4: Run implementation loop
./scripts/ralph/ralph.sh 50 file:scripts/ralph/beads-to-implement.txt

# Step 5: Check progress
cat scripts/ralph/progress.txt
git log --oneline -10
```

## Monitoring

```bash
# See what's in your filter
cat scripts/ralph/beads-to-implement.txt

# Check progress
cat scripts/ralph/progress.txt

# See what's been closed
bd list --status closed | grep benchtop

# See what's still open
bd list --status open | grep benchtop
```

