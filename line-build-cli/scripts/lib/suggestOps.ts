/**
 * Generate candidate EditOps from validation errors.
 *
 * Not all rules are auto-fixable. This module provides suggestions
 * for rules where a reasonable default fix can be inferred.
 */

import type { EditOp } from "./edit";
import type { ValidationError } from "./validate";
import type { BenchTopLineBuild, Step } from "./schema";
import { getFixHint } from "./fixHints";
import { getAvailableEquipment } from "../../config/stations.config";

export type Suggestion = {
  ruleId: string;
  stepId?: string;
  message: string;
  fixHint: string | null;
  candidateOp?: EditOp;
  autoFixable: boolean;
};

/**
 * Rules that can be auto-fixed with reasonable defaults.
 */
const AUTO_FIXABLE_RULES = new Set([
  "H3",   // time.isActive missing -> default false
  "H15",  // HEAT missing equipment -> infer from station
  "H17",  // pre_service missing to.sublocation -> default cold_storage
  "H22",  // HEAT missing time or notes -> add placeholder notes
  "H24",  // PORTION missing quantity or notes -> add placeholder notes
  "H25",  // PREP missing techniqueId or notes -> add placeholder notes
  // H36 is not auto-fixable: stationId required only when ambiguous
]);

/**
 * Generate a Suggestion (with optional EditOp) for a validation error.
 */
export function generateSuggestion(
  error: ValidationError,
  build: BenchTopLineBuild
): Suggestion {
  const fixHint = getFixHint(error.ruleId);
  const base: Suggestion = {
    ruleId: error.ruleId,
    stepId: error.stepId,
    message: error.message,
    fixHint,
    autoFixable: AUTO_FIXABLE_RULES.has(error.ruleId),
  };

  if (!error.stepId) {
    // Build-level error, no step-specific op
    return base;
  }

  const step = build.steps.find((s) => s.id === error.stepId);
  if (!step) return base;

  const op = generateOpForRule(error.ruleId, step, build);
  if (op) {
    return { ...base, candidateOp: op };
  }

  return base;
}

/**
 * Generate all suggestions for a build's validation errors.
 */
export function generateSuggestions(
  errors: ValidationError[],
  build: BenchTopLineBuild
): Suggestion[] {
  return errors.map((err) => generateSuggestion(err, build));
}

/**
 * Generate an EditOp for a specific rule violation, if possible.
 */
function generateOpForRule(
  ruleId: string,
  step: Step,
  _build: BenchTopLineBuild
): EditOp | undefined {
  switch (ruleId) {
    case "H3": {
      // time.isActive missing or invalid
      if (step.time && step.time.isActive === undefined) {
        return {
          type: "set_field",
          where: `step.id = ${step.id}`,
          field: "step.time.isActive",
          value: false,
        };
      }
      break;
    }

    case "H15": {
      // HEAT step missing equipment
      // Try to infer from station's available equipment
      if (step.stationId) {
        const available = getAvailableEquipment(step.stationId);
        if (available.length === 1) {
          return {
            type: "set_field",
            where: `step.id = ${step.id}`,
            field: "step.equipment.applianceId",
            value: available[0]!,
          };
        }
        // If station has multiple equipment options, can't auto-fix
      }
      break;
    }

    case "H17": {
      // pre_service step missing to.sublocation
      return {
        type: "set_field",
        where: `step.id = ${step.id}`,
        field: "step.to.sublocation.type",
        value: "cold_storage",
      };
    }

    case "H22": {
      // HEAT step missing time or notes -> add placeholder notes
      if (!step.notes && !step.time?.durationSeconds) {
        return {
          type: "set_field",
          where: `step.id = ${step.id}`,
          field: "step.notes",
          value: "TODO: Add cooking time or instructions",
        };
      }
      break;
    }

    case "H24": {
      // PORTION step missing quantity or notes
      if (!step.notes && !step.quantity?.value) {
        return {
          type: "set_field",
          where: `step.id = ${step.id}`,
          field: "step.notes",
          value: "TODO: Add portion quantity",
        };
      }
      break;
    }

    case "H25": {
      // PREP step missing techniqueId or notes
      if (!step.notes && !step.action.techniqueId) {
        return {
          type: "set_field",
          where: `step.id = ${step.id}`,
          field: "step.notes",
          value: "TODO: Add prep technique",
        };
      }
      break;
    }

    case "H36": {
      // Station ambiguity needs human choice; no safe auto-fix.
      break;
    }
  }

  return undefined;
}

/**
 * Filter suggestions to only those that are auto-fixable with ops.
 */
export function getAutoFixableSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter((s) => s.autoFixable && s.candidateOp);
}

/**
 * Get ops from suggestions that can be directly applied.
 */
export function getOpsFromSuggestions(suggestions: Suggestion[]): EditOp[] {
  return suggestions
    .filter((s): s is Suggestion & { candidateOp: EditOp } => !!s.candidateOp)
    .map((s) => s.candidateOp);
}
