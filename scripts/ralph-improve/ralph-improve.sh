#!/bin/bash
set -e

MAX_ITERATIONS=${1:-5}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/.last-output.txt"

cd "$PROJECT_ROOT"

echo "🔍 Starting Ralph Improve Loop"
echo "📋 Goal: Compare implementation against PRD, choose skill, improve"
echo "🔄 Max iterations: $MAX_ITERATIONS"
echo ""

# Check for PRD
if [ ! -f "docs/PRD-FULL.md" ]; then
  echo "❌ Missing docs/PRD-FULL.md — PRD is required!"
  exit 1
fi

# Show current state
echo "📊 Context:"
echo "   PRD: docs/PRD-FULL.md"
echo "   App: apps/line-build-mvp/"
echo ""

# Check for progress file
if [ -f "$SCRIPT_DIR/improvements.txt" ]; then
  ITERATION_COUNT=$(grep -c "^## Iteration" "$SCRIPT_DIR/improvements.txt" 2>/dev/null || echo 0)
  echo "📝 Previous iterations: $ITERATION_COUNT"
else
  echo "📝 Starting fresh improvements log"
fi
echo ""

# Show available skills
echo "🎯 Available openskills:"
echo "   ux-strategy, ux-engineering, ui-polish"
echo "   senior-architect, code-reviewer"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "═══ Improve Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════════════"
  echo ""

  # Record start time
  START_TIME=$(date +%s)
  START_TIME_READABLE=$(date '+%H:%M:%S')
  echo "⏳ Starting Claude at $START_TIME_READABLE..."
  echo ""

  # Run Claude and stream output in real-time
  set +e
  claude --dangerously-skip-permissions -p "$(cat "$SCRIPT_DIR/prompt.md")" 2>&1 | tee "$OUTPUT_FILE"
  CLAUDE_EXIT=$?
  set -e

  # Record end time and calculate duration
  END_TIME=$(date +%s)
  END_TIME_READABLE=$(date '+%H:%M:%S')
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  echo ""
  echo "⏱️  Finished at $END_TIME_READABLE"
  if [ $MINUTES -gt 0 ]; then
    echo "⏱️  Duration: ${MINUTES}m ${SECONDS}s"
  else
    echo "⏱️  Duration: ${SECONDS}s"
  fi

  if [ $CLAUDE_EXIT -ne 0 ]; then
    echo "⚠️ Claude exited with code $CLAUDE_EXIT"
  fi

  # Check for completion signal
  if grep -q "<promise>ALIGNED</promise>" "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "✅ Implementation aligned with PRD!"
    echo ""
    echo "📝 View improvements:"
    echo "   cat scripts/ralph-improve/improvements.txt"
    echo "═══════════════════════════════════════════════"
    rm -f "$OUTPUT_FILE"
    exit 0
  fi

  echo ""
  echo "💤 Sleeping 3s before next iteration..."
  sleep 3
done

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 Completed $MAX_ITERATIONS iterations"
echo ""
echo "📝 Review improvements:"
echo "   cat scripts/ralph-improve/improvements.txt"
echo ""
echo "🔄 Run more:"
echo "   ./scripts/ralph-improve/ralph-improve.sh 5"
echo "═══════════════════════════════════════════════"
rm -f "$OUTPUT_FILE"
