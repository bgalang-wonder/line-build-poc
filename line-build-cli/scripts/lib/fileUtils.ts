import { randomUUID } from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Shared file utilities and path constants.
 *
 * Separated to avoid circular dependencies between store.ts and derivedCache.ts.
 */

const ENV_VAR = "LINE_BUILD_POC_DATA_DIR";

function resolveDataRootAbs(): string {
  /**
   * Resolve data root deterministically.
   *
   * Priority:
   * 1. LINE_BUILD_POC_DATA_DIR env var (if set)
   * 2. cwd-based heuristics for common execution patterns
   *
   * Supported execution patterns per shared_conventions.repo_layout_decision:
   * - From repo root: npx tsx poc/line-build-cli/scripts/lb.ts
   * - From poc dir:   cd poc/line-build-cli && npx tsx scripts/lb.ts
   */

  // 1. Check env var first (matches viewer behavior)
  const envOverride = process.env[ENV_VAR];
  if (typeof envOverride === "string" && envOverride.trim().length > 0) {
    return path.resolve(envOverride.trim());
  }

  // 2. cwd-based fallback
  const cwd = process.cwd();

  // Running from repo root.
  const pocDirFromRepoRoot = path.resolve(cwd, "poc/line-build-cli");
  if (fsSync.existsSync(path.join(pocDirFromRepoRoot, "package.json"))) {
    return path.join(pocDirFromRepoRoot, "data");
  }

  // Running from within poc/line-build-cli.
  if (
    fsSync.existsSync(path.join(cwd, "package.json")) &&
    fsSync.existsSync(path.join(cwd, "scripts/lb.ts"))
  ) {
    return path.join(cwd, "data");
  }

  // Fallback: assume repo root layout.
  return path.join(pocDirFromRepoRoot, "data");
}

export const DATA_ROOT_ABS = resolveDataRootAbs();
export const BUILDS_DIR_ABS = path.join(DATA_ROOT_ABS, "line-builds");
export const BOMS_DIR_ABS = path.join(DATA_ROOT_ABS, "bom");
export const RECEIPTS_DIR_ABS = path.join(DATA_ROOT_ABS, "receipts");
export const VALIDATION_DIR_ABS = path.join(DATA_ROOT_ABS, "validation");
export const DERIVED_DIR_ABS = path.join(DATA_ROOT_ABS, "derived");

async function ensureDir(dirAbs: string): Promise<void> {
  await fs.mkdir(dirAbs, { recursive: true });
}

export async function atomicWriteFile(
  targetPathAbs: string,
  content: string
): Promise<void> {
  // Atomic write pattern: write temp file then rename (POSIX atomic within same dir).
  await ensureDir(path.dirname(targetPathAbs));
  const tmpPath = `${targetPathAbs}.tmp-${randomUUID()}`;
  await fs.writeFile(tmpPath, content, { encoding: "utf8" });
  await fs.rename(tmpPath, targetPathAbs);
}

export async function atomicWriteJsonFile(
  targetPathAbs: string,
  obj: unknown
): Promise<void> {
  // Deterministic, human-readable formatting.
  const json = `${JSON.stringify(obj, null, 2)}\n`;
  await atomicWriteFile(targetPathAbs, json);
}
