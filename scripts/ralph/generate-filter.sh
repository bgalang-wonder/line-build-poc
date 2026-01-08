#!/bin/bash
# Helper script to generate a filter file from current ready beads

FILTER_FILE=${1:-"scripts/ralph/beads-to-implement.txt"}

echo "📋 Generating filter file from all open non-epic beads..."
echo ""

# Get all open non-epic beads (not just ready ones)
# This way Ralph can work through them as dependencies resolve
ALL_BEADS=$(bd list --status open --json 2>/dev/null | jq -r '.[] | select(.issue_type != "epic") | .id')

if [ -z "$ALL_BEADS" ]; then
  echo "❌ No open non-epic beads found"
  exit 1
fi

# Create filter file
cat > "$FILTER_FILE" << EOF
# Beads to Implement
# Generated: $(date)
# This file persists even after beads are closed
# Ralph will work through these in order as dependencies resolve

EOF

echo "$ALL_BEADS" | while read -r bead_id; do
  echo "$bead_id" >> "$FILTER_FILE"
done

COUNT=$(echo "$ALL_BEADS" | wc -l | tr -d ' ')
echo "✅ Generated $FILTER_FILE with $COUNT beads"
echo ""
echo "📋 Beads in filter (first 10):"
echo "$ALL_BEADS" | head -10
if [ "$COUNT" -gt 10 ]; then
  echo "... and $((COUNT - 10)) more"
fi
echo ""
echo "🚀 Run Ralph with:"
echo "   ./scripts/ralph/ralph.sh 25 file:$FILTER_FILE"

