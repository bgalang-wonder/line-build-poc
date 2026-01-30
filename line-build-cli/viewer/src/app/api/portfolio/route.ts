import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveBuildsDir, resolveValidationDir, resolveDerivedDir } from "@/lib/dataPaths";
import type { BenchTopLineBuild } from "@/types";

// Import complexity scoring from CLI
import { scoreBuild, computePercentileRating } from "../../../../../scripts/lib/complexity";

export const dynamic = "force-dynamic";

type BuildStatus = "draft" | "published" | "archived";
type ValidationStatus = "valid" | "blocked" | "warning";

type PortfolioBuild = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: BuildStatus;
  validationStatus: ValidationStatus;
  complexity: number | null;
  rating: "low" | "medium" | "high" | "very_high" | null;
  stepCount: number;
  hardErrorCount: number;
  warningCount: number;
  transferCount: number;
  updatedAt: string;
};

type PortfolioSummary = {
  totalBuilds: number;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  avgComplexity: number | null;
};

type PortfolioResponse = {
  summary: PortfolioSummary;
  builds: PortfolioBuild[];
};

async function tryReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse<PortfolioResponse | { error: string }>> {
  try {
    const buildsDir = resolveBuildsDir();
    const validationDir = resolveValidationDir();
    const derivedDir = resolveDerivedDir();

    // Read all build files
    let fileNames: string[];
    try {
      const entries = await fs.readdir(buildsDir);
      fileNames = entries.filter((name) => name.endsWith(".json"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({
          summary: { totalBuilds: 0, blockedCount: 0, warningCount: 0, readyCount: 0, avgComplexity: null },
          builds: [],
        });
      }
      throw err;
    }

    // Process each build
    const builds: PortfolioBuild[] = await Promise.all(
      fileNames.map(async (fileName): Promise<PortfolioBuild> => {
        const buildPath = path.join(buildsDir, fileName);
        const buildJson = await tryReadJson<BenchTopLineBuild>(buildPath);

        if (!buildJson) {
          return {
            buildId: fileName.replace(".json", ""),
            itemId: "unknown",
            version: 0,
            status: "draft",
            validationStatus: "blocked",
            complexity: null,
            rating: null,
            stepCount: 0,
            hardErrorCount: 1,
            warningCount: 0,
            transferCount: 0,
            updatedAt: new Date().toISOString(),
          };
        }

        const buildId = (buildJson.id as string) ?? fileName.replace(".json", "");
        const steps = (buildJson.steps as unknown[]) ?? [];

        // Try to read validation
        const validationPath = path.join(validationDir, `${buildId}.json`);
        const validation = await tryReadJson<{
          valid?: boolean;
          hardErrors?: unknown[];
          warnings?: unknown[];
        }>(validationPath);

        const hardErrorCount = validation?.hardErrors?.length ?? 0;
        const warningCount = validation?.warnings?.length ?? 0;

        let validationStatus: ValidationStatus = "valid";
        if (hardErrorCount > 0) {
          validationStatus = "blocked";
        } else if (warningCount > 0) {
          validationStatus = "warning";
        }

        // Compute complexity score on-demand (rating assigned later via percentiles)
        let complexityScore: number | null = null;
        try {
          const report = scoreBuild(buildJson as any);
          complexityScore = report.rawScore;
        } catch {
          // Complexity scoring failed, leave as null
        }

        // Read derived transfers count (exclude self-referential)
        let transferCount = 0;
        try {
          const derivedPath = path.join(derivedDir, `${buildId}.derived.json`);
          const derived = await tryReadJson<{
            transfers?: Array<{ producerStepId: string; consumerStepId: string }>;
          }>(derivedPath);
          if (derived?.transfers) {
            // Only count non-self-referential transfers
            transferCount = derived.transfers.filter(
              (t) => t.producerStepId !== t.consumerStepId
            ).length;
          }
        } catch {
          // Derived data not available
        }

        return {
          buildId,
          itemId: buildJson.itemId as string,
          name: buildJson.name as string | undefined,
          version: (buildJson.version as number) ?? 1,
          status: (buildJson.status as BuildStatus) ?? "draft",
          validationStatus,
          complexity: complexityScore,
          rating: null, // Will be set via percentile computation
          stepCount: steps.length,
          hardErrorCount,
          warningCount,
          transferCount,
          updatedAt: (buildJson.updatedAt as string) ?? new Date().toISOString(),
        };
      })
    );

    // Compute percentile-based ratings using all scores
    const allScores = builds
      .map((b) => b.complexity)
      .filter((c): c is number => c !== null);

    // Apply percentile ratings to each build
    for (const build of builds) {
      if (build.complexity !== null) {
        build.rating = computePercentileRating(build.complexity, allScores);
      }
    }

    // Sort by itemId then version
    builds.sort((a, b) => a.itemId.localeCompare(b.itemId) || a.version - b.version);

    // Compute summary
    const blockedCount = builds.filter((b) => b.validationStatus === "blocked").length;
    const warningCount = builds.filter((b) => b.validationStatus === "warning").length;
    const readyCount = builds.filter((b) => b.validationStatus === "valid").length;

    const avgComplexity =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : null;

    const summary: PortfolioSummary = {
      totalBuilds: builds.length,
      blockedCount,
      warningCount,
      readyCount,
      avgComplexity,
    };

    return NextResponse.json({ summary, builds });
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}
