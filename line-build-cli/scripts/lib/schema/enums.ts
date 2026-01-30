import { z } from "zod";

/**
 * Enum and literal union types for the Line Build schema.
 * Separated to reduce circular dependencies and improve modularity.
 */

// -----------------------------
// Scalar IDs
// -----------------------------

export type BuildId = string;
export type ItemId = string;
export type MenuItemId = string;
export type StepId = string;
export type AssemblyId = string;
export type BomUsageId = string;
export type BomComponentId = string;
export type BomEntryId = string;

// -----------------------------
// Build Status
// -----------------------------

export type BuildStatus = "draft" | "published" | "archived";

// -----------------------------
// Action Family
// -----------------------------

export enum ActionFamily {
  PREP = "PREP",
  HEAT = "HEAT",
  TRANSFER = "TRANSFER",
  COMBINE = "COMBINE",
  ASSEMBLE = "ASSEMBLE",
  PORTION = "PORTION",
  CHECK = "CHECK",
  PACKAGING = "PACKAGING",
  OTHER = "OTHER",
}

// -----------------------------
// Cooking Phase
// -----------------------------

export enum CookingPhase {
  PRE_COOK = "PRE_COOK",
  COOK = "COOK",
  POST_COOK = "POST_COOK",
  ASSEMBLY = "ASSEMBLY",
  PASS = "PASS",
}

// -----------------------------
// Target Types
// -----------------------------

export type TargetType =
  | "bom_usage"
  | "bom_component"
  | "packaging"
  | "free_text"
  | "unknown";

// -----------------------------
// Kitchen Groupings & Stations
// -----------------------------

// Kitchen groupings - high-level area classification (3 values)
export type GroupingId = "hot_side" | "cold_side" | "vending";

// Stations - equipment and work areas
export type StationId =
  // Hot Side equipment
  | "fryer"
  | "waterbath"
  | "turbo"
  | "toaster"
  | "clamshell_grill"
  | "pizza"
  | "microwave"
  // Cold Side work areas
  | "garnish"
  | "speed_line"
  | "prep"
  // Expo
  | "expo"
  // Vending
  | "vending"
  // Fallback
  | "other"
  // Backwards compatibility (grouping values used as stationId in legacy data)
  | "hot_side"
  | "cold_side";

// -----------------------------
// Tools
// -----------------------------

export type ToolId =
  | "hand"
  | "tongs"
  | "mini_tong"
  | "paddle"
  | "spatula"
  | "spoon"
  | "spoodle_1oz"
  | "spoodle_2oz"
  | "spoodle_3oz"
  | "spoodle_5oz"
  | "spoodle_6oz"
  | "spoodle_8oz"
  | "fry_basket"
  | "squeeze_bottle"
  | "shaker"
  | "viper"
  | "scale"
  | "bench_scraper"
  | "utility_knife"
  | "whisk"
  | "ladle"
  | "pizza_wheel"
  | "butter_wheel"
  | "scissors"
  | "pan_grabber"
  | "avocado_knife"
  | "other";

// -----------------------------
// Appliances/Equipment
// -----------------------------

export type ApplianceId =
  | "fryer"
  | "waterbath"
  | "turbo"
  | "toaster"
  | "clamshell_grill"
  | "press"
  | "pizza"
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

// -----------------------------
// Sublocations
// -----------------------------

export type SublocationId =
  | "work_surface"
  | "cold_rail"
  | "dry_rail"
  | "cold_storage"
  | "packaging"
  | "kit_storage"
  | "window_shelf"
  | "equipment"
  // Station-specific sublocations
  | "stretch_table" // pizza only
  | "cut_table" // pizza only
  | "freezer"; // fryer only

// -----------------------------
// Containers
// -----------------------------

export type ContainerType =
  | "bag"
  | "bowl"
  | "pan"
  | "tray"
  | "clamshell"
  | "ramekin"
  | "cup"
  | "foil"
  | "lid"
  | "lexan"
  | "deli_cup"
  | "hotel_pan"
  | "squeeze_bottle"
  | "other";

// -----------------------------
// Prep & Quantity
// -----------------------------

export type PrepType = "pre_service" | "order_execution";
export type StepQuantityKind = "absolute" | "multiplier";

// -----------------------------
// Provenance & Validation
// -----------------------------

export type ProvenanceType =
  | "manual"
  | "inherited"
  | "overlay"
  | "inferred"
  | "legacy_import";

export type ValidationSeverity = "hard" | "strong" | "soft" | "info";

// -----------------------------
// Customization
// -----------------------------

export type CustomizationGroupType =
  | "MANDATORY_CHOICE"
  | "OPTIONAL_ADDITION"
  | "OPTIONAL_SUBTRACTION"
  | "EXTRA_REQUESTS"
  | "DISH_PREFERENCE"
  | "ON_THE_SIDE";

// -----------------------------
// Assembly Types
// -----------------------------

export type AssemblyType =
  | "intermediate"
  | "final"
  | "packaging"
  | "free_text"
  | "bom_usage"
  | "bom_component";

export type AssemblyInputRole = "base" | "added";

// -----------------------------
// Transfer Types
// -----------------------------

export type TransferType = "intra_station" | "inter_station" | "inter_pod";

// -----------------------------
// Build Reference
// -----------------------------

export type BuildRefRole = "prepared_component";
export type BuildRefVersion = number | "latest_published";

// SCHEMA-REFERENCE defines TechniqueId vocabulary, but the PoC contract does not constrain it.
export type TechniqueId = string;

// -----------------------------
// Zod Schemas for Enums
// -----------------------------

export const NonEmptyString = z.string().min(1);

export const GroupingIdSchema = z.union([
  z.literal("hot_side"),
  z.literal("cold_side"),
  z.literal("vending"),
]);

export const StationIdSchema = z.union([
  // Hot Side equipment
  z.literal("fryer"),
  z.literal("waterbath"),
  z.literal("turbo"),
  z.literal("toaster"),
  z.literal("clamshell_grill"),
  z.literal("pizza"),
  z.literal("microwave"),
  // Cold Side work areas
  z.literal("garnish"),
  z.literal("speed_line"),
  z.literal("prep"),
  // Expo
  z.literal("expo"),
  // Vending
  z.literal("vending"),
  // Fallback
  z.literal("other"),
  // Legacy grouping values used as stationId (backwards compatibility)
  z.literal("hot_side"),
  z.literal("cold_side"),
]);

export const ToolIdSchema = z.union([
  z.literal("hand"),
  z.literal("tongs"),
  z.literal("mini_tong"),
  z.literal("paddle"),
  z.literal("spatula"),
  z.literal("spoon"),
  z.literal("spoodle_1oz"),
  z.literal("spoodle_2oz"),
  z.literal("spoodle_3oz"),
  z.literal("spoodle_5oz"),
  z.literal("spoodle_6oz"),
  z.literal("spoodle_8oz"),
  z.literal("fry_basket"),
  z.literal("squeeze_bottle"),
  z.literal("shaker"),
  z.literal("viper"),
  z.literal("scale"),
  z.literal("bench_scraper"),
  z.literal("utility_knife"),
  z.literal("whisk"),
  z.literal("ladle"),
  z.literal("pizza_wheel"),
  z.literal("butter_wheel"),
  z.literal("scissors"),
  z.literal("pan_grabber"),
  z.literal("avocado_knife"),
  z.literal("other"),
]);

export const ApplianceIdSchema = z.union([
  z.literal("fryer"),
  z.literal("waterbath"),
  z.literal("turbo"),
  z.literal("toaster"),
  z.literal("clamshell_grill"),
  z.literal("press"),
  z.literal("pizza"),
  z.literal("pizza_oven"),
  z.literal("pizza_conveyor_oven"),
  z.literal("microwave"),
  z.literal("vending"),
  // Holding equipment
  z.literal("hot_box"),
  z.literal("hot_well"),
  z.literal("steam_well"),
  z.literal("sauce_warmer"),
  z.literal("other"),
]);

export const SublocationIdSchema = z.union([
  z.literal("work_surface"),
  z.literal("cold_rail"),
  z.literal("dry_rail"),
  z.literal("cold_storage"),
  z.literal("packaging"),
  z.literal("kit_storage"),
  z.literal("window_shelf"),
  z.literal("equipment"),
]);

export const ContainerTypeSchema = z.union([
  z.literal("bag"),
  z.literal("bowl"),
  z.literal("pan"),
  z.literal("tray"),
  z.literal("clamshell"),
  z.literal("ramekin"),
  z.literal("cup"),
  z.literal("foil"),
  z.literal("lid"),
  z.literal("lexan"),
  z.literal("deli_cup"),
  z.literal("hotel_pan"),
  z.literal("squeeze_bottle"),
  z.literal("other"),
]);

export const ProvenanceTypeSchema = z.union([
  z.literal("manual"),
  z.literal("inherited"),
  z.literal("overlay"),
  z.literal("inferred"),
  z.literal("legacy_import"),
]);

export const TransferTypeSchema = z.union([
  z.literal("intra_station"),
  z.literal("inter_station"),
  z.literal("inter_pod"),
]);
