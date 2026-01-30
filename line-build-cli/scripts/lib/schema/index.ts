/**
 * Canonical PoC schema types + runtime validation.
 *
 * Source of truth for field presence: docs/handoff/POC_TASKS.json -> shared_conventions.schema_contract
 *
 * Notes:
 * - This PoC contract intentionally omits legacy WorkUnit types.
 * - Per schema_contract note: StepKind is NOT part of the PoC contract.
 */

// Re-export all types and schemas from sub-modules
export * from "./enums";
export * from "./assembly";
export * from "./step";
export * from "./build";
export * from "./derived";

// Import for station mapping functionality
import { getStationSide as _getStationSide, STATION_BY_ID } from "../../../config/stations.config";
import { type StationId, type GroupingId } from "./enums";
import { BenchTopLineBuildSchema, type BenchTopLineBuild } from "./build";

// -----------------------------
// Station to Grouping Mapping
// -----------------------------

/**
 * @deprecated Use getStationSide from config/stations.config.ts instead.
 * This mapping is kept for backwards compatibility but is derived from the config.
 */
export const STATION_TO_GROUPING: Record<StationId, GroupingId> = Object.fromEntries(
  Object.entries(STATION_BY_ID).map(([id, config]) => [id, config.side])
) as Record<StationId, GroupingId>;

/**
 * Get the grouping (hot_side, cold_side, vending) for a station.
 * @deprecated Use getStationSide from config/stations.config.ts instead.
 */
export function getGroupingForStation(stationId: StationId | string | undefined): GroupingId {
  if (!stationId) return "cold_side";
  return STATION_TO_GROUPING[stationId as StationId] ?? "cold_side";
}

// -----------------------------
// parseBuild()
// -----------------------------

export type BuildParseIssue = {
  path: string;
  message: string;
  code: string;
};

export class BuildParseError extends Error {
  public readonly issues: BuildParseIssue[];

  constructor(issues: BuildParseIssue[]) {
    super("Build JSON failed schema validation");
    this.name = "BuildParseError";
    this.issues = issues;
  }
}

function formatZodPath(path: Array<string | number | symbol>): string {
  // Converts Zod paths like ["steps", 0, "action", "family"] into "steps[0].action.family"
  return path
    .map((p) => (typeof p === "number" ? `[${p}]` : String(p)))
    .reduce((acc, part) => {
      if (part.startsWith("[")) return `${acc}${part}`;
      if (acc === "") return part;
      return `${acc}.${part}`;
    }, "");
}

export function parseBuild(json: unknown): BenchTopLineBuild {
  const result = BenchTopLineBuildSchema.safeParse(json);
  if (result.success) return result.data;

  const issues: BuildParseIssue[] = result.error.issues.map((i) => ({
    path: formatZodPath(i.path),
    message: i.message,
    code: i.code,
  }));

  throw new BuildParseError(issues);
}
