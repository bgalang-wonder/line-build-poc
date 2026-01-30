/**
 * Transfer configuration.
 *
 * Defines transfer types and their associated complexity scores and time estimates.
 * Transfer steps are derived (not authored) based on component flow between steps.
 *
 * Transfer type hierarchy:
 * - intra_station: Same station, different sublocation (lowest complexity)
 * - inter_station: Different station, same pod (medium complexity)
 * - inter_pod: Different pod (highest complexity)
 */

// ============================================
// Transfer Types
// ============================================

export type TransferType = "intra_station" | "inter_station" | "inter_pod";

export interface TransferScoring {
  /** Complexity score (higher = more complex, more risk) */
  complexityScore: number;
  /** Base time estimate in seconds */
  baseTimeSeconds: number;
  /** Human-readable description */
  description: string;
}

/**
 * Scoring for each transfer type.
 *
 * These values are used for:
 * 1. Build complexity scoring (sum of transfer complexities)
 * 2. Time estimation for routing/scheduling
 * 3. Identifying high-complexity builds for review
 */
export const TRANSFER_SCORING: Record<TransferType, TransferScoring> = {
  intra_station: {
    complexityScore: 1,
    baseTimeSeconds: 5,
    description: "Move within same station (e.g., cold_rail → work_surface)",
  },
  inter_station: {
    complexityScore: 3,
    baseTimeSeconds: 15,
    description: "Move between stations in same pod",
  },
  inter_pod: {
    complexityScore: 5,
    baseTimeSeconds: 30,
    description: "Move between different pods",
  },
};

// ============================================
// Transfer Type Determination
// ============================================

export interface TransferLocationInfo {
  stationId?: string;
  sublocationId?: string;
  podId?: string; // Optional - only set when pod assignment is available
}

/**
 * Determine the transfer type between two locations.
 *
 * Logic:
 * 1. If both have podId and they differ → inter_pod
 * 2. If stationIds differ → inter_station (or inter_pod if pods differ)
 * 3. If stationIds same but sublocation differs → intra_station
 * 4. If everything same → no transfer needed (returns null)
 */
export function determineTransferType(
  from: TransferLocationInfo,
  to: TransferLocationInfo
): TransferType | null {
  // If both have pod assignments and they differ, it's inter-pod
  if (from.podId && to.podId && from.podId !== to.podId) {
    return "inter_pod";
  }

  // If stations differ, it's inter-station (or inter-pod, but we already checked that)
  if (from.stationId && to.stationId && from.stationId !== to.stationId) {
    return "inter_station";
  }

  // If same station but different sublocation, it's intra-station
  if (from.stationId === to.stationId) {
    if (from.sublocationId !== to.sublocationId) {
      return "intra_station";
    }
    // Same station, same sublocation → no transfer needed
    return null;
  }

  // Can't determine (missing station info) - default to inter_station for safety
  if (from.stationId || to.stationId) {
    return "inter_station";
  }

  return null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the complexity score for a transfer type.
 */
export function getTransferComplexity(type: TransferType): number {
  return TRANSFER_SCORING[type].complexityScore;
}

/**
 * Get the base time estimate for a transfer type.
 */
export function getTransferBaseTime(type: TransferType): number {
  return TRANSFER_SCORING[type].baseTimeSeconds;
}

/**
 * Get all transfer types ordered by complexity (low to high).
 */
export function getTransferTypesByComplexity(): TransferType[] {
  return (Object.keys(TRANSFER_SCORING) as TransferType[]).sort(
    (a, b) => TRANSFER_SCORING[a].complexityScore - TRANSFER_SCORING[b].complexityScore
  );
}

/**
 * Check if a transfer type is "high complexity" (inter-pod or worse).
 * Used for flagging builds that need extra review.
 */
export function isHighComplexityTransfer(type: TransferType): boolean {
  return TRANSFER_SCORING[type].complexityScore >= 4;
}
