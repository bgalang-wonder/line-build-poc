import type { ValidationOutput, ValidationError } from "@/types";

export type RuleSummary = {
  ruleId: string;
  severity: "hard" | "strong" | "soft";
  count: number;
  stepIds: string[];
  fieldPaths: string[];
};

export function buildRuleSummaries(validation: ValidationOutput | null): RuleSummary[] {
  if (!validation) return [];

  const combined = [...(validation.hardErrors ?? []), ...(validation.warnings ?? [])];
  const summaries = new Map<string, RuleSummary>();

  for (const err of combined) {
    const existing = summaries.get(err.ruleId);
    if (existing) {
      existing.count++;
      if (err.stepId && !existing.stepIds.includes(err.stepId)) {
        existing.stepIds.push(err.stepId);
      }
      if (err.fieldPath && !existing.fieldPaths.includes(err.fieldPath)) {
        existing.fieldPaths.push(err.fieldPath);
      }
    } else {
      summaries.set(err.ruleId, {
        ruleId: err.ruleId,
        severity: err.severity,
        count: 1,
        stepIds: err.stepId ? [err.stepId] : [],
        fieldPaths: err.fieldPath ? [err.fieldPath] : [],
      });
    }
  }

  return Array.from(summaries.values()).sort((a, b) => {
    // Priority: hard > strong > soft
    const severityMap = { hard: 0, strong: 1, soft: 2 };
    const sevA = severityMap[a.severity] ?? 99;
    const sevB = severityMap[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    // Then by count desc
    if (b.count !== a.count) return b.count - a.count;
    // Then alpha ruleId
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export function getHardErrorCountByStepId(validation: ValidationOutput | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!validation) return map;
  
  for (const e of validation.hardErrors ?? []) {
    if (!e.stepId) continue;
    map.set(e.stepId, (map.get(e.stepId) ?? 0) + 1);
  }
  return map;
}
