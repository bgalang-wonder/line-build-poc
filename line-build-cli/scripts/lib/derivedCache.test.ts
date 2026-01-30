import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ActionFamily, type BenchTopLineBuild, type Step } from "./schema";
import { computeBuildSourceHash } from "./hash";
import {
  readDerived,
  writeDerived,
  getDerivedTransfers,
  getDerivedTransfersSync,
  DERIVED_DIR_ABS,
} from "./derivedCache";

// Test fixtures

function baseBuild(
  steps: Step[],
  partial: Partial<BenchTopLineBuild> = {}
): BenchTopLineBuild {
  return {
    id: "test-build-cache",
    itemId: "item-1",
    version: 1,
    status: "draft",
    steps,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function step(
  id: string,
  orderIndex: number,
  family: ActionFamily,
  partial: Partial<Step> = {}
): Step {
  return {
    id,
    orderIndex,
    action: { family },
    stationId: "garnish",
    input: [],
    output: [],
    from: {},
    to: {},
    ...partial,
  };
}

// Clean up test files
const TEST_BUILD_ID = "test-build-cache";

async function cleanupTestFiles() {
  try {
    await fs.unlink(path.join(DERIVED_DIR_ABS, `${TEST_BUILD_ID}.derived.json`));
  } catch {
    // Ignore if doesn't exist
  }
}

describe("hash utility", () => {
  it("produces consistent hashes for same input", () => {
    const build = baseBuild([step("s1", 0, ActionFamily.PREP)]);
    const hash1 = computeBuildSourceHash(build);
    const hash2 = computeBuildSourceHash(build);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes when steps change", () => {
    const build1 = baseBuild([step("s1", 0, ActionFamily.PREP)]);
    const build2 = baseBuild([
      step("s1", 0, ActionFamily.PREP),
      step("s2", 1, ActionFamily.HEAT),
    ]);

    const hash1 = computeBuildSourceHash(build1);
    const hash2 = computeBuildSourceHash(build2);
    expect(hash1).not.toBe(hash2);
  });

  it("produces same hash regardless of metadata changes", () => {
    const build1 = baseBuild([step("s1", 0, ActionFamily.PREP)], {
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const build2 = baseBuild([step("s1", 0, ActionFamily.PREP)], {
      updatedAt: "2026-12-31T23:59:59.000Z",
    });

    const hash1 = computeBuildSourceHash(build1);
    const hash2 = computeBuildSourceHash(build2);
    expect(hash1).toBe(hash2);
  });
});

describe("derived cache", () => {
  beforeEach(async () => {
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it("returns null for non-existent cache", async () => {
    const result = await readDerived("non-existent-build");
    expect(result).toBeNull();
  });

  it("writes and reads derived data correctly", async () => {
    const derivedData = {
      buildId: TEST_BUILD_ID,
      computedAt: new Date().toISOString(),
      derivationVersion: "transfers/v2",
      sourceHash: "abc123",
      transfers: [],
    };

    await writeDerived(TEST_BUILD_ID, derivedData);
    const result = await readDerived(TEST_BUILD_ID);

    expect(result).not.toBeNull();
    expect(result?.buildId).toBe(TEST_BUILD_ID);
    expect(result?.sourceHash).toBe("abc123");
    expect(result?.transfers).toEqual([]);
  });

  it("getDerivedTransfers computes and caches on miss", async () => {
    const build = baseBuild([step("s1", 0, ActionFamily.PREP)]);

    // First call should compute and cache
    const transfers1 = await getDerivedTransfers(build);
    expect(Array.isArray(transfers1)).toBe(true);

    // Cache should now exist
    const cached = await readDerived(TEST_BUILD_ID);
    expect(cached).not.toBeNull();
    expect(cached?.buildId).toBe(TEST_BUILD_ID);
  });

  it("getDerivedTransfers returns cached data on hit", async () => {
    const build = baseBuild([step("s1", 0, ActionFamily.PREP)]);
    const hash = computeBuildSourceHash(build);

    // Pre-populate cache with known data
    const preCached = {
      buildId: TEST_BUILD_ID,
      computedAt: "2020-01-01T00:00:00.000Z", // Old timestamp
      derivationVersion: "transfers/v2",
      sourceHash: hash, // Matching hash
      transfers: [], // Known value
    };
    await writeDerived(TEST_BUILD_ID, preCached);

    // Should return cached data without recomputing
    const transfers = await getDerivedTransfers(build);
    expect(Array.isArray(transfers)).toBe(true);

    // Verify cache wasn't updated (timestamp still old)
    const cached = await readDerived(TEST_BUILD_ID);
    expect(cached?.computedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("getDerivedTransfers recomputes when hash changes", async () => {
    // Pre-populate cache with old hash
    const oldCached = {
      buildId: TEST_BUILD_ID,
      computedAt: "2020-01-01T00:00:00.000Z",
      derivationVersion: "transfers/v2",
      sourceHash: "old-stale-hash", // Won't match current build
      transfers: [],
    };
    await writeDerived(TEST_BUILD_ID, oldCached);

    // Build with different content (will have different hash)
    const build = baseBuild([
      step("s1", 0, ActionFamily.PREP),
      step("s2", 1, ActionFamily.HEAT, {
        equipment: { applianceId: "fryer" },
        time: { durationSeconds: 60, isActive: false },
      }),
    ]);

    // Should detect stale cache and recompute
    const transfers = await getDerivedTransfers(build);
    expect(Array.isArray(transfers)).toBe(true);

    // Cache should be updated with new timestamp
    const cached = await readDerived(TEST_BUILD_ID);
    expect(cached?.computedAt).not.toBe("2020-01-01T00:00:00.000Z");
    expect(cached?.sourceHash).toBe(computeBuildSourceHash(build));
  });

  it("getDerivedTransfersSync always computes fresh (no cache)", () => {
    const build = baseBuild([step("s1", 0, ActionFamily.PREP)]);
    const transfers = getDerivedTransfersSync(build);
    expect(Array.isArray(transfers)).toBe(true);
  });
});
