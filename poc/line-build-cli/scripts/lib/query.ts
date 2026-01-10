import type { BenchTopLineBuild, Step } from "./schema";

/**
 * Query DSL implementation (PoC).
 *
 * Source of truth:
 * - docs/handoff/POC_TASKS.json -> shared_conventions.dsl_contract
 *
 * Grammar:
 * - Conjunction of clauses separated by AND (no parentheses).
 * - Clause forms:
 *   - <field> = <value>
 *   - <field> != <value>
 *   - <field> in [<value>, <value>, ...]
 *   - exists(<field>)
 *
 * Whitelist:
 * - field_whitelist in POC_TASKS.json
 */

export type QueryPrimitive = string | number | boolean;

export type QueryClause =
  | { kind: "eq"; field: QueryField; value: QueryPrimitive }
  | { kind: "ne"; field: QueryField; value: QueryPrimitive }
  | { kind: "in"; field: QueryField; values: QueryPrimitive[] }
  | { kind: "exists"; field: QueryField };

export type QueryMatch = {
  buildId: string;
  itemId: string;
  version: number;
  status: BenchTopLineBuild["status"];
  stepId: string;
  orderIndex: number;
  /**
   * Deterministic short label/snippet for review.
   * Contract requirement: "label snippet"
   */
  label: string;
};

export const QUERY_FIELD_WHITELIST = [
  "step.action.family",
  "step.action.techniqueId",
  "step.equipment.applianceId",
  "step.time.durationSeconds",
  "step.cookingPhase",
  "step.prepType",
  "step.storageLocation.type",
  "step.container.type",
  "step.stationId",
  "step.target.bomUsageId",
  "step.target.bomComponentId",
  "build.itemId",
  "build.status",
  "build.requiresBuilds.itemId",
] as const;

export type QueryField = (typeof QUERY_FIELD_WHITELIST)[number];

export class QueryParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryParseError";
  }
}

function isWhitelistedField(field: string): field is QueryField {
  return (QUERY_FIELD_WHITELIST as readonly string[]).includes(field);
}

function isQueryPrimitive(v: unknown): v is QueryPrimitive {
  return (
    typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === `"` || q === `'`) && t[t.length - 1] === q) {
      return t.slice(1, -1);
    }
  }
  return t;
}

export function coerceQueryValue(raw: string): QueryPrimitive {
  const t = unquote(raw.trim());
  if (/^\d+$/.test(t)) return Number(t);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}

function splitTopLevelAnd(where: string): string[] {
  const s = where.trim();
  if (s.length === 0) return [];

  const parts: string[] = [];
  let buf = "";
  let inQuote: "'" | '"' | null = null;
  let bracketDepth = 0;

  const flush = () => {
    const t = buf.trim();
    if (t.length > 0) parts.push(t);
    buf = "";
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;

    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      buf += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inQuote = ch;
      buf += ch;
      continue;
    }

    if (ch === "[") {
      bracketDepth++;
      buf += ch;
      continue;
    }
    if (ch === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      buf += ch;
      continue;
    }

    // Only split on AND when not in quotes/brackets.
    if (bracketDepth === 0) {
      const maybe = s.slice(i);
      if (/^(\s+AND\s+)/.test(maybe)) {
        // consume the leading whitespace + AND + trailing whitespace
        const m = maybe.match(/^(\s+AND\s+)/);
        if (m) {
          flush();
          i += m[1].length - 1;
          continue;
        }
      }
    }

    buf += ch;
  }

  flush();
  return parts;
}

function splitCsvValues(inner: string): string[] {
  const s = inner.trim();
  const out: string[] = [];
  let buf = "";
  let inQuote: "'" | '"' | null = null;

  const flush = () => {
    const t = buf.trim();
    if (t.length > 0) out.push(t);
    buf = "";
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      buf += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inQuote = ch;
      buf += ch;
      continue;
    }
    if (ch === ",") {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

export function parseWhere(where: string): QueryClause[] {
  const clausesRaw = splitTopLevelAnd(where);
  if (clausesRaw.length === 0) {
    throw new QueryParseError("where is required and cannot be empty");
  }

  const clauses: QueryClause[] = [];

  for (const rawClause of clausesRaw) {
    const c = rawClause.trim();

    // exists(<field>)
    const existsMatch = c.match(/^exists\((.+)\)$/);
    if (existsMatch) {
      const field = existsMatch[1]!.trim();
      if (!isWhitelistedField(field)) {
        throw new QueryParseError(
          `field not allowed in where: ${field} (must be in whitelist)`,
        );
      }
      clauses.push({ kind: "exists", field });
      continue;
    }

    // <field> in [ ... ]
    const inMatch = c.match(/^(.+?)\s+in\s+\[(.*)\]$/);
    if (inMatch) {
      const fieldRaw = inMatch[1]!.trim();
      const inner = inMatch[2]!.trim();
      if (!isWhitelistedField(fieldRaw)) {
        throw new QueryParseError(
          `field not allowed in where: ${fieldRaw} (must be in whitelist)`,
        );
      }
      const rawVals = inner.length === 0 ? [] : splitCsvValues(inner);
      const values = rawVals.map(coerceQueryValue).filter(isQueryPrimitive);
      clauses.push({ kind: "in", field: fieldRaw, values });
      continue;
    }

    // <field> != <value>   OR   <field> = <value>
    const opMatch = c.match(/^(.+?)\s*(!=|=)\s*(.+)$/);
    if (opMatch) {
      const fieldRaw = opMatch[1]!.trim();
      const op = opMatch[2]!;
      const valueRaw = opMatch[3]!.trim();
      if (!isWhitelistedField(fieldRaw)) {
        throw new QueryParseError(
          `field not allowed in where: ${fieldRaw} (must be in whitelist)`,
        );
      }
      const value = coerceQueryValue(valueRaw);
      if (op === "=") clauses.push({ kind: "eq", field: fieldRaw, value });
      else clauses.push({ kind: "ne", field: fieldRaw, value });
      continue;
    }

    throw new QueryParseError(`could not parse clause: ${c}`);
  }

  return clauses;
}

function getFieldValues(
  field: QueryField,
  build: BenchTopLineBuild,
  step: Step,
): QueryPrimitive[] {
  // Note: returning [] means "no value present"
  switch (field) {
    // step.*
    case "step.action.family":
      return [step.action.family];
    case "step.action.techniqueId":
      return typeof step.action.techniqueId === "string"
        ? [step.action.techniqueId]
        : [];
    case "step.equipment.applianceId":
      return step.equipment?.applianceId ? [step.equipment.applianceId] : [];
    case "step.time.durationSeconds":
      return typeof step.time?.durationSeconds === "number"
        ? [step.time.durationSeconds]
        : [];
    case "step.cookingPhase":
      return step.cookingPhase ? [step.cookingPhase] : [];
    case "step.prepType":
      return step.prepType ? [step.prepType] : [];
    case "step.storageLocation.type":
      return step.storageLocation?.type ? [step.storageLocation.type] : [];
    case "step.container.type":
      return step.container?.type ? [step.container.type] : [];
    case "step.stationId":
      return step.stationId ? [step.stationId] : [];
    case "step.target.bomUsageId":
      return step.target?.bomUsageId ? [step.target.bomUsageId] : [];
    case "step.target.bomComponentId":
      return step.target?.bomComponentId ? [step.target.bomComponentId] : [];

    // build.*
    case "build.itemId":
      return [build.itemId];
    case "build.status":
      return [build.status];
    case "build.requiresBuilds.itemId":
      return (build.requiresBuilds ?? []).map((r) => r.itemId);
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function equalsPrimitive(a: QueryPrimitive, b: QueryPrimitive): boolean {
  return a === b;
}

export function matchesWhere(
  clauses: QueryClause[],
  build: BenchTopLineBuild,
  step: Step,
): boolean {
  for (const clause of clauses) {
    const vals = getFieldValues(clause.field, build, step);

    switch (clause.kind) {
      case "exists": {
        if (vals.length === 0) return false;
        break;
      }
      case "eq": {
        if (!vals.some((v) => equalsPrimitive(v, clause.value))) return false;
        break;
      }
      case "ne": {
        if (vals.some((v) => equalsPrimitive(v, clause.value))) return false;
        break;
      }
      case "in": {
        if (
          !vals.some((v) => clause.values.some((x) => equalsPrimitive(v, x)))
        ) {
          return false;
        }
        break;
      }
      default: {
        const _exhaustive: never = clause;
        return _exhaustive;
      }
    }
  }
  return true;
}

export function buildMatchLabel(step: Step): string {
  const instruction = (step.instruction ?? "").trim();
  if (instruction.length > 0) {
    return instruction.length <= 96 ? instruction : `${instruction.slice(0, 93)}...`;
  }

  const parts: string[] = [];
  parts.push(step.action.family);
  if (step.action.techniqueId) parts.push(`tech=${step.action.techniqueId}`);
  if (step.target?.name) parts.push(`target=${step.target.name}`);
  if (step.equipment?.applianceId) parts.push(`eq=${step.equipment.applianceId}`);
  if (typeof step.time?.durationSeconds === "number") {
    parts.push(`t=${step.time.durationSeconds}s`);
  }
  return parts.join(" ");
}

export function runQuery(input: {
  builds: BenchTopLineBuild[];
  where: string;
}): { clauses: QueryClause[]; matches: QueryMatch[] } {
  const clauses = parseWhere(input.where);

  const matches: QueryMatch[] = [];
  for (const build of input.builds) {
    for (const step of build.steps) {
      if (!matchesWhere(clauses, build, step)) continue;
      matches.push({
        buildId: build.id,
        itemId: build.itemId,
        version: build.version,
        status: build.status,
        stepId: step.id,
        orderIndex: step.orderIndex,
        label: buildMatchLabel(step),
      });
    }
  }

  // Deterministic ordering.
  matches.sort((a, b) => {
    if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
    if (a.version !== b.version) return a.version - b.version;
    if (a.buildId !== b.buildId) return a.buildId.localeCompare(b.buildId);
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.stepId.localeCompare(b.stepId);
  });

  return { clauses, matches };
}

