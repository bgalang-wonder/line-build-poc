import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { BenchTopLineBuild, DerivedBuildData, DerivedTransferStep } from "./schema";
import { DerivedBuildDataSchema } from "./schema";
import { atomicWriteJsonFile, DERIVED_DIR_ABS } from "./fileUtils";
import { computeBuildSourceHash } from "./hash";
import { deriveTransferSteps } from "./transfers";

/**
 * Derived data cache layer.
 *
 * Stores computed derived data (transfers, etc.) separately from authored builds.
 * Uses hash-based invalidation: if sourceHash changes, cache is stale.
 *
 * File format: data/derived/<buildId>.derived.json
 */

export { DERIVED_DIR_ABS } from "./fileUtils";

const DERIVATION_VERSION = "transfers/v2";

function derivedFilePathAbs(buildId: string): string {
  return path.join(DERIVED_DIR_ABS, `${buildId}.derived.json`);
}

/**
 * Read cached derived data for a build.
 * Returns null if cache doesn't exist.
 */
export async function readDerived(buildId: string): Promise<DerivedBuildData | null> {
  try {
    const raw = await fs.readFile(derivedFilePathAbs(buildId), "utf8");
    const json = JSON.parse(raw);
    const result = DerivedBuildDataSchema.safeParse(json);
    if (!result.success) {
      // Cache file is corrupted or outdated schema - treat as cache miss
      return null;
    }
    return result.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Write derived data to cache.
 */
export async function writeDerived(buildId: string, data: DerivedBuildData): Promise<void> {
  await atomicWriteJsonFile(derivedFilePathAbs(buildId), data);
}

/**
 * Get derived transfers for a build, using cache when valid.
 *
 * This is the main entry point for consumers who need transfers:
 * 1. Computes sourceHash of current build
 * 2. Checks if cached data exists and hash matches
 * 3. If cache hit → return cached transfers
 * 4. If cache miss/stale → compute, cache, and return
 */
export async function getDerivedTransfers(
  build: BenchTopLineBuild
): Promise<DerivedTransferStep[]> {
  const currentHash = computeBuildSourceHash(build);

  // Check cache
  const cached = await readDerived(build.id);
  if (
    cached &&
    cached.sourceHash === currentHash &&
    cached.derivationVersion === DERIVATION_VERSION
  ) {
    // Cache hit - return cached transfers
    return cached.transfers;
  }

  // Cache miss or stale - compute fresh
  const transfers = deriveTransferSteps(build);

  // Persist to cache
  const derivedData: DerivedBuildData = {
    buildId: build.id,
    computedAt: new Date().toISOString(),
    derivationVersion: DERIVATION_VERSION,
    sourceHash: currentHash,
    transfers,
  };
  await writeDerived(build.id, derivedData);

  return transfers;
}

/**
 * Synchronous version for cases where async isn't feasible.
 * Does NOT use cache - always computes fresh.
 * Use getDerivedTransfers() when possible.
 */
export function getDerivedTransfersSync(build: BenchTopLineBuild): DerivedTransferStep[] {
  return deriveTransferSteps(build);
}
