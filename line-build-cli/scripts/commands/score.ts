/**
 * `lb score <buildId>` - Score a single build's complexity.
 *
 * Options:
 *   --receipt    Save score receipt to data/receipts/
 *   --ledger     Show step-by-step effort breakdown
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { GlobalFlags } from "../lb";
import { writeJson, writeHuman } from "../lb";
import { readBuild, listBuilds } from "../lib/store";
import {
  scoreBuild,
  scoreBuildNormalized,
  formatScoreReport,
  formatStepLedger,
  type ScoreReceipt,
} from "../lib/complexity";

const RECEIPTS_DIR = path.resolve(__dirname, "../../data/receipts");

/**
 * Parse command flags.
 */
function parseFlags(args: string[]): {
  buildId: string | null;
  receipt: boolean;
  ledger: boolean;
  normalized: boolean;
} {
  let buildId: string | null = null;
  let receipt = false;
  let ledger = false;
  let normalized = false;

  for (const arg of args) {
    if (arg === "--receipt") {
      receipt = true;
    } else if (arg === "--ledger") {
      ledger = true;
    } else if (arg === "--normalized" || arg === "-n") {
      normalized = true;
    } else if (!arg.startsWith("-")) {
      buildId = arg;
    }
  }

  return { buildId, receipt, ledger, normalized };
}

/**
 * Save score receipt to file.
 */
async function saveReceipt(receipt: ScoreReceipt): Promise<string> {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });

  const timestamp = receipt.timestamp.replace(/[:.]/g, "-");
  const filename = `${receipt.buildId}_${timestamp}.score.json`;
  const filepath = path.join(RECEIPTS_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  return filepath;
}

export async function cmdScore(
  flags: GlobalFlags,
  args: string[]
): Promise<number> {
  const opts = parseFlags(args);

  if (!opts.buildId) {
    if (flags.json) {
      writeJson({ ok: false, error: { message: "Usage: lb score <buildId> [--receipt] [--ledger] [--normalized]" } });
    } else {
      writeHuman([
        "Usage: lb score <buildId> [options]",
        "",
        "Options:",
        "  --receipt      Save score receipt to data/receipts/",
        "  --ledger       Show step-by-step effort breakdown",
        "  --normalized   Include portfolio normalization (scores all builds)",
        "",
        "Examples:",
        "  lb score my-build-id",
        "  lb score my-build-id --receipt",
        "  lb score my-build-id --ledger --normalized",
      ]);
    }
    return 1;
  }

  // Load the target build
  let build;
  try {
    build = await readBuild(opts.buildId);
  } catch (err) {
    if (flags.json) {
      writeJson({ ok: false, error: { message: `Build not found: ${opts.buildId}` } });
    } else {
      writeHuman([`Error: Build not found: ${opts.buildId}`]);
    }
    return 1;
  }

  // Score the build
  let report;
  if (opts.normalized) {
    // Load all builds for normalization
    const allBuildSummaries = await listBuilds();
    const allBuilds = [];
    for (const summary of allBuildSummaries) {
      try {
        const b = await readBuild(summary.buildId);
        allBuilds.push(b);
      } catch {
        // Skip builds that fail to load
      }
    }
    report = scoreBuildNormalized(build, allBuilds);
  } else {
    report = scoreBuild(build);
  }

  // Save receipt if requested
  let receiptPath: string | null = null;
  if (opts.receipt) {
    const receipt: ScoreReceipt = {
      type: "single",
      buildId: opts.buildId,
      report,
      timestamp: new Date().toISOString(),
    };
    receiptPath = await saveReceipt(receipt);
  }

  // Output
  if (flags.json) {
    writeJson({
      ok: true,
      report,
      receiptPath,
    });
  } else {
    const lines = formatScoreReport(report);
    if (opts.ledger) {
      lines.push("");
      lines.push(...formatStepLedger(report.stepEfforts));
    }
    if (receiptPath) {
      lines.push("");
      lines.push(`Receipt saved: ${receiptPath}`);
    }
    writeHuman(lines);
  }

  return 0;
}
