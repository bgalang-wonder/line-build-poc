#!/bin/bash
# Helper script to generate a filter file from current ready beads

FILTER_FILE=${1:-"scripts/ralph/beads-to-implement.txt"}

echo "📋 Generating filter file from ready beads..."
echo ""

# Get all ready non-epic beads
READY_BEADS=$(bd ready --json 2>/dev/null | jq -r '.[] | select(.issue_type != "epic") | .id')

if [ -z "$READY_BEADS" ]; then
  echo "❌ No ready beads found"
  exit 1
fi

# Create filter file
cat > "$FILTER_FILE" << EOF
# Beads to Implement
# Generated: $(date)
# This file persists even after beads are closed
# Ralph will work through these in order until complete

EOF

echo "$READY_BEADS" | while read -r bead_id; do
  echo "$bead_id" >> "$FILTER_FILE"
done

COUNT=$(echo "$READY_BEADS" | wc -l | tr -d ' ')
echo "✅ Generated $FILTER_FILE with $COUNT beads"
echo ""
echo "📋 Beads in filter:"
echo "$READY_BEADS" | head -10
if [ "$COUNT" -gt 10 ]; then
  echo "... and $((COUNT - 10)) more"
fi
echo ""
echo "🚀 Run Ralph with:"
echo "   ./scripts/ralph/ralph.sh 25 file:$FILTER_FILE"

