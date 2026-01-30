import type { Step } from "@/types";
import {
  EQUIPMENT_PRESETS,
  TECHNIQUE_DURATIONS,
  ASSEMBLY_COMPLEXITY,
  ACTION_FAMILY_DEFAULTS,
  BUILD_ASSEMBLY_TYPE,
} from "@/data/time-references";

export type ResolvedDuration = {
  seconds: number;
  source: "explicit" | "equipment_preset" | "technique" | "assembly" | "family_default";
  sourceDetail?: string;
  confidence: "high" | "medium" | "low";
};

export function resolveStepDuration(
  step: Step,
  context?: { menuItemType?: string; buildId?: string; buildName?: string }
): ResolvedDuration {
  // 1. Explicit override on step
  if (step.time?.durationSeconds && step.time.durationSeconds > 0) {
    return {
      seconds: step.time.durationSeconds,
      source: "explicit",
      confidence: "high",
    };
  }

  // 2. HEAT -> equipment preset
  if (step.action.family === "HEAT" && step.equipment?.applianceId) {
    const appliance = EQUIPMENT_PRESETS[step.equipment.applianceId];
    if (appliance) {
      const presetId = step.equipment.presetId || "default";
      const preset = appliance[presetId];
      if (preset) {
        return {
          seconds: preset.durationSeconds,
          source: "equipment_preset",
          sourceDetail: `${step.equipment.applianceId}/${presetId}`,
          confidence: "high",
        };
      }
    }
  }

  // 3. PREP/PORTION -> technique lookup
  if (step.action.techniqueId) {
    const techTime = TECHNIQUE_DURATIONS[step.action.techniqueId];
    if (techTime) {
      return {
        seconds: techTime,
        source: "technique",
        sourceDetail: step.action.techniqueId,
        confidence: "medium",
      };
    }
  }

  // 4. ASSEMBLE -> output type complexity
  if (step.action.family === "ASSEMBLE") {
    const assemblyType =
      context?.menuItemType ||
      (context?.buildId ? BUILD_ASSEMBLY_TYPE[context.buildId] : undefined) ||
      (context?.buildName ? BUILD_ASSEMBLY_TYPE[context.buildName] : undefined);

    if (assemblyType) {
      const complexity = ASSEMBLY_COMPLEXITY[assemblyType];
      if (complexity) {
        return {
          seconds: complexity.baseSeconds,
          source: "assembly",
          sourceDetail: assemblyType,
          confidence: "medium",
        };
      }
    }
  }

  // 5. Fallback to family default
  const familyDefault = ACTION_FAMILY_DEFAULTS[step.action.family] ?? 10;
  return {
    seconds: familyDefault,
    source: "family_default",
    sourceDetail: step.action.family,
    confidence: "low",
  };
}
