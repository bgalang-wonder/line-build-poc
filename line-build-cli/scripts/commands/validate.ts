import { readBuild, readBom, listBuilds, BUILDS_DIR_ABS } from "../lib/store";
import { validateBuild, type BuildValidationResult } from "../lib/validate";
import { buildGapsFromValidation } from "../lib/query";
import { writeValidationOutput } from "../lib/validationOutput";
import { parseBuild, type BenchTopLineBuild } from "../lib/schema";
import type { GlobalFlags } from "../lb";
import { getFixHint } from "../lib/fixHints";
import { generateSuggestions, type Suggestion } from "../lib/suggestOps";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const EXIT_SUCCESS = 0;
const EXIT_VALIDATION_FAILED = 2;
const EXIT_USAGE_ERROR = 3;

function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
function writeError(flags: GlobalFlags, message: string) {
  if (flags.json) writeJson({ ok: false, error: { message } });
  else process.stderr.write(message + "\n");
}

function hasFlag(argv: string[], name: string): { present: boolean; rest: string[] } {
  const rest = argv.filter((a) => a !== name);
  return { present: rest.length !== argv.length, rest };
}

function takeOption(argv: string[], name: string): { value: string | undefined; rest: string[] } {
  const out: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === name) { value = argv[i + 1]; i += 1; continue; }
    if (a.startsWith(`${name}=`)) { value = a.slice(name.length + 1); continue; }
    out.push(a);
  }
  return { value, rest: out };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

type SingleBuildResult = {
  buildId: string;
  itemId: string;
  name?: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  validation: BuildValidationResult;
  suggestions?: Suggestion[];
};

async function validateSingleBuild(
  buildId: string,
  includeOps: boolean
): Promise<SingleBuildResult> {
  const build = await readBuild(buildId);
  const bom = await readBom(build.itemId);
  const validation = validateBuild(build, { bom });
  await writeValidationOutput(build, validation);

  const result: SingleBuildResult = {
    buildId: build.id,
    itemId: build.itemId,
    name: build.name,
    valid: validation.valid,
    errorCount: validation.hardErrors.length,
    warningCount: validation.warnings.length,
    infoCount: validation.infos.length,
    validation,
  };

  if (includeOps) {
    result.suggestions = generateSuggestions(validation.hardErrors, build);
  }

  return result;
}

async function getBuildsToValidate(
  argv: { all: boolean; changedMinutes?: number; itemId?: string; buildId?: string }
): Promise<string[]> {
  if (argv.buildId) {
    return [argv.buildId];
  }

  const summaries = await listBuilds();
  let filtered = summaries;

  if (argv.itemId) {
    filtered = filtered.filter((b) => b.itemId === argv.itemId);
  }

  if (argv.changedMinutes !== undefined) {
    const cutoff = Date.now() - argv.changedMinutes * 60 * 1000;
    const buildIds: string[] = [];
    for (const summary of filtered) {
      try {
        const filePath = path.join(BUILDS_DIR_ABS, `${summary.buildId}.json`);
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs >= cutoff) {
          buildIds.push(summary.buildId);
        }
      } catch {
        // File may have been deleted
      }
    }
    return buildIds;
  }

  if (argv.all) {
    return filtered.map((b) => b.buildId);
  }

  return [];
}

export async function cmdValidate(flags: GlobalFlags, argv: string[]): Promise<number> {
  const stdinFlag = hasFlag(argv, "--stdin");
  const gapsFlag = hasFlag(stdinFlag.rest, "--gaps");
  const allFlag = hasFlag(gapsFlag.rest, "--all");
  const summaryFlag = hasFlag(allFlag.rest, "--summary");
  const opsFlag = hasFlag(summaryFlag.rest, "--ops");
  const changedOpt = takeOption(opsFlag.rest, "--changed");
  const itemOpt = takeOption(changedOpt.rest, "--item");
  const buildId = itemOpt.rest[0];

  const changedMinutes = changedOpt.value ? parseInt(changedOpt.value, 10) : undefined;

  if (stdinFlag.present) {
    const build = parseBuild(JSON.parse(await readStdin()));
    const bom = await readBom(build.itemId);
    const validation = validateBuild(build, { bom });
    await writeValidationOutput(build, validation);

    if (gapsFlag.present) {
      const gaps = buildGapsFromValidation(build, validation);
      if (flags.json) writeJson({ ok: true, gaps });
      else writeHuman(gaps.map(g => `[${g.ruleId}] ${g.message}`));
    } else {
      outputSingleValidation(flags, build, validation, opsFlag.present);
    }
    return validation.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
  }

  const isBatchMode = allFlag.present || changedMinutes !== undefined;

  if (!isBatchMode && !buildId) {
    writeError(flags, "usage: validate <buildId> [--stdin] [--gaps] [--ops] [--all] [--changed <minutes>] [--summary] [--item <itemId>]");
    return EXIT_USAGE_ERROR;
  }

  if (isBatchMode) {
    return await runBatchValidation(flags, {
      all: allFlag.present,
      changedMinutes,
      itemId: itemOpt.value,
      summary: summaryFlag.present,
      includeOps: opsFlag.present,
    });
  }

  const result = await validateSingleBuild(buildId!, opsFlag.present);

  if (gapsFlag.present) {
    const build = await readBuild(buildId!);
    const gaps = buildGapsFromValidation(build, result.validation);
    if (flags.json) writeJson({ ok: true, gaps });
    else writeHuman(gaps.map(g => `[${g.ruleId}] ${g.message}`));
  } else {
    const build = await readBuild(buildId!);
    outputSingleValidation(flags, build, result.validation, opsFlag.present, result.suggestions);
  }

  return result.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
}

function outputSingleValidation(
  flags: GlobalFlags,
  build: BenchTopLineBuild,
  validation: BuildValidationResult,
  includeOps: boolean,
  suggestions?: Suggestion[]
) {
  if (flags.json) {
    const enrichedValidation = {
      ...validation,
      hardErrors: validation.hardErrors.map(err => ({
        ...err,
        fixHint: getFixHint(err.ruleId),
      })),
    };
    const output: Record<string, unknown> = { ok: true, validation: enrichedValidation };
    if (includeOps && suggestions) {
      output.suggestions = suggestions;
    }
    writeJson(output);
  } else {
    const lines = [
      `Valid: ${validation.valid}`,
      `Errors: ${validation.hardErrors.length}`,
      `Warnings: ${validation.warnings.length}`,
      `Infos: ${validation.infos.length}`,
    ];
    if (validation.hardErrors.length > 0) {
      lines.push("");
      lines.push("Errors:");
      for (const err of validation.hardErrors) {
        const hint = getFixHint(err.ruleId);
        const stepRef = err.stepId ? ` (${err.stepId})` : "";
        lines.push(`  [${err.ruleId}]${stepRef} ${err.message}`);
        if (hint) {
          lines.push(`    -> Fix: ${hint}`);
        }
      }
    }
    if (includeOps && suggestions) {
      const autoFixable = suggestions.filter(s => s.candidateOp);
      if (autoFixable.length > 0) {
        lines.push("");
        lines.push("Auto-fixable with --ops:");
        for (const s of autoFixable) {
          lines.push(`  [${s.ruleId}] ${s.stepId ?? "build"}: ${JSON.stringify(s.candidateOp)}`);
        }
      }
    }
    writeHuman(lines);
  }
}

async function runBatchValidation(
  flags: GlobalFlags,
  opts: {
    all: boolean;
    changedMinutes?: number;
    itemId?: string;
    summary: boolean;
    includeOps: boolean;
  }
): Promise<number> {
  const buildIds = await getBuildsToValidate({
    all: opts.all,
    changedMinutes: opts.changedMinutes,
    itemId: opts.itemId,
  });

  if (buildIds.length === 0) {
    if (flags.json) writeJson({ ok: true, totalBuilds: 0, validCount: 0, invalidCount: 0, results: [] });
    else writeHuman(["No builds to validate."]);
    return EXIT_SUCCESS;
  }

  const results: SingleBuildResult[] = [];
  for (const id of buildIds) {
    try {
      results.push(await validateSingleBuild(id, opts.includeOps));
    } catch (err) {
      results.push({
        buildId: id,
        itemId: "unknown",
        valid: false,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        validation: {
          valid: false,
          hardErrors: [{ ruleId: "LOAD_ERROR", message: (err as Error).message, severity: "hard" }],
          warnings: [],
          infos: [],
        },
      });
    }
  }

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.length - validCount;

  if (opts.summary) {
    outputSummary(flags, results, validCount, invalidCount);
  } else {
    outputBatchResults(flags, results, validCount, invalidCount, opts.includeOps);
  }

  return invalidCount > 0 ? EXIT_VALIDATION_FAILED : EXIT_SUCCESS;
}

function outputSummary(
  flags: GlobalFlags,
  results: SingleBuildResult[],
  validCount: number,
  invalidCount: number
) {
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const ruleCounts = new Map<string, number>();
  for (const r of results) {
    for (const err of r.validation.hardErrors) {
      ruleCounts.set(err.ruleId, (ruleCounts.get(err.ruleId) ?? 0) + 1);
    }
  }
  const topRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ruleId, count]) => ({ ruleId, count }));

  const worstBuilds = results
    .filter(r => !r.valid)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5)
    .map(r => ({ buildId: r.buildId, name: r.name, errorCount: r.errorCount }));

  if (flags.json) {
    writeJson({
      ok: true,
      buildCount: results.length,
      validCount,
      invalidCount,
      totalErrors,
      topRules,
      worstBuilds,
      scannedAt: new Date().toISOString(),
    });
  } else {
    const pct = results.length > 0 ? Math.round((invalidCount / results.length) * 100) : 0;
    const lines = [
      `Builds: ${results.length} total, ${invalidCount} invalid (${pct}%)`,
    ];
    if (topRules.length > 0) {
      lines.push("");
      lines.push("Top failing rules:");
      for (const { ruleId, count } of topRules) {
        lines.push(`  ${ruleId}: ${count} occurrence(s)`);
      }
    }
    if (worstBuilds.length > 0) {
      lines.push("");
      lines.push("Worst builds:");
      for (const { buildId, name, errorCount } of worstBuilds) {
        lines.push(`  ${name || buildId}: ${errorCount} error(s)`);
      }
    }
    writeHuman(lines);
  }
}

function outputBatchResults(
  flags: GlobalFlags,
  results: SingleBuildResult[],
  validCount: number,
  invalidCount: number,
  _includeOps: boolean
) {
  if (flags.json) {
    writeJson({
      ok: true,
      totalBuilds: results.length,
      validCount,
      invalidCount,
      results: results.map(r => ({
        buildId: r.buildId,
        itemId: r.itemId,
        name: r.name,
        valid: r.valid,
        errorCount: r.errorCount,
        warningCount: r.warningCount,
        infoCount: r.infoCount,
        topErrors: r.validation.hardErrors.slice(0, 3).map(e => ({
          ruleId: e.ruleId,
          message: e.message,
          fixHint: getFixHint(e.ruleId),
        })),
        suggestions: r.suggestions,
      })),
    });
  } else {
    const lines = [`Validated ${results.length} builds: ${validCount} valid, ${invalidCount} invalid`];
    const invalid = results.filter(r => !r.valid);
    if (invalid.length > 0) {
      lines.push("");
      lines.push("Invalid builds:");
      for (const r of invalid) {
        const ruleIds = [...new Set(r.validation.hardErrors.map(e => e.ruleId))].join(", ");
        lines.push(`  ${r.name || r.buildId}: ${r.errorCount} error(s) (${ruleIds})`);
      }
    }
    writeHuman(lines);
  }
}
