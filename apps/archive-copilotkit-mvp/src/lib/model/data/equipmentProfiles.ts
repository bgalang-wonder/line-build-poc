/**
 * Equipment Profile Registry
 * Defines available equipment profiles and their capabilities
 * Used for scenario-based overlay resolution
 */

import { EquipmentProfile, CustomizationValue } from "../types";

/**
 * Available equipment profiles
 * Each profile defines what equipment capabilities are available at a location
 * Profiles are used in overlay predicates to select variant workflows
 */
export const EQUIPMENT_PROFILES: EquipmentProfile[] = [
  {
    id: "profile_waterbath",
    label: "Waterbath Kitchen",
    capabilities: ["waterbath", "portion_scale", "prep_stations"],
  },
  {
    id: "profile_turbo",
    label: "Turbo Kitchen",
    capabilities: ["turbo", "portion_scale", "prep_stations"],
  },
  {
    id: "profile_full_service",
    label: "Full Service Kitchen",
    capabilities: ["waterbath", "turbo", "fryer", "oven", "portion_scale", "prep_stations"],
  },
  {
    id: "profile_satellite",
    label: "Satellite Kitchen",
    capabilities: ["microwave", "hot_hold_wells", "portion_scale"],
  },
];

/**
 * Get a profile by ID
 */
export function getEquipmentProfile(id: string): EquipmentProfile | undefined {
  return EQUIPMENT_PROFILES.find((p) => p.id === id);
}

/**
 * Get all profiles
 */
export function getAllEquipmentProfiles(): EquipmentProfile[] {
  return EQUIPMENT_PROFILES;
}

/**
 * Find profiles that have a specific capability
 */
export function getProfilesByCapability(capability: string): EquipmentProfile[] {
  return EQUIPMENT_PROFILES.filter((p) => p.capabilities.includes(capability));
}

/**
 * Customization values registry
 * Tracks optional add-ons and customizations that affect workflow variants
 */
export const CUSTOMIZATION_VALUES: CustomizationValue[] = [
  {
    optionId: "opt_sauce",
    valueId: "custom_add_sauce",
    label: "Add sauce on the side",
  },
  {
    optionId: "opt_sauce",
    valueId: "custom_add_sauce_mixed",
    label: "Mix sauce into dish",
  },
  {
    optionId: "opt_protein",
    valueId: "custom_protein_double",
    label: "Double protein",
  },
  {
    optionId: "opt_sides",
    valueId: "custom_extra_sides",
    label: "Extra sides",
  },
];

/**
 * Get a customization value by ID
 */
export function getCustomizationValue(
  valueId: string
): CustomizationValue | undefined {
  return CUSTOMIZATION_VALUES.find((c) => c.valueId === valueId);
}

/**
 * Get all customization values
 */
export function getAllCustomizationValues(): CustomizationValue[] {
  return CUSTOMIZATION_VALUES;
}

/**
 * Get customization values for a specific option
 */
export function getCustomizationsByOption(
  optionId: string
): CustomizationValue[] {
  return CUSTOMIZATION_VALUES.filter((c) => c.optionId === optionId);
}

/**
 * Sample equipment profiles for testing
 * These match real kitchen scenarios
 */
export const SAMPLE_SCENARIOS = {
  waterbath: {
    equipmentProfileId: "profile_waterbath",
    capabilities: ["waterbath", "portion_scale", "prep_stations"],
    selectedCustomizationValueIds: [],
    customizationCount: 0,
  },
  turbo: {
    equipmentProfileId: "profile_turbo",
    capabilities: ["turbo", "portion_scale", "prep_stations"],
    selectedCustomizationValueIds: [],
    customizationCount: 0,
  },
  fullService: {
    equipmentProfileId: "profile_full_service",
    capabilities: ["waterbath", "turbo", "fryer", "oven", "portion_scale", "prep_stations"],
    selectedCustomizationValueIds: [],
    customizationCount: 0,
  },
  turboWithSauce: {
    equipmentProfileId: "profile_turbo",
    capabilities: ["turbo", "portion_scale", "prep_stations"],
    selectedCustomizationValueIds: ["custom_add_sauce"],
    customizationCount: 1,
  },
};
