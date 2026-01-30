import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parseBuild, type BenchTopLineBuild } from "./schema";
import { normalizeBuild } from "./normalize";
import { getDerivedTransfers } from "./derivedCache";

// Re-export from fileUtils for backwards compatibility
export {
  DATA_ROOT_ABS,
  BUILDS_DIR_ABS,
  BOMS_DIR_ABS,
  RECEIPTS_DIR_ABS,
  VALIDATION_DIR_ABS,
  atomicWriteFile,
  atomicWriteJsonFile,
} from "./fileUtils";

import { BUILDS_DIR_ABS, BOMS_DIR_ABS, atomicWriteJsonFile } from "./fileUtils";

/**
 * PoC file-backed store utilities.
 *
 * Source of truth for paths + atomic write policy:
 * - docs/handoff/POC_TASKS.json -> shared_conventions.paths + shared_conventions.atomic_write
 *
 * File naming conventions (per docs/handoff/POC-CLI-VIEWER-IMPLEMENTATION-PLAN.md):
 * - builds: data/line-builds/<buildId>.json
 * - boms:   data/bom/<itemId>.json
 */

function buildFilePathAbs(buildId: string): string {
  return path.join(BUILDS_DIR_ABS, `${buildId}.json`);
}

function bomFilePathAbs(itemId: string): string {
  return path.join(BOMS_DIR_ABS, `${itemId}.json`);
}

export type BuildSummary = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: BenchTopLineBuild["status"];
  updatedAt: string;
  createdAt: string;
  /**
   * Stable path relative to DATA_ROOT (for CLI/viewer callers).
   * Example: "line-builds/<buildId>.json"
   */
  relativePath: string;
};

export async function readBuild(buildId: string): Promise<BenchTopLineBuild> {
  const raw = await fs.readFile(buildFilePathAbs(buildId), { encoding: "utf8" });
  const json = JSON.parse(raw) as unknown;
  return parseBuild(json);
}

export async function writeBuild(build: BenchTopLineBuild): Promise<string> {
  const normalized = normalizeBuild(build);
  const filePath = buildFilePathAbs(normalized.id);
  await atomicWriteJsonFile(filePath, normalized);

  // Warm the derived cache - pre-compute transfers so they're ready for viewer/analysis
  await getDerivedTransfers(normalized);

  return filePath;
}

export async function listBuilds(): Promise<BuildSummary[]> {
  try {
    const entries = await fs.readdir(BUILDS_DIR_ABS, { withFileTypes: true });
    const ids = entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name.slice(0, -".json".length));

    const builds: BuildSummary[] = [];
    for (const id of ids) {
      const b = await readBuild(id);
      builds.push({
        buildId: b.id,
        itemId: b.itemId,
        name: b.name,
        version: b.version,
        status: b.status,
        updatedAt: b.updatedAt,
        createdAt: b.createdAt,
        relativePath: `line-builds/${b.id}.json`,
      });
    }

    // Stable ordering independent of filesystem traversal order.
    return builds.sort((a, b) => {
      if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
      if (a.version !== b.version) return a.version - b.version;
      return a.buildId.localeCompare(b.buildId);
    });
  } catch (err) {
    // If directory doesn't exist yet, treat as empty store.
    if ((err as { code?: string }).code === "ENOENT") return [];
    throw err;
  }
}

export type BomItem = {
  bomComponentId: string;
  type?: string;
  name?: string;
};

export async function readBom(itemId: string): Promise<BomItem[] | undefined> {
  try {
    const raw = await fs.readFile(bomFilePathAbs(itemId), { encoding: "utf8" });
    const json = JSON.parse(raw) as unknown;
    if (!Array.isArray(json)) {
      throw new Error(`BOM file must contain an array (itemId=${itemId})`);
    }
    const out: BomItem[] = [];
    for (const row of json) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const bomComponentId = typeof r.bomComponentId === "string" ? r.bomComponentId : "";
      if (bomComponentId.trim().length === 0) continue;
      out.push({
        bomComponentId,
        type: typeof r.type === "string" ? r.type : undefined,
        name: typeof r.name === "string" ? r.name : undefined,
      });
    }
    return out;
  } catch (err) {
    if ((err as { code?: string }).code === "ENOENT") return undefined;
    throw err;
  }
}
