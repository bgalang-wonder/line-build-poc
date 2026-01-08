#!/bin/bash
set -e

MAX_ITERATIONS=${1:-10}
FILTER_MODE=${2:-"all"}  # "all", "label:<name>", "file:<path>", "epic:<id>"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/.last-output.txt"

cd "$PROJECT_ROOT"

echo "🚀 Starting Ralph Implementation Loop"
echo "📋 Using bd database for task management"
echo "🎯 Filter mode: $FILTER_MODE"
echo ""

# Determine filter command
FILTER_CMD=""
case "$FILTER_MODE" in
  "all")
    FILTER_CMD="bd ready --json"
    ;;
  "label:"*)
    LABEL="${FILTER_MODE#label:}"
    echo "📌 Filtering by label: $LABEL"
    FILTER_CMD="bd list --status open --json | jq --arg label \"$LABEL\" '[.[] | select(.labels[]? == \$label)]'"
    ;;
  "file:"*)
    FILTER_FILE="${FILTER_MODE#file:}"
    if [ ! -f "$FILTER_FILE" ]; then
      echo "❌ Filter file not found: $FILTER_FILE"
      exit 1
    fi
    echo "📄 Using filter file: $FILTER_FILE"
    FILTER_CMD="bd list --status open --json | jq --slurpfile ids <(cat $FILTER_FILE | grep -v '^#' | grep -v '^$') '[.[] | select(.id as \$id | \$ids[] | contains([\$id]))]'"
    ;;
  "epic:"*)
    EPIC_ID="${FILTER_MODE#epic:}"
    echo "🌳 Filtering by epic: $EPIC_ID"
    FILTER_CMD="bd dep tree $EPIC_ID --json 2>/dev/null | jq -r '.descendants[]?.id' | xargs -I {} bd show {} --json 2>/dev/null | jq -s '[.[] | select(.status == \"open\")]'"
    ;;
  *)
    echo "❌ Unknown filter mode: $FILTER_MODE"
    echo "Usage: $0 [iterations] [filter_mode]"
    echo "Filter modes:"
    echo "  all              - All ready beads (default)"
    echo "  label:<name>     - Beads with label"
    echo "  file:<path>      - Beads listed in file (one ID per line)"
    echo "  epic:<id>        - All beads under epic"
    exit 1
    ;;
esac

# Show what's ready to work on
echo "📊 Tasks ready to work on:"
if [ "$FILTER_MODE" = "all" ]; then
  bd ready 2>/dev/null | head -10
else
  eval "$FILTER_CMD" 2>/dev/null | jq -r '.[] | "\(.id) [P\(.priority)] - \(.title)"' | head -10
fi
echo ""

# Create filter context file for prompt
FILTER_CONTEXT="$SCRIPT_DIR/.filter-context.txt"
echo "# Filter Mode: $FILTER_MODE" > "$FILTER_CONTEXT"
if [ "$FILTER_MODE" != "all" ]; then
  echo "# Filtered beads:" >> "$FILTER_CONTEXT"
  eval "$FILTER_CMD" 2>/dev/null | jq -r '.[] | .id' >> "$FILTER_CONTEXT"
fi

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "═══════════════════════════════════════"
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════"
  
  # Check if any tasks are ready (non-epic, open status)
  if [ "$FILTER_MODE" = "all" ]; then
    READY_COUNT=$(bd ready --json 2>/dev/null | jq '[.[] | select(.issue_type != "epic" and .status == "open")] | length')
  else
    # For filtered mode, check both ready status AND open status
    READY_COUNT=$(eval "$FILTER_CMD" 2>/dev/null | jq '[.[] | select(.issue_type != "epic" and .status == "open")] | length')
  fi
  
  if [ "$READY_COUNT" -eq 0 ]; then
    echo "✅ No more tasks ready to work on!"
    if [ "$FILTER_MODE" != "all" ]; then
      echo "   (All beads in filter are either closed or blocked)"
    fi
    rm -f "$FILTER_CONTEXT" "$OUTPUT_FILE"
    exit 0
  fi
  
  echo "📝 $READY_COUNT task(s) ready"
  echo ""
  echo "⏳ Starting Claude (output will stream below)..."
  echo ""
  
  # Run Claude and stream output in real-time using tee
  set +e  # Don't exit on error
  claude --dangerously-skip-permissions -p "$(cat "$SCRIPT_DIR/prompt.md")" 2>&1 | tee "$OUTPUT_FILE"
  CLAUDE_EXIT=$?
  set -e
  
  if [ $CLAUDE_EXIT -ne 0 ]; then
    echo ""
    echo "⚠️ Claude exited with code $CLAUDE_EXIT"
  fi
  
  # Check for completion signal
  if grep -q "<promise>COMPLETE</promise>" "$OUTPUT_FILE" 2>/dev/null; then
    echo ""
    echo "✅ All tasks complete!"
    rm -f "$FILTER_CONTEXT" "$OUTPUT_FILE"
    exit 0
  fi
  
  echo ""
  echo "💤 Sleeping 2s before next iteration..."
  sleep 2
done

echo ""
echo "⚠️ Max iterations ($MAX_ITERATIONS) reached"
echo "📊 Remaining tasks:"
if [ "$FILTER_MODE" = "all" ]; then
  bd ready 2>/dev/null | head -5
else
  eval "$FILTER_CMD" 2>/dev/null | jq -r '.[] | "\(.id) - \(.title)"' | head -5
fi
rm -f "$FILTER_CONTEXT" "$OUTPUT_FILE"
exit 1
