// Equipment presets (from real appliance programs)
export const EQUIPMENT_PRESETS: Record<string, Record<string, { durationSeconds: number }>> = {
  turbo: {
    default: { durationSeconds: 180 },
    chicken_breast: { durationSeconds: 180 },
    steak_medium: { durationSeconds: 240 },
  },
  waterbath: {
    default: { durationSeconds: 360 },
    brisket_pouch: { durationSeconds: 360 },
    chicken_pouch: { durationSeconds: 300 },
  },
  press: {
    default: { durationSeconds: 180 },
    quesadilla: { durationSeconds: 180 },
    panini: { durationSeconds: 150 },
  },
};

// Technique durations (PREP actions)
export const TECHNIQUE_DURATIONS: Record<string, number> = {
  dice: 20,
  julienne: 35,
  slice: 15,
  retrieve: 5,
  open_pack: 5,
  fold: 8,
  place: 5,
  handoff: 5,
  pass: 5,
};

// Assembly complexity by output type
export const ASSEMBLY_COMPLEXITY: Record<string, { baseSeconds: number }> = {
  burrito: { baseSeconds: 30 },
  bowl: { baseSeconds: 12 },
  quesadilla: { baseSeconds: 15 },
  taco: { baseSeconds: 15 },
  salad: { baseSeconds: 12 },
};

// Temporary mapping from build.itemId or name to assembly type
export const BUILD_ASSEMBLY_TYPE: Record<string, string> = {
  "8006896": "quesadilla",
  "beef-barbacoa-quesadilla": "quesadilla",
};

// Family defaults (fallback)
export const ACTION_FAMILY_DEFAULTS: Record<string, number> = {
  PREP: 10,
  PORTION: 8,
  ASSEMBLE: 15,
  TRANSFER: 5,
  PACKAGING: 10,
  CHECK: 5,
  HEAT: 60, // Fallback if no explicit time or preset (1 minute safety default)
  OTHER: 10,
};
