/**
 * Mapping utilities for complexity scoring.
 *
 * Provides canonical mappings for techniques and locations.
 */

import { getStationSide, type StationSide } from "../../../config/stations.config";
import { normalizeTechnique } from "../../../config/techniques.config";

/**
 * Canonicalize a technique ID using the techniques vocabulary.
 * Returns the canonical form if known, otherwise the original ID.
 */
export function canonicalizeTechnique(techniqueId: string | undefined): string | undefined {
  if (!techniqueId) return undefined;
  return normalizeTechnique(techniqueId) ?? techniqueId;
}

/**
 * Canonicalize a location (station) to its side.
 * Returns the station side (hot_side, cold_side, expo, vending).
 */
export function canonicalizeLocation(stationId: string | undefined): StationSide {
  return getStationSide(stationId);
}

/**
 * Check if a station side is "hot" (requires cooking equipment).
 */
export function isHotSide(side: StationSide): boolean {
  return side === "hot_side";
}

/**
 * Check if a station side is "cold" (assembly/prep).
 */
export function isColdSide(side: StationSide): boolean {
  return side === "cold_side";
}

/**
 * Check if a station side is "expo" (final handoff area).
 */
export function isExpoSide(side: StationSide): boolean {
  return side === "expo";
}

/**
 * Check if a station side is "vending" (automated dispensing).
 */
export function isVendingSide(side: StationSide): boolean {
  return side === "vending";
}
