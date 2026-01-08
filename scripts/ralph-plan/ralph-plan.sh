#!/bin/bash
set -e

MAX_ITERATIONS=${1:-6}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/.last-output.txt"

cd "$PROJECT_ROOT"

echo "🎯 Starting Ralph Plan Refinement"
echo "📋 Goal: Improve beads plan before implementation"
echo "🔄 Max iterations: $MAX_ITERATIONS"
echo ""

# Show current plan state
echo "📊 Current beads state:"
OPEN_COUNT=$(bd list --status open 2>/dev/null | grep -c '^benchtop' || echo 0)
READY_COUNT=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
echo "   Open beads: $OPEN_COUNT"
echo "   Ready to work: $READY_COUNT"
echo ""

# Show the epic structure
echo "📐 Epic structure:"
bd dep tree benchtop-x0c 2>/dev/null | head -20 || echo "   (run 'bd dep tree benchtop-x0c' to see full tree)"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "═══ Plan Refinement Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════════════"
  echo ""
  
  # Record start time
  START_TIME=$(date +%s)
  START_TIME_READABLE=$(date '+%H:%M:%S')
  echo "⏳ Starting Claude at $START_TIME_READABLE (output will stream below)..."
  echo ""
  
  # Run Claude and stream output in real-time using tee
  # This shows output immediately AND saves it to check for PLAN_READY
  set +e  # Don't exit on error
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
  echo "⏱️  Claude finished at $END_TIME_READABLE"
  if [ $MINUTES -gt 0 ]; then
    echo "⏱️  Duration: ${MINUTES}m ${SECONDS}s"
  else
    echo "⏱️  Duration: ${SECONDS}s"
  fi
  
  if [ $CLAUDE_EXIT -ne 0 ]; then
    echo "⚠️ Claude exited with code $CLAUDE_EXIT"
  fi
  
  # Check for completion signal
  if grep -q "<promise>PLAN_READY</promise>" "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "✅ Plan refinement complete!"
    echo ""
    echo "📊 Final state:"
    FINAL_COUNT=$(bd list --status open 2>/dev/null | grep -c '^benchtop' || echo 0)
    echo "   Open beads: $FINAL_COUNT"
    echo ""
    echo "📝 View refinements:"
    echo "   cat scripts/ralph-plan/refinements.txt"
    echo ""
    echo "🚀 Ready to run implementation Ralph:"
    echo "   ./scripts/ralph/ralph.sh"
    echo "═══════════════════════════════════════════════"
    rm -f "$OUTPUT_FILE"
    exit 0
  fi
  
  echo ""
  echo "💤 Sleeping 3s before next refinement pass..."
  sleep 3
done

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 Completed $MAX_ITERATIONS refinement iterations"
echo ""
echo "📝 Review the refinements:"
echo "   cat scripts/ralph-plan/refinements.txt"
echo ""
echo "🔄 Run more iterations:"
echo "   ./scripts/ralph-plan/ralph-plan.sh 6"
echo ""
echo "🚀 Or start implementation:"
echo "   ./scripts/ralph/ralph.sh"
echo "═══════════════════════════════════════════════"
rm -f "$OUTPUT_FILE"
