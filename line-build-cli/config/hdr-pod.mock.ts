/**
 * Mock HDR Pod Configuration.
 *
 * Current configuration represents a realistic HDR with:
 * - 11 pods total
 * - 31 appliances across pods
 * - Equipment distribution for hot, cold, hybrid, expo, and vending pods
 *
 * Pod Breakdown:
 * - 3 Cold Pods (presses + toasters for assembly work)
 * - 3 Hot Pods (turbo ovens, water baths, fryers, microwaves for cooking)
 * - 3 Hybrid Pods (mixed equipment including pizza/PISA station)
 * - 1 Expo Pod (holding/staging)
 * - 1 Vending Pod
 *
 * Future: This will be replaced with BigQuery lookup via `pod_configurations_v4` table.
 */

// ============================================
// Types
// ============================================

export type PodType =
  | "HOT"
  | "COLD"
  | "HYBRID"
  | "CLAMSHELL"
  | "PIZZA"
  | "EXPO"
  | "VENDING";

export interface Pod {
  podId: string;
  podType: PodType;
  /** Equipment installed in this pod (uppercase equipment IDs) */
  equipment: string[];
}

export interface HdrPodConfig {
  hdrId: string;
  /** Display name for this HDR configuration */
  name: string;
  pods: Pod[];
  /** Station → default pod type mapping (when equipment doesn't constrain) */
  stationPodDefaults: Record<string, PodType>;
  /** Explicit station → pod ID mapping (for stations not tied to unique equipment) */
  stationLocations?: Record<string, string>;
}

// ============================================
// Mock Configuration (Park Slope HDR)
// ============================================

/**
 * Mock HDR config with 11 pods and 31 appliances.
 * Represents a realistic HDR configuration for complexity scoring.
 */
export const MOCK_HDR_POD_CONFIG: HdrPodConfig = {
  hdrId: "mock-hdr-11-pod",
  name: "Mock 11-Pod Layout",

  pods: [
    // ============================================
    // COLD PODS (3) - Assembly and cold prep
    // ============================================
    {
      podId: "Cold_Pod_1A",
      podType: "COLD",
      equipment: ["PRESS", "TOASTER"],
    },
    {
      podId: "Cold_Pod_2A",
      podType: "COLD",
      equipment: ["PRESS", "TOASTER"],
    },
    {
      podId: "Cold_Pod_3A",
      podType: "COLD",
      equipment: ["PRESS", "TOASTER"],
    },

    // ============================================
    // HOT PODS (3) - Primary cooking stations
    // ============================================
    {
      podId: "Hot_Pod_1A",
      podType: "HOT",
      equipment: ["TURBO_OVEN", "TURBO_OVEN", "TURBO_OVEN", "TURBO_OVEN"],
    },
    {
      podId: "Hot_Pod_2A",
      podType: "HOT",
      equipment: ["WATER_BATH", "WATER_BATH", "MICROWAVE", "MICROWAVE"],
    },
    {
      podId: "Hot_Pod_3A",
      podType: "HOT",
      equipment: ["FRYER", "FRYER"],
    },

    // ============================================
    // HYBRID PODS (3) - Mixed hot/cold workflows
    // ============================================
    {
      podId: "Hybrid_Pod_1C",
      podType: "HYBRID",
      equipment: ["WATER_BATH", "PRESS", "RICE_COOKER", "TURBO_OVEN"],
    },
    {
      podId: "Hybrid_Pod_1D",
      podType: "HYBRID",
      equipment: ["TURBO_OVEN", "TURBO_OVEN", "WATER_BATH"], // PISA (pizza) station
    },
    {
      podId: "Hybrid_Pod_2C",
      podType: "HYBRID",
      equipment: ["PRESS", "WATER_BATH", "TURBO_OVEN"],
    },

    // ============================================
    // EXPO POD (1) - Final handoff/staging
    // ============================================
    {
      podId: "Expo_Pod_1",
      podType: "EXPO",
      equipment: [],
    },

    // ============================================
    // VENDING POD (1) - Automated dispensing
    // ============================================
    {
      podId: "Vending_Pod_1A",
      podType: "VENDING",
      equipment: ["VENDING"],
    },
  ],

  /**
   * Default pod type for each station.
   * Used when equipment doesn't constrain the choice.
   */
  stationPodDefaults: {
    fryer: "HOT",
    waterbath: "HOT",
    turbo: "HOT",
    microwave: "HOT",
    clamshell_grill: "CLAMSHELL",
    press: "COLD", // Can be COLD, HYBRID, or CLAMSHELL
    toaster: "COLD", // Can be COLD or CLAMSHELL
    garnish: "COLD",
    pizza: "PIZZA",
    expo: "EXPO",
    prep: "COLD",
    vending: "VENDING",
    speed_line: "COLD",
  },

  /**
   * Explicit station locations for non-equipment stations.
   * Equipment-based stations (fryer, waterbath, turbo, etc.) are derived from pod.equipment.
   */
  stationLocations: {
    garnish: "Cold_Pod_1A",
    speed_line: "Cold_Pod_2A",
    prep: "Cold_Pod_3A",
    expo: "Expo_Pod_1",
    vending: "Vending_Pod_1A",
  },
};

// ============================================
// Equipment ID Normalization
// ============================================

/**
 * Normalize equipment ID to uppercase for pod lookup.
 * Pod configs use uppercase equipment names.
 */
export function normalizeEquipmentId(equipmentId: string): string {
  const mapping: Record<string, string> = {
    fryer: "FRYER",
    waterbath: "WATER_BATH",
    turbo: "TURBO_OVEN",
    toaster: "TOASTER",
    clamshell_grill: "CLAMSHELL",
    press: "PRESS",
    pizza_oven: "PIZZA_OVEN",
    pizza_conveyor_oven: "PIZZA_CONVEYOR_OVEN",
    microwave: "MICROWAVE",
    vending: "VENDING",
    hot_box: "HOT_BOX",
    hot_well: "HOT_WELL",
    steam_well: "STEAM_WELL",
    sauce_warmer: "SAUCE_WARMER",
    rice_cooker: "RICE_COOKER",
  };
  return mapping[equipmentId.toLowerCase()] ?? equipmentId.toUpperCase();
}

// ============================================
// Pod Assignment Functions
// ============================================

/**
 * Find pods that have a specific equipment.
 */
export function findPodsWithEquipment(
  config: HdrPodConfig,
  equipmentId: string
): Pod[] {
  const normalizedEquipment = normalizeEquipmentId(equipmentId);
  return config.pods.filter((pod) =>
    pod.equipment.includes(normalizedEquipment)
  );
}

/**
 * Find pods of a specific type.
 */
export function findPodsByType(config: HdrPodConfig, podType: PodType): Pod[] {
  return config.pods.filter((pod) => pod.podType === podType);
}

/**
 * Map station IDs to their primary equipment.
 * Used to assign consistent pods for equipment-based stations.
 */
const STATION_PRIMARY_EQUIPMENT: Record<string, string> = {
  fryer: "FRYER",
  waterbath: "WATER_BATH",
  turbo: "TURBO_OVEN",
  microwave: "MICROWAVE",
  clamshell_grill: "CLAMSHELL",
  press: "PRESS",
  toaster: "TOASTER",
  pizza: "PIZZA_OVEN",
};

/**
 * Assign a pod for a step based on equipment and station.
 *
 * Strategy:
 * 1. If station has explicit location mapping, use that
 * 2. If equipment is specified, find pods with that equipment
 * 3. If station is equipment-based (waterbath, fryer, etc.), find pods with that equipment
 * 4. Otherwise, use station → pod type default
 * 5. Return first matching pod (conservative/simple assignment)
 *
 * This ensures all steps at an equipment-based station are assigned to the same pod,
 * avoiding artificial inter-pod transfers within the same station.
 *
 * @param equipmentId The equipment needed (if any)
 * @param stationId The station for this step
 * @param config The HDR pod configuration
 * @returns Pod ID, or undefined if can't determine
 */
export function assignPodForStep(
  equipmentId: string | undefined,
  stationId: string | undefined,
  config: HdrPodConfig = MOCK_HDR_POD_CONFIG
): string | undefined {
  // Check explicit station location first
  if (stationId && config.stationLocations?.[stationId]) {
    return config.stationLocations[stationId];
  }

  // If equipment specified, find pods with that equipment
  if (equipmentId) {
    const podsWithEquipment = findPodsWithEquipment(config, equipmentId);
    if (podsWithEquipment.length > 0) {
      // Return first matching pod (could be smarter about this)
      return podsWithEquipment[0].podId;
    }
  }

  // If no equipment but station is equipment-based, infer equipment from station
  // This ensures all steps at an equipment station go to the same pod
  if (stationId && STATION_PRIMARY_EQUIPMENT[stationId]) {
    const primaryEquipment = STATION_PRIMARY_EQUIPMENT[stationId];
    const podsWithEquipment = findPodsWithEquipment(config, primaryEquipment);
    if (podsWithEquipment.length > 0) {
      return podsWithEquipment[0].podId;
    }
  }

  // Fall back to station default pod type
  if (stationId) {
    const defaultPodType = config.stationPodDefaults[stationId];
    if (defaultPodType) {
      const podsOfType = findPodsByType(config, defaultPodType);
      if (podsOfType.length > 0) {
        return podsOfType[0].podId;
      }
    }
  }

  return undefined;
}

/**
 * Get all unique pod IDs from a config.
 */
export function getAllPodIds(config: HdrPodConfig = MOCK_HDR_POD_CONFIG): string[] {
  return config.pods.map((p) => p.podId);
}

/**
 * Get the pod type for a pod ID.
 */
export function getPodType(
  podId: string,
  config: HdrPodConfig = MOCK_HDR_POD_CONFIG
): PodType | undefined {
  return config.pods.find((p) => p.podId === podId)?.podType;
}

/**
 * Check if two pods are the same (for transfer type determination).
 */
export function isSamePod(
  podId1: string | undefined,
  podId2: string | undefined
): boolean {
  if (!podId1 || !podId2) return false;
  return podId1 === podId2;
}
