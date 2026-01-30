#!/bin/bash
# Helper script to open a build in the viewer
# Usage: ./scripts/open-viewer.sh <buildId>
# This is a tool Claude Code can call when the user wants to work with a build.

BUILD_ID="$1"

if [ -z "$BUILD_ID" ]; then
  echo "Usage: ./scripts/open-viewer.sh <buildId>"
  exit 1
fi

VIEWER_URL="http://localhost:3000?buildId=${BUILD_ID}"

# Open in browser (don't check if running - let the browser handle 404s)
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$VIEWER_URL" 2>/dev/null && echo "Opened build in viewer: $VIEWER_URL" || echo "Viewer URL: $VIEWER_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$VIEWER_URL" 2>/dev/null && echo "Opened build in viewer: $VIEWER_URL" || echo "Viewer URL: $VIEWER_URL"
else
  echo "Viewer URL: $VIEWER_URL"
fi
