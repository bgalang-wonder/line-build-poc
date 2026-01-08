#!/bin/bash
set -e

MAX_ITERATIONS=${1:-10}
FILTER_FILE=${2:-""}  # Optional: path to file with bead IDs
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/.last-output.txt"

cd "$PROJECT_ROOT"

echo "🚀 Starting Ralph Implementation Loop"
echo "📋 Using bd database for task management"

# Handle filter file
if [ -n "$FILTER_FILE" ] && [ -f "$FILTER_FILE" ]; then
  echo "📄 Filter file: $FILTER_FILE"
  # Copy filter file for Claude to read (strip comments)
  grep -v '^#' "$FILTER_FILE" | grep -v '^$' > "$SCRIPT_DIR/.filter-context.txt"
  FILTER_COUNT=$(wc -l < "$SCRIPT_DIR/.filter-context.txt" | tr -d ' ')
  echo "📋 Beads in filter: $FILTER_COUNT"
else
  echo "📋 Mode: All ready beads (no filter)"
  rm -f "$SCRIPT_DIR/.filter-context.txt"
fi
echo ""

# Show what's ready
echo "📊 Ready beads:"
bd ready 2>/dev/null | grep -v '^\[epic\]' | head -10
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "═══════════════════════════════════════"
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════"
  
  # Count ready non-epic beads
  READY_COUNT=$(bd ready --json 2>/dev/null | jq '[.[] | select(.issue_type != "epic")] | length' 2>/dev/null || echo "0")
  
  if [ "$READY_COUNT" = "0" ] || [ -z "$READY_COUNT" ]; then
    echo "✅ No more tasks ready to work on!"
    rm -f "$SCRIPT_DIR/.filter-context.txt" "$OUTPUT_FILE"
    exit 0
  fi
  
  echo "📝 $READY_COUNT task(s) ready"
  echo ""
  
  # Record start time
  START_TIME=$(date +%s)
  START_TIME_READABLE=$(date '+%H:%M:%S')
  echo "⏳ Starting Claude at $START_TIME_READABLE (output will stream below)..."
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
  if grep -q "<promise>COMPLETE</promise>" "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo "✅ All tasks complete!"
    rm -f "$SCRIPT_DIR/.filter-context.txt" "$OUTPUT_FILE"
    exit 0
  fi
  
  echo ""
  echo "💤 Sleeping 2s before next iteration..."
  sleep 2
done

echo ""
echo "⚠️ Max iterations ($MAX_ITERATIONS) reached"
echo "📊 Remaining ready tasks:"
bd ready 2>/dev/null | grep -v '^\[epic\]' | head -5
rm -f "$SCRIPT_DIR/.filter-context.txt" "$OUTPUT_FILE"
exit 1
