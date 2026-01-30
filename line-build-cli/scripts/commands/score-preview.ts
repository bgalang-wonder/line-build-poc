/**
 * `lb score-preview` - Preview weight impact on portfolio scores.
 *
 * Options:
 *   --weights <json>  JSON object with weight overrides (e.g., '{"location":{"hot_side":3.0}}')
 *   --file <path>     Load preview config from JSON file
 *   --top <n>         Show only top N impacted builds (default: 10)
 *   --summary         Show only summary (no per-build details)
 *
 * Examples:
 *   lb score-preview --weights '{"location":{"hot_side":4.0}}'
 *   lb score-preview --file my-config.json
 *   lb score-preview --weights '{"signals":{"groupingBounces":10.0}}' --top 5
 */

import * as fs from "node:fs/promises";
import type { GlobalFlags } from "../lb";
import { writeJson, writeHuman } from "../lb";
import { readBuild, listBuilds } from "../lib/store";
import {
  computeWeightImpactPreview,
  loadComplexityConfig,
  formatWeightImpactPreview,
  formatPreviewSummary,
} from "../lib/complexity";
import type { ComplexityConfig } from "../../config/complexity.config";

/**
 * Deep merge two objects.
 */
function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];

    if (
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

/**
 * Parse command flags.
 */
function parseFlags(args: string[]): {
  weightsJson: string | null;
  filePath: string | null;
  top: number;
  summary: boolean;
} {
  let weightsJson: string | null = null;
  let filePath: string | null = null;
  let top = 10;
  let summary = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if ((arg === "--weights" || arg === "-w") && args[i + 1]) {
      weightsJson = args[i + 1]!;
      i++;
    } else if ((arg === "--file" || arg === "-f") && args[i + 1]) {
      filePath = args[i + 1]!;
      i++;
    } else if (arg === "--top" && args[i + 1]) {
      top = parseInt(args[i + 1]!, 10);
      i++;
    } else if (arg === "--summary" || arg === "-s") {
      summary = true;
    }
  }

  return { weightsJson, filePath, top, summary };
}

/**
 * Build preview config from overrides.
 */
async function buildPreviewConfig(
  opts: { weightsJson: string | null; filePath: string | null }
): Promise<ComplexityConfig | null> {
  const baseline = loadComplexityConfig();

  // Load from file if specified
  if (opts.filePath) {
    try {
      const raw = await fs.readFile(opts.filePath, "utf8");
      const fileConfig = JSON.parse(raw) as Partial<ComplexityConfig>;
      return deepMerge(baseline, fileConfig as Record<string, unknown>);
    } catch (err) {
      throw new Error(`Failed to load config file: ${(err as Error).message}`);
    }
  }

  // Parse weights JSON if specified
  if (opts.weightsJson) {
    try {
      const overrides = JSON.parse(opts.weightsJson) as Record<string, unknown>;
      return deepMerge(baseline, overrides);
    } catch {
      throw new Error("Invalid JSON in --weights argument");
    }
  }

  return null;
}

export async function cmdScorePreview(
  flags: GlobalFlags,
  args: string[]
): Promise<number> {
  const opts = parseFlags(args);

  if (!opts.weightsJson && !opts.filePath) {
    if (flags.json) {
      writeJson({
        ok: false,
        error: { message: "Usage: lb score-preview --weights <json> | --file <path>" },
      });
    } else {
      writeHuman([
        "Usage: lb score-preview [options]",
        "",
        "Compute weight impact preview without saving config changes.",
        "",
        "Options:",
        "  --weights <json>  JSON object with weight overrides",
        "  --file <path>     Load preview config from JSON file",
        "  --top <n>         Show only top N impacted builds (default: 10)",
        "  --summary         Show only summary (no per-build details)",
        "",
        "Examples:",
        '  lb score-preview --weights \'{"location":{"hot_side":4.0}}\'',
        '  lb score-preview --weights \'{"signals":{"groupingBounces":10.0}}\' --top 5',
        "  lb score-preview --file my-proposed-config.json",
        '  lb score-preview --weights \'{"categoryMultipliers":{"taskCount":1.0}}\' --json',
        "",
        "The preview shows:",
        "  - Rating migrations (builds moving between low/medium/high/very_high)",
        "  - Portfolio stats changes (mean, p50, p95, stdDev)",
        "  - Per-build score deltas and rank shifts",
      ]);
    }
    return 1;
  }

  // Build preview config
  let previewConfig: ComplexityConfig;
  try {
    const config = await buildPreviewConfig(opts);
    if (!config) {
      throw new Error("No preview config specified");
    }
    previewConfig = config;
  } catch (err) {
    if (flags.json) {
      writeJson({ ok: false, error: { message: (err as Error).message } });
    } else {
      writeHuman([`Error: ${(err as Error).message}`]);
    }
    return 1;
  }

  // Load all builds
  const buildSummaries = await listBuilds();
  const builds = [];

  for (const summary of buildSummaries) {
    try {
      const build = await readBuild(summary.buildId);
      builds.push(build);
    } catch {
      // Skip builds that fail to load
    }
  }

  if (builds.length === 0) {
    if (flags.json) {
      writeJson({ ok: false, error: { message: "No builds found" } });
    } else {
      writeHuman(["No builds found"]);
    }
    return 1;
  }

  // Compute preview
  const preview = computeWeightImpactPreview(builds, previewConfig);

  // Apply top filter to build impacts
  if (opts.top && opts.top > 0 && preview.buildImpacts.length > opts.top) {
    preview.buildImpacts = preview.buildImpacts.slice(0, opts.top);
  }

  // Output
  if (flags.json) {
    writeJson({
      ok: true,
      preview,
    });
  } else if (opts.summary) {
    writeHuman([
      "Weight Impact Preview",
      "",
      formatPreviewSummary(preview),
      "",
      `Rating changes: ${preview.ratingChangedCount}`,
      preview.migrations.length > 0
        ? `Migrations: ${preview.migrations.map((m) => `${m.from.toUpperCase()}→${m.to.toUpperCase()}: ${m.count}`).join(", ")}`
        : "Migrations: None",
    ]);
  } else {
    writeHuman(formatWeightImpactPreview(preview));
  }

  return 0;
}
