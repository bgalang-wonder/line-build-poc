import type { BenchTopLineBuild } from "./schema";
import { buildMatchLabel } from "./query";

export type SearchNotesMatch = {
  buildId: string;
  itemId: string;
  version: number;
  status: BenchTopLineBuild["status"];
  stepId: string;
  orderIndex: number;
  field: "instruction" | "notes";
  matchText: string;
  snippet: string;
  label: string;
};

function makeSnippet(text: string, start: number, end: number): string {
  const radius = 48;
  const a = Math.max(0, start - radius);
  const b = Math.min(text.length, end + radius);
  const prefix = a > 0 ? "..." : "";
  const suffix = b < text.length ? "..." : "";
  return `${prefix}${text.slice(a, b)}${suffix}`.replace(/\s+/g, " ").trim();
}

export function searchNotes(input: {
  builds: BenchTopLineBuild[];
  pattern: string;
  flags?: string;
}): { regex: { pattern: string; flags: string }; matches: SearchNotesMatch[] } {
  const flags = input.flags ?? "";
  const re = new RegExp(input.pattern, flags);

  const matches: SearchNotesMatch[] = [];

  for (const build of input.builds) {
    for (const step of build.steps) {
      const instruction = typeof step.instruction === "string" ? step.instruction : "";
      const notes = typeof step.notes === "string" ? step.notes : "";

      // Per spec: search instruction if present; fallback to notes.
      const field: "instruction" | "notes" =
        instruction.trim().length > 0 ? "instruction" : "notes";
      const text = field === "instruction" ? instruction : notes;
      if (text.trim().length === 0) continue;

      const m = re.exec(text);
      if (!m) continue;

      const start = m.index;
      const end = m.index + (m[0]?.length ?? 0);

      matches.push({
        buildId: build.id,
        itemId: build.itemId,
        version: build.version,
        status: build.status,
        stepId: step.id,
        orderIndex: step.orderIndex,
        field,
        matchText: m[0] ?? "",
        snippet: makeSnippet(text, start, end),
        label: buildMatchLabel(step),
      });
    }
  }

  matches.sort((a, b) => {
    if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
    if (a.version !== b.version) return a.version - b.version;
    if (a.buildId !== b.buildId) return a.buildId.localeCompare(b.buildId);
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.stepId.localeCompare(b.stepId);
  });

  return { regex: { pattern: input.pattern, flags }, matches };
}

