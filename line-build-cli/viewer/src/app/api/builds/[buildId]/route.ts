import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveBuildsDir, resolveDerivedDir } from "@/lib/dataPaths";
import { getDerivedTransfersSync } from "../../../../../../scripts/lib/derivedCache";
import { computeBuildSourceHash } from "../../../../../../scripts/lib/hash";
import { atomicWriteJsonFile } from "../../../../../../scripts/lib/fileUtils";

export const dynamic = "force-dynamic";

const BUILDS_DIR = resolveBuildsDir();
const DERIVED_DIR = resolveDerivedDir();
const DERIVATION_VERSION = "transfers/v2";

/**
 * Load derived transfers from cache if available.
 * Returns null if cache doesn't exist or is invalid.
 */
async function loadDerivedTransfers(buildId: string): Promise<unknown[] | null> {
  try {
    const raw = await fs.readFile(
      path.join(DERIVED_DIR, `${buildId}.derived.json`),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.transfers)) {
      return parsed.transfers;
    }
    return null;
  } catch {
    // Cache miss or read error - return null
    return null;
  }
}

/**
 * Compute and cache derived transfers for a build.
 */
async function computeAndCacheDerivedTransfers(build: any): Promise<unknown[]> {
  const transfers = getDerivedTransfersSync(build);
  
  const derivedData = {
    buildId: build.id,
    computedAt: new Date().toISOString(),
    derivationVersion: DERIVATION_VERSION,
    sourceHash: computeBuildSourceHash(build),
    transfers,
  };
  
  try {
    await atomicWriteJsonFile(
      path.join(DERIVED_DIR, `${build.id}.derived.json`),
      derivedData
    );
  } catch (err) {
    console.error("Failed to cache derived data:", err);
  }
  
  return transfers;
}

export async function GET(
  _request: Request,
  { params }: { params: { buildId: string } }
) {
  const { buildId } = params;
  try {
    // Load the authored build
    const raw = await fs.readFile(path.join(BUILDS_DIR, `${buildId}.json`), "utf8");
    const build = JSON.parse(raw);

    // Try to load derived transfers from cache
    let derivedTransfers = await loadDerivedTransfers(buildId);
    
    // If cache miss, compute on-the-fly and cache for next time
    if (!derivedTransfers) {
      derivedTransfers = await computeAndCacheDerivedTransfers(build);
    }
    
    build.derivedTransfers = derivedTransfers;

    return NextResponse.json(build);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read build" }, { status: 500 });
  }
}
