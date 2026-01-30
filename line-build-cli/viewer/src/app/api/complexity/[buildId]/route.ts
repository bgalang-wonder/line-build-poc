import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { resolveBuildsDir } from "@/lib/dataPaths";

// Import from the CLI's complexity module (relative to viewer)
import { 
  scoreBuild, 
  computePercentileRating,
  computePortfolioStats,
  normalizeScore
} from "../../../../../../scripts/lib/complexity";

export const dynamic = "force-dynamic";

const BUILDS_DIR = resolveBuildsDir();

export async function GET(
  _request: Request,
  { params }: { params: { buildId: string } }
) {
  const { buildId } = params;

  try {
    // Load all builds to compute percentile-based rating
    const entries = await fs.readdir(BUILDS_DIR);
    const buildFiles = entries.filter((name) => name.endsWith(".json"));

    // Score all builds to get the portfolio distribution
    const allReports: any[] = [];
    let targetReport = null;

    for (const fileName of buildFiles) {
      try {
        const raw = await fs.readFile(path.join(BUILDS_DIR, fileName), "utf8");
        const build = JSON.parse(raw);
        const report = scoreBuild(build);
        allReports.push(report);

        // Check if this is our target build
        const thisBuildId = build.id ?? fileName.replace(".json", "");
        if (thisBuildId === buildId) {
          targetReport = report;
        }
      } catch {
        // Skip builds that fail to parse or score
      }
    }

    if (!targetReport) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    // Compute portfolio statistics (for normalization)
    const portfolioStats = computePortfolioStats(allReports);

    // Compute normalized score (0-100 scale based on p95)
    const normalizedScore = normalizeScore(targetReport.rawScore, portfolioStats);

    // Compute percentile-based rating
    const allScores = allReports.map(r => r.rawScore);
    const percentileRating = computePercentileRating(targetReport.rawScore, allScores);

    return NextResponse.json({
      ...targetReport,
      normalizedScore,
      rating: percentileRating,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }
    console.error("Error scoring build:", err);
    return NextResponse.json({ error: "Failed to score build" }, { status: 500 });
  }
}
