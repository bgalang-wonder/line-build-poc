/**
 * `lb score-portfolio` - Score all builds and show ranking.
 *
 * Options:
 *   --receipt    Save portfolio receipt to data/receipts/
 *   --top <n>    Show only top N builds (default: all)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { GlobalFlags } from "../lb";
import { writeJson, writeHuman } from "../lb";
import { readBuild, listBuilds } from "../lib/store";
import {
  scorePortfolio,
  formatPortfolioRanking,
  formatPortfolioStats,
  type PortfolioReceipt,
} from "../lib/complexity";

const RECEIPTS_DIR = path.resolve(__dirname, "../../data/receipts");

/**
 * Parse command flags.
 */
function parseFlags(args: string[]): {
  receipt: boolean;
  top: number | null;
  itemId: string | null;
} {
  let receipt = false;
  let top: number | null = null;
  let itemId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--receipt") {
      receipt = true;
    } else if (arg === "--top" && args[i + 1]) {
      top = parseInt(args[i + 1]!, 10);
      i++;
    } else if (arg === "--item" && args[i + 1]) {
      itemId = args[i + 1]!;
      i++;
    }
  }

  return { receipt, top, itemId };
}

/**
 * Save portfolio receipt to file.
 */
async function saveReceipt(receipt: PortfolioReceipt): Promise<string> {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });

  const timestamp = receipt.timestamp.replace(/[:.]/g, "-");
  const filename = `portfolio_${timestamp}.json`;
  const filepath = path.join(RECEIPTS_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  return filepath;
}

export async function cmdScorePortfolio(
  flags: GlobalFlags,
  args: string[]
): Promise<number> {
  const opts = parseFlags(args);

  // Load all builds
  const buildSummaries = await listBuilds();
  const builds = [];

  for (const summary of buildSummaries) {
    try {
      const build = await readBuild(summary.buildId);
      // Filter by itemId if specified
      if (opts.itemId && build.itemId !== opts.itemId) continue;
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

  // Score the portfolio
  const result = scorePortfolio(builds);

  // Apply top filter
  if (opts.top && opts.top > 0) {
    result.ranking = result.ranking.slice(0, opts.top);
  }

  // Save receipt if requested
  let receiptPath: string | null = null;
  if (opts.receipt) {
    const receipt: PortfolioReceipt = {
      type: "portfolio",
      result,
      timestamp: new Date().toISOString(),
    };
    receiptPath = await saveReceipt(receipt);
  }

  // Output
  if (flags.json) {
    writeJson({
      ok: true,
      stats: result.stats,
      ranking: result.ranking,
      receiptPath,
    });
  } else {
    const lines = formatPortfolioRanking(result);
    if (receiptPath) {
      lines.push("");
      lines.push(`Receipt saved: ${receiptPath}`);
    }
    writeHuman(lines);
  }

  return 0;
}
