/**
 * Station configuration.
 *
 * Stations are the primary organizational unit. Each station has:
 * - side: hot_side | cold_side | vending (attribute, not a separate grouping)
 * - sublocations: which sub-locations are available at this station
 * - equipmentAvailable: which equipment/appliances can be used at this station
 * - isEquipment: (deprecated) true if this station IS an appliance
 *
 * Model hierarchy:
 *   Station (where you work)
 *     └── Sublocation (where at that station)
 *           └── equipment (type) → equipmentId (which appliance)
 *
 * This config is the source of truth. Schema types and Zod validators
 * should be derived from this config, not hardcoded separately.
 */

export type StationSide = "hot_side" | "cold_side" | "vending" | "expo";

export type SublocationId =
  | "work_surface"
  | "cold_rail"
  | "dry_rail"
  | "cold_storage"
  | "packaging"
  | "kit_storage"
  | "window_shelf"
  | "equipment"
  // Pizza station specific
  | "stretch_table"
  | "cut_table"
  // Fryer station specific
  | "freezer";

/**
 * Equipment IDs that can be used at stations.
 * These are physical appliances, not stations themselves.
 */
export type EquipmentId =
  | "fryer"
  | "waterbath"
  | "turbo"
  | "toaster"
  | "clamshell_grill"
  | "press"
  | "pizza_oven"
  | "pizza_conveyor_oven"
  | "microwave"
  | "vending"
  // Holding equipment
  | "hot_box"
  | "hot_well"
  | "steam_well"
  | "sauce_warmer"
  | "other";

export interface StationConfig {
  id: string;
  label: string;
  side: StationSide;
  sublocations: SublocationId[];
  /** Equipment/appliances available at this station */
  equipmentAvailable?: EquipmentId[];
  /** @deprecated Use equipmentAvailable instead. True if this station IS an appliance. */
  isEquipment?: boolean;
}

/**
 * All stations in the system.
 *
 * Station categories:
 * - Hot Side: Cooking equipment stations
 * - Cold Side: Assembly and prep areas
 * - Expo: Final pass/handoff area
 * - Vending: Automated dispensing
 */
export const STATIONS: StationConfig[] = [
  // ============================================
  // HOT SIDE — Cooking equipment stations
  // ============================================
  {
    id: "fryer",
    label: "Fryer",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment", "freezer"],
    equipmentAvailable: ["fryer", "hot_box"],
    isEquipment: true, // deprecated
  },
  {
    id: "waterbath",
    label: "Waterbath",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["waterbath", "hot_box"],
    isEquipment: true, // deprecated
  },
  {
    id: "turbo",
    label: "Turbo Oven",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["turbo", "hot_box"],
    isEquipment: true, // deprecated
  },
  {
    id: "toaster",
    label: "Toaster",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["toaster"],
    isEquipment: true, // deprecated
  },
  {
    id: "clamshell_grill",
    label: "Clamshell Grill",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["clamshell_grill", "toaster", "press"],
    isEquipment: true, // deprecated
  },
  {
    id: "pizza",
    label: "Pizza Station",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment", "stretch_table", "cut_table"],
    equipmentAvailable: ["pizza_oven", "pizza_conveyor_oven", "sauce_warmer", "hot_box", "waterbath"],
    isEquipment: true, // deprecated
  },
  {
    id: "microwave",
    label: "Microwave",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["microwave", "hot_box"],
    isEquipment: true, // deprecated
  },

  // ============================================
  // COLD SIDE — Assembly and prep areas
  // ============================================
  {
    id: "garnish",
    label: "Garnish",
    side: "cold_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "kit_storage", "equipment"],
    equipmentAvailable: ["toaster", "press"],
  },
  {
    id: "speed_line",
    label: "Speed Line",
    side: "cold_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["waterbath", "turbo", "press", "microwave", "sauce_warmer", "hot_box", "hot_well", "steam_well"],
  },
  {
    id: "prep",
    label: "Prep",
    side: "cold_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging"],
    equipmentAvailable: [],
  },

  // ============================================
  // EXPO — Final pass/handoff
  // ============================================
  {
    id: "expo",
    label: "Expo",
    side: "expo",
    sublocations: ["work_surface", "window_shelf"],
    equipmentAvailable: [],
  },

  // ============================================
  // VENDING
  // ============================================
  {
    id: "vending",
    label: "Vending",
    side: "vending",
    sublocations: ["equipment"],
    equipmentAvailable: ["vending"],
    isEquipment: true, // deprecated
  },

  // ============================================
  // FALLBACK
  // ============================================
  {
    id: "other",
    label: "Other",
    side: "cold_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "kit_storage", "window_shelf", "equipment"],
    equipmentAvailable: ["other"],
  },

  // ============================================
  // BACKWARDS COMPATIBILITY - Legacy grouping values used as stationId
  // ============================================
  {
    id: "hot_side",
    label: "Hot Side (Legacy)",
    side: "hot_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "equipment"],
    equipmentAvailable: ["fryer", "waterbath", "turbo", "toaster", "clamshell_grill", "press", "pizza_oven", "microwave", "hot_box"],
  },
  {
    id: "cold_side",
    label: "Cold Side (Legacy)",
    side: "cold_side",
    sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "kit_storage"],
    equipmentAvailable: [],
  },
];

// ============================================
// Derived lookups (computed from config)
// ============================================

/** Map of stationId -> StationConfig */
export const STATION_BY_ID: Record<string, StationConfig> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s])
);

/** All valid station IDs */
export const ALL_STATION_IDS: string[] = STATIONS.map((s) => s.id);

/** @deprecated Use equipmentAvailable instead. All stations that are equipment. */
export const EQUIPMENT_STATION_IDS: string[] = STATIONS
  .filter((s) => s.isEquipment)
  .map((s) => s.id);

/** All valid sublocation IDs */
export const ALL_SUBLOCATION_IDS: SublocationId[] = [
  "work_surface",
  "cold_rail",
  "dry_rail",
  "cold_storage",
  "packaging",
  "kit_storage",
  "window_shelf",
  "equipment",
  // Station-specific sublocations
  "stretch_table",
  "cut_table",
  "freezer",
];

/** All valid equipment IDs */
export const ALL_EQUIPMENT_IDS: EquipmentId[] = [
  "fryer",
  "waterbath",
  "turbo",
  "toaster",
  "clamshell_grill",
  "press",
  "pizza_oven",
  "pizza_conveyor_oven",
  "microwave",
  "vending",
  "hot_box",
  "hot_well",
  "steam_well",
  "sauce_warmer",
  "other",
];

/** Map of equipmentId -> stations where it's available */
export const EQUIPMENT_TO_STATIONS: Record<EquipmentId, string[]> = ALL_EQUIPMENT_IDS.reduce(
  (acc, eqId) => {
    acc[eqId] = STATIONS
      .filter((s) => s.equipmentAvailable?.includes(eqId))
      .map((s) => s.id);
    return acc;
  },
  {} as Record<EquipmentId, string[]>
);

// ============================================
// Helper functions
// ============================================

/**
 * Get the side (hot_side, cold_side, vending) for a station.
 * Returns "cold_side" as default if station not found.
 */
export function getStationSide(stationId: string | undefined): StationSide {
  if (!stationId) return "cold_side";
  return STATION_BY_ID[stationId]?.side ?? "cold_side";
}

/**
 * Get allowed sublocations for a station.
 * Returns all sublocations if station not found.
 */
export function getStationSublocations(stationId: string | undefined): SublocationId[] {
  if (!stationId) return ALL_SUBLOCATION_IDS;
  return STATION_BY_ID[stationId]?.sublocations ?? ALL_SUBLOCATION_IDS;
}

/**
 * Check if a sublocation is valid for a station.
 */
export function isValidSublocationForStation(
  stationId: string | undefined,
  sublocationId: SublocationId | undefined
): boolean {
  if (!sublocationId) return true; // no sublocation is always valid
  const allowed = getStationSublocations(stationId);
  return allowed.includes(sublocationId);
}

/**
 * @deprecated Use getAvailableEquipment instead.
 * Check if a station can be used as an appliance (equipment.applianceId).
 */
export function isEquipmentStation(stationId: string): boolean {
  return STATION_BY_ID[stationId]?.isEquipment ?? false;
}

/**
 * Get equipment available at a station.
 */
export function getAvailableEquipment(stationId: string | undefined): EquipmentId[] {
  if (!stationId) return [];
  return STATION_BY_ID[stationId]?.equipmentAvailable ?? [];
}

/**
 * Check if a specific equipment is available at a station.
 */
export function isEquipmentAvailableAtStation(
  stationId: string | undefined,
  equipmentId: EquipmentId | undefined
): boolean {
  if (!stationId || !equipmentId) return false;
  const available = getAvailableEquipment(stationId);
  return available.includes(equipmentId);
}

/**
 * Get stations where a specific equipment is available.
 */
export function getStationsWithEquipment(equipmentId: EquipmentId): string[] {
  return EQUIPMENT_TO_STATIONS[equipmentId] ?? [];
}

/**
 * Check if a sublocation is station-specific (only valid for certain stations).
 */
export function isStationSpecificSublocation(sublocationId: SublocationId): boolean {
  return ["stretch_table", "cut_table", "freezer"].includes(sublocationId);
}

/**
 * Get the default sublocation for a station (typically work_surface).
 */
export function getDefaultSublocation(stationId: string | undefined): SublocationId {
  if (!stationId) return "work_surface";
  const station = STATION_BY_ID[stationId];
  if (!station) return "work_surface";
  // Prefer work_surface, fall back to first available
  if (station.sublocations.includes("work_surface")) return "work_surface";
  return station.sublocations[0] ?? "work_surface";
}

// ============================================
// Equipment-to-Station derivation helpers
// ============================================

/**
 * Check if equipment is unique to a single station.
 * If true, stationId can be derived from equipment.
 */
export function isUniqueEquipment(equipmentId: EquipmentId | string): boolean {
  const stations = EQUIPMENT_TO_STATIONS[equipmentId as EquipmentId];
  return (stations?.length ?? 0) === 1;
}

/**
 * Check if equipment is shared across multiple stations.
 * If true, stationId must be explicitly specified.
 */
export function isSharedEquipment(equipmentId: EquipmentId | string): boolean {
  const stations = EQUIPMENT_TO_STATIONS[equipmentId as EquipmentId];
  return (stations?.length ?? 0) > 1;
}

/**
 * Get the station for equipment that's unique to one station.
 * Returns undefined if equipment is shared or unknown.
 */
export function getStationForUniqueEquipment(equipmentId: EquipmentId | string): string | undefined {
  const stations = EQUIPMENT_TO_STATIONS[equipmentId as EquipmentId];
  return stations?.length === 1 ? stations[0] : undefined;
}

/**
 * Check if stationId can be derived from equipment.
 * Returns true if equipment is unique, false if shared or missing.
 */
export function canDeriveStationFromEquipment(equipmentId: EquipmentId | string | undefined): boolean {
  if (!equipmentId) return false;
  return isUniqueEquipment(equipmentId);
}
