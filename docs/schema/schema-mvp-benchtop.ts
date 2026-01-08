// BENCH-TOP LINE BUILD DATA MODEL (MVP)
// ---------------------------------------------------------
// This schema defines the "Master Item" -- a single source of truth for a menu item's
// production process. It supports conditional logic (to avoid cloning) and 
// parallel tracks (for hot/cold separation).

// 1. THE CONTAINER
// =========================================================
interface BenchTopLineBuild {
  id: string;                 // UUID
  menu_item_id: string;       // Link to Catalog Item (The "What")
  version: number;            // Immutable version number
  status: 'draft' | 'published' | 'archived';
  
  // The "Tracks" definition allows us to model parallel work (Hot vs Cold)
  tracks: TrackDefinition[];
  
  // The complete pool of all possible steps for this item
  steps: Step[];
  
  // Metadata for the human author
  change_log?: string;
  author_id: string;
  created_at: string;
}

interface TrackDefinition {
  id: string;             // e.g., "track_hot", "track_cold", "track_expo"
  name: string;           // Display name: "Hot Line", "Garnish", "Assembly"
  default_station_id?: string; // Default routing for steps in this track
}

// 2. THE STEP (Primitive Unit of Work)
// =========================================================
interface Step {
  id: string;             // UUID
  track_id: string;       // Which parallel track this belongs to
  order_index: number;    // Relative order within the track

  // 2A. LOGIC & CONTROL FLOW
  // -------------------------------------------------------
  // If defined, this step ONLY appears if the condition is met.
  // If null, this is a SHARED step (applies to all variants).
  condition?: StepCondition; 

  // 2B. CORE DEFINITION
  // -------------------------------------------------------
  kind: 'component' | 'action' | 'quality_check';
  
  // The Anchor: What are we acting on?
  // REQUIRED for 'component' steps. Links to BOM.
  target?: {
    bom_usage_id: string;      // The stable 40*/41* usage ID
    component_name?: string;   // Snapshot for readability
  };

  // The Action: What are we doing?
  action: {
    family: ActionFamily;      // REQUIRED Enum (Heat, Transfer, etc.)
    detail_id?: string;        // Optional specific technique ID (e.g., "sear", "drizzle")
    display_text_override?: string; // Only if generated text needs manual fix
  };

  // 2C. EXECUTION DETAILS (Inheritable)
  // -------------------------------------------------------
  // These can inherit from the Menu Item <-> BOM Usage link.
  // We store them here only if OVERRIDDEN or if no default exists.
  
  station_id?: string;       // Where: Service Location (Cold Rail, Hot Hold)
  tool_id?: string;          // With: Spoodle, Tongs
  
  // Cooking Equipment is distinct from Station
  equipment?: {
    appliance_id: string;    // Turbo, Fryer, Waterbath
    setting_id?: string;     // Preset ID (e.g., "Toast 3")
  };

  // 2D. QUANTITY & TIMING
  // -------------------------------------------------------
  quantity?: {
    value?: number;          // Operational count (e.g., 2)
    unit_id?: string;        // "scoop", "slice", "pinch"
    notes?: string;          // "generous amount"
  };

  time?: {
    duration_seconds: number; // Estimated execution time
    is_active_time: boolean;  // True = Chef is busy; False = Waiting (e.g. frying)
  };
  
  notes?: string;
}

// 3. CONDITIONS (The Anti-Cloning Mechanism)
// =========================================================
// A step exists ONLY if these criteria match the context.
interface StepCondition {
  // Logic: "AND" implies all must match.
  // For "OR" logic, use multiple steps or separate condition objects (MVP simplified to AND).
  
  // 1. Equipment Capability: "Only if kitchen has a Fryer"
  requires_equipment_profile?: string[]; 
  
  // 2. Customization: "Only if user selected 'Extra Spicy'"
  requires_customization_option_id?: string[];
  
  // 3. Restaurant Override: "Only at these specific legacy sites"
  // (Use sparingly; prefer equipment profiles)
  requires_restaurant_id?: string[];
}

// 4. ENUMS & REFERENCE LISTS
// =========================================================
enum ActionFamily {
  PREP = 'PREP',        // Open, Stage
  HEAT = 'HEAT',        // Cook, Re-therm, Toast
  TRANSFER = 'TRANSFER',// Move from A to B
  COMBINE = 'COMBINE',  // Add X to Y, Mix
  ASSEMBLE = 'ASSEMBLE',// Build (Stack, Wrap)
  PORTION = 'PORTION',  // Measure out
  CHECK = 'CHECK',      // QA, Temp check
  VEND = 'VEND',        // Hand off
  OTHER = 'OTHER'
}

// 5. EXAMPLE INSTANCE (Spicy Chicken Sandwich)
// =========================================================
/*
{
  "id": "build_123",
  "menu_item_id": "item_spicy_chicken",
  "tracks": [
    { "id": "hot", "name": "Hot Line" },
    { "id": "cold", "name": "Assembly Board" }
  ],
  "steps": [
    // SHARED: Bun Prep (Cold Track)
    {
      "track_id": "cold",
      "order_index": 1,
      "kind": "component",
      "target": { "bom_usage_id": "usage_bun_001" },
      "action": { "family": "PREP", "detail_id": "open" }
    },
    
    // VARIANT A: FRYER (Hot Track)
    {
      "track_id": "hot",
      "order_index": 1,
      "condition": { "requires_equipment_profile": ["fryer_standard"] },
      "kind": "component",
      "target": { "bom_usage_id": "usage_chicken_patty" },
      "action": { "family": "HEAT", "detail_id": "deep_fry" },
      "equipment": { "appliance_id": "fryer" },
      "time": { "duration_seconds": 180, "is_active_time": false }
    },
    
    // VARIANT B: TURBO (Hot Track)
    {
      "track_id": "hot",
      "order_index": 1,
      "condition": { "requires_equipment_profile": ["turbo_high_speed"] },
      "kind": "component",
      "target": { "bom_usage_id": "usage_chicken_patty" },
      "action": { "family": "HEAT", "detail_id": "turbo_toast" },
      "equipment": { "appliance_id": "turbo" },
      "time": { "duration_seconds": 120, "is_active_time": false }
    },
    
    // SHARED: Assembly (Expo Track - implied merge)
    {
      "track_id": "cold",
      "order_index": 2,
      "kind": "action",
      "action": { "family": "ASSEMBLE", "detail_id": "build" },
      "notes": "Place hot chicken on bun"
    }
  ]
}
*/






