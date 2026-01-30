import { z } from "zod";
import { type DerivedTransferStep, DerivedTransferStepSchema } from "./build";

/**
 * Derived build data - computed from authored builds and cached separately.
 *
 * This data is NOT authored; it's derived from material flow analysis.
 * Cached in data/derived/<buildId>.derived.json with hash-based invalidation.
 */

/**
 * Container for all derived build data with cache metadata.
 */
export interface DerivedBuildData {
  /** The build this derived data belongs to */
  buildId: string;

  /** ISO timestamp when this was computed */
  computedAt: string;

  /** Derivation logic version for cache invalidation */
  derivationVersion: string;

  /** Hash of the source build's steps + artifacts for cache invalidation */
  sourceHash: string;

  /** Derived transfer steps from component flow */
  transfers: DerivedTransferStep[];
}

export const DerivedBuildDataSchema = z
  .object({
    buildId: z.string(),
    computedAt: z.string(),
    derivationVersion: z.string(),
    sourceHash: z.string(),
    transfers: z.array(DerivedTransferStepSchema),
  })
  .strict();
