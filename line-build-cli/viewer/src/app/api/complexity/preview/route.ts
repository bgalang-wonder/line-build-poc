import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveBuildsDir } from "@/lib/dataPaths";

// Import from the CLI's complexity module (relative to viewer)
import {
  computeWeightImpactPreview,
  loadComplexityConfig,
} from "../../../../../../scripts/lib/complexity";
import type { ComplexityConfig } from "../../../../../../config/complexity.config";
import type { BenchTopLineBuild } from "../../../../../../scripts/lib/schema";

export const dynamic = "force-dynamic";

const BUILDS_DIR = resolveBuildsDir();

/**
 * Load all builds from the builds directory.
 */
async function loadAllBuilds(): Promise<BenchTopLineBuild[]> {
  const entries = await fs.readdir(BUILDS_DIR);
  const buildFiles = entries.filter((name) => name.endsWith(".json"));

  const builds: BenchTopLineBuild[] = [];
  for (const fileName of buildFiles) {
    try {
      const raw = await fs.readFile(path.join(BUILDS_DIR, fileName), "utf8");
      const build = JSON.parse(raw) as BenchTopLineBuild;
      builds.push(build);
    } catch {
      // Skip builds that fail to parse
    }
  }

  return builds;
}

/**
 * POST /api/complexity/preview
 * Compute weight impact preview for proposed config changes.
 *
 * Body: { previewConfig: ComplexityConfig }
 * Returns: WeightImpactPreview
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.previewConfig) {
      return NextResponse.json(
        { error: "Missing previewConfig in request body" },
        { status: 400 }
      );
    }

    const previewConfig: ComplexityConfig = body.previewConfig;
    const baselineConfig = loadComplexityConfig();

    // Load all builds
    const builds = await loadAllBuilds();

    if (builds.length === 0) {
      return NextResponse.json(
        { error: "No builds found in portfolio" },
        { status: 404 }
      );
    }

    // Compute preview
    const preview = computeWeightImpactPreview(builds, previewConfig, baselineConfig);

    return NextResponse.json({
      ok: true,
      preview,
    });
  } catch (err) {
    console.error("Error computing complexity preview:", err);
    return NextResponse.json(
      { error: `Failed to compute preview: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
