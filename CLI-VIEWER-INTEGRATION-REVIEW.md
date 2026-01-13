# CLI-Viewer Integration Review

## Current Architecture

### CLI (`scripts/lb.ts`)
- **Writes builds** to `data/line-builds/<buildId>.json`
- **Helper script** (`scripts/open-viewer.sh`) opens browser with `?buildId=<buildId>` URL parameter
- **No direct communication** with viewer beyond file writes

### Viewer (`viewer/src/app/page.tsx`)
- **Polls `/api/builds`** every 1.5 seconds to refresh build list
- **Reads `buildId` from URL** query parameter (`?buildId=...`)
- **State management:**
  - `selectedBuildId` - Current build being viewed
  - `selectedBuild` - Full build data
  - `validation` - Validation results
  - `selectedStepId` - Currently inspected step
- **URL change detection:** Listens for URL changes and updates `selectedBuildId` accordingly
- **Auto-selection logic:** If no `buildId` in URL, selects first build from list

### API Routes
- `GET /api/builds` - Lists all builds (summaries)
- `GET /api/builds/[buildId]` - Gets specific build JSON
- `GET /api/validation/[buildId]` - Gets validation results
- `GET /api/select?buildId=<id>` - Returns URL with buildId (doesn't navigate)

## Current Limitations

1. **No programmatic control:** CLI cannot change viewer display without:
   - Opening a new browser window/tab
   - User manually changing URL
   - User clicking sidebar item

2. **URL-only selection:** Viewer only responds to URL query parameter changes

3. **No CLI-to-viewer signaling:** No mechanism for CLI to tell an already-open viewer to switch builds

## Proposed Solutions

### Option 1: File-Based Selection Signal (Recommended)

**How it works:**
- CLI writes a "selection marker" file: `data/.selected-build.json`
- Viewer polls this file (alongside `/api/builds`)
- When marker changes, viewer updates `selectedBuildId` automatically

**Pros:**
- Simple, file-based (matches existing architecture)
- No new API endpoints needed
- Works even if viewer was opened before CLI command
- Atomic file writes prevent race conditions

**Cons:**
- Adds another file to poll
- Requires viewer code changes

**Implementation:**

1. **CLI changes:**
   - Add `select <buildId>` command that:
     - Validates buildId exists
     - Writes `data/.selected-build.json` with `{ buildId, timestamp }`
     - Optionally opens viewer if not already open

2. **Viewer changes:**
   - Add API route: `GET /api/selected-build` that reads `.selected-build.json`
   - Poll this endpoint in existing polling loop
   - When selection changes, update `selectedBuildId` state

**Example CLI command:**
```bash
npx tsx scripts/lb.ts select <buildId>
```

### Option 2: API-Based Selection State

**How it works:**
- Add `POST /api/select` endpoint that writes selection to a server-side state file
- Viewer polls `GET /api/selected-build` to check current selection
- CLI calls `POST /api/select` via HTTP request

**Pros:**
- More "RESTful" approach
- CLI doesn't need direct file system access
- Could extend to support multiple viewers/sessions

**Cons:**
- Requires viewer server to be running
- More complex than file-based approach
- CLI needs to make HTTP requests

**Implementation:**

1. **New API route:** `POST /api/select` with `{ buildId }` body
2. **New API route:** `GET /api/selected-build` returns current selection
3. **CLI changes:** Add `select` command that makes HTTP POST
4. **Viewer changes:** Poll `/api/selected-build` and update state

### Option 3: Browser Automation (Not Recommended)

**How it works:**
- CLI uses browser automation (Puppeteer/Playwright) to change URL in open browser

**Pros:**
- Direct control over browser

**Cons:**
- Requires browser automation dependencies
- Complex, fragile
- Only works if browser is already open
- Overkill for this use case

## Recommended Implementation: Option 1 (File-Based)

### Step 1: Add CLI `select` Command

```typescript
// In scripts/lb.ts
async function cmdSelect(flags: GlobalFlags, argv: string[]): Promise<number> {
  const buildId = argv[0];
  if (!buildId) {
    writeError(flags, "usage: select <buildId>");
    return EXIT_USAGE_ERROR;
  }

  // Verify build exists
  try {
    await readBuild(buildId);
  } catch (err) {
    writeError(flags, `build not found: ${buildId}`);
    return EXIT_USAGE_ERROR;
  }

  // Write selection marker
  const selectionPath = path.join(DATA_ROOT_ABS, ".selected-build.json");
  await atomicWriteJsonFile(selectionPath, {
    buildId,
    timestamp: new Date().toISOString(),
  });

  if (flags.json) {
    writeJson({ ok: true, buildId });
    return EXIT_SUCCESS;
  }

  writeHuman([`selected buildId=${buildId}`]);
  return EXIT_SUCCESS;
}
```

### Step 2: Add Viewer API Route

```typescript
// viewer/src/app/api/selected-build/route.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveDataDir(): string {
  const envOverride = process.env["LINE_BUILD_POC_DATA_DIR"];
  if (envOverride) {
    return path.resolve(envOverride.trim());
  }
  return path.resolve(process.cwd(), "../data");
}

export async function GET() {
  try {
    const dataDir = resolveDataDir();
    const selectionPath = path.join(dataDir, ".selected-build.json");
    const raw = await fs.readFile(selectionPath, "utf8");
    const json = JSON.parse(raw) as { buildId: string; timestamp: string };
    return NextResponse.json(json);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ buildId: null });
    }
    return NextResponse.json({ error: "Failed to read selection" }, { status: 500 });
  }
}
```

### Step 3: Update Viewer to Poll Selection

```typescript
// In viewer/src/app/page.tsx
const [selectedBuildIdFromFile, setSelectedBuildIdFromFile] = useState<string | null>(null);

const fetchSelectedBuild = useCallback(async (): Promise<string | null> => {
  try {
    const res = await fetch("/api/selected-build", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buildId || null;
  } catch (err) {
    return null;
  }
}, []);

// Add to polling effect
useEffect(() => {
  let cancelled = false;
  const tick = async () => {
    try {
      const [next, fileSelection] = await Promise.all([
        fetchBuilds(),
        fetchSelectedBuild(),
      ]);
      if (cancelled) return;
      
      setBuilds(next);
      setSelectedBuildIdFromFile(fileSelection);
      
      // Selection priority: file > URL > current > first
      if (fileSelection && next.some((b) => b.buildId === fileSelection)) {
        setSelectedBuildId(fileSelection);
      } else {
        const urlBuildId = getBuildIdFromUrl();
        if (urlBuildId && next.some((b) => b.buildId === urlBuildId)) {
          setSelectedBuildId(urlBuildId);
        } else if (!selectedBuildId && next.length > 0) {
          setSelectedBuildId(next[0].buildId);
        }
      }
    } catch (err) {
      console.warn("Polling failed", err);
    }
  };
  tick();
  const id = setInterval(tick, POLL_MS);
  return () => { cancelled = true; clearInterval(id); };
}, [fetchBuilds, fetchSelectedBuild, selectedBuildId]);
```

## Additional Enhancements

### Step Selection
Extend the selection mechanism to also support step selection:

```typescript
// .selected-build.json
{
  "buildId": "baked-potato-mainstay-v1",
  "stepId": "step-5",  // optional
  "timestamp": "2026-01-15T10:30:00Z"
}
```

### Auto-open Viewer
Enhance `select` command to optionally open viewer:

```typescript
async function cmdSelect(flags: GlobalFlags, argv: string[]): Promise<number> {
  // ... existing selection logic ...
  
  const openFlag = hasFlag(argv, "--open");
  if (openFlag.present) {
    // Call open-viewer.sh script
    const { execSync } = require("child_process");
    execSync(`./scripts/open-viewer.sh ${buildId}`, { stdio: "inherit" });
  }
  
  // ...
}
```

## Migration Path

1. **Phase 1:** Add file-based selection (backward compatible)
2. **Phase 2:** Update viewer to respect file selection
3. **Phase 3:** Add CLI `select` command
4. **Phase 4:** Update documentation/CLAUDE.md with new command

## Testing Considerations

- Test with viewer already open (should update automatically)
- Test with viewer closed (should open with correct build)
- Test with invalid buildId (should error gracefully)
- Test with multiple builds (selection should persist)
- Test URL parameter still works (backward compatibility)
