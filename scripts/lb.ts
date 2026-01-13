/**
 * Line Build PoC CLI
 *
 * Source of truth:
 * - docs/handoff/POC_TASKS.json (tasks + schema_contract + dsl_contract + exit codes)
 *
 * Run:
 * - From repo root: npx tsx poc/line-build-cli/scripts/lb.ts --help
 * - From poc dir:   cd poc/line-build-cli && npx tsx scripts/lb.ts --help
 */

import { readBuild, readBom, listBuilds, writeBuild } from "./lib/store";
import { DATA_ROOT_ABS, atomicWriteJsonFile } from "./lib/store";
import { validateBuild, type BuildValidationResult } from "./lib/validate";
import { writeReceipt } from "./lib/receipts";
import { writeValidationOutput } from "./lib/validationOutput";
import { BuildParseError, parseBuild, type BenchTopLineBuild } from "./lib/schema";
import { QueryParseError, runQuery, buildMatchLabel } from "./lib/query";
import { BulkUpdateError, parseSetOps, planBulkUpdate } from "./lib/bulkUpdate";
import { searchNotes } from "./lib/searchNotes";
import { validateFixtures } from "./lib/fixtures";
import { VALIDATION_RULES, getRuleById, getRulesByScope, getRulesByActionFamily } from "./lib/rules";
import { randomUUID } from "node:crypto";
import * as path from "node:path";

// Exit codes per docs/handoff/POC_TASKS.json -> shared_conventions.cli_output.exit_codes
const EXIT_SUCCESS = 0;
const EXIT_VALIDATION_FAILED = 2;
const EXIT_USAGE_ERROR = 3;
const EXIT_IO_ERROR = 4;

type GlobalFlags = { json: boolean };

function printHelp(): void {
  process.stdout.write(
    [
      "Line Build PoC CLI",
      "",
      "Usage:",
      "  npx tsx poc/line-build-cli/scripts/lb.ts <command> [options]",
      "",
      "Global options:",
      "  --json            Output machine-readable JSON",
      "  --help, -h        Show help",
      "",
      "Commands:",
      "  find [query]      Discover builds by name or itemId (shows all if no query)",
      "  list <itemId>     List all builds for a specific menu item",
      "  read <buildId>    Read a specific build (full JSON)",
      "  read <buildId> --summary   Show compact build header",
      "  read <buildId> --steps     Show compact step table",
      "  write             Read build JSON from stdin and write if valid",
      "  view <buildId>    Ask viewer to switch to build (one-shot)",
      "  validate <buildId>         Validate on-disk build (writes validation file)",
      "  validate-stdin             Validate draft JSON from stdin (no file writes)",
      "  gaps <buildId>             Show validation gaps grouped for interview",
      "  gaps-stdin                 Show gaps for draft JSON from stdin",
      "  rules             List all validation rules",
      "  rules <ruleId>    Show details for a specific rule",
      "  search --equipment=<applianceId> --action=<family>",
      "  query --where <dsl>",
      "  bulk-update --where <dsl> --set <field>=<value> [--set ...] [--apply]",
      "  search-notes <pattern> [--flags <reFlags>]",
      "  validate-fixtures",
      "",
      "DSL (query/bulk-update --where):",
      "  Clauses separated by AND (no parentheses).",
      "  Supported forms: <field> = <value> | <field> != <value> | <field> in [..] | exists(<field>)",
      "",
    ].join("\n"),
  );
}

function parseGlobalFlags(argv: string[]): { flags: GlobalFlags; rest: string[] } {
  let json = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--json") {
      json = true;
      continue;
    }
    rest.push(a);
  }
  return { flags: { json }, rest };
}

function takeOption(
  argv: string[],
  name: string,
): { value: string | undefined; rest: string[] } {
  const out: string[] = [];
  let value: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === name) {
      value = argv[i + 1];
      i += 1;
      continue;
    }

    const prefix = `${name}=`;
    if (a.startsWith(prefix)) {
      value = a.slice(prefix.length);
      continue;
    }

    out.push(a);
  }

  return { value, rest: out };
}

function takeRepeatedOption(
  argv: string[],
  name: string,
): { values: string[]; rest: string[] } {
  const values: string[] = [];
  const out: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === name) {
      const v = argv[i + 1];
      if (v !== undefined) values.push(v);
      i += 1;
      continue;
    }

    const prefix = `${name}=`;
    if (a.startsWith(prefix)) {
      values.push(a.slice(prefix.length));
      continue;
    }

    out.push(a);
  }

  return { values, rest: out };
}

function hasFlag(argv: string[], name: string): { present: boolean; rest: string[] } {
  const rest = argv.filter((a) => a !== name);
  return { present: rest.length !== argv.length, rest };
}

function writeJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function writeHuman(lines: string[]): void {
  process.stdout.write(`${lines.join("\n")}\n`);
}

function writeError(flags: GlobalFlags, message: string): void {
  if (flags.json) {
    writeJson({ ok: false, error: { message } });
    return;
  }
  process.stderr.write(`${message}\n`);
}

async function readStdinUtf8(): Promise<string> {
  // Read all stdin deterministically.
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadAllBuilds(): Promise<BenchTopLineBuild[]> {
  const summaries = await listBuilds();
  const builds: BenchTopLineBuild[] = [];
  for (const s of summaries) {
    builds.push(await readBuild(s.buildId));
  }
  return builds;
}

async function cmdRead(flags: GlobalFlags, argv: string[]): Promise<number> {
  let rest = argv;
  const summaryFlag = hasFlag(rest, "--summary");
  rest = summaryFlag.rest;
  const stepsFlag = hasFlag(rest, "--steps");
  rest = stepsFlag.rest;

  const buildId = rest[0];
  if (!buildId) {
    writeError(flags, "usage: read <buildId> [--summary | --steps]");
    return EXIT_USAGE_ERROR;
  }

  if (summaryFlag.present && stepsFlag.present) {
    writeError(flags, "cannot use both --summary and --steps");
    return EXIT_USAGE_ERROR;
  }

  const build = await readBuild(buildId);

  // --summary: compact build header
  if (summaryFlag.present) {
    const summary = {
      buildId: build.id,
      itemId: build.itemId,
      version: build.version,
      status: build.status,
      name: build.name ?? null,
      stepCount: build.steps.length,
      firstStep: build.steps[0] ? buildMatchLabel(build.steps[0]) : null,
      lastStep: build.steps.length > 1 ? buildMatchLabel(build.steps[build.steps.length - 1]!) : null,
    };

    if (flags.json) {
      writeJson({ ok: true, ...summary });
      return EXIT_SUCCESS;
    }

    const lines: string[] = [];
    lines.push(`buildId=${summary.buildId}`);
    lines.push(`itemId=${summary.itemId}`);
    lines.push(`version=${summary.version}`);
    lines.push(`status=${summary.status}`);
    if (summary.name) lines.push(`name="${summary.name}"`);
    lines.push(`stepCount=${summary.stepCount}`);
    if (summary.firstStep) lines.push(`firstStep="${summary.firstStep}"`);
    if (summary.lastStep) lines.push(`lastStep="${summary.lastStep}"`);
    writeHuman(lines);
    return EXIT_SUCCESS;
  }

  // --steps: compact step table
  if (stepsFlag.present) {
    // Sort steps deterministically: by orderIndex, then trackId, then id
    const sortedSteps = [...build.steps].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      const aTrack = a.trackId ?? "";
      const bTrack = b.trackId ?? "";
      if (aTrack !== bTrack) return aTrack.localeCompare(bTrack);
      return a.id.localeCompare(b.id);
    });

    const stepRows = sortedSteps.map((s) => ({
      orderIndex: s.orderIndex,
      stepId: s.id,
      family: s.action.family,
      stationId: s.stationId ?? null,
      toolId: s.toolId ?? null,
      applianceId: s.equipment?.applianceId ?? null,
      durationSeconds: s.time?.durationSeconds ?? null,
      isActive: s.time?.isActive ?? null,
      label: buildMatchLabel(s),
    }));

    if (flags.json) {
      writeJson({ ok: true, buildId: build.id, steps: stepRows });
      return EXIT_SUCCESS;
    }

    const lines: string[] = [];
    lines.push(`buildId=${build.id} (${stepRows.length} steps)`);
    lines.push("");
    for (const r of stepRows) {
      const parts = [
        `[${r.orderIndex}]`,
        r.stepId,
        r.family,
        r.stationId ? `station=${r.stationId}` : "",
        r.applianceId ? `eq=${r.applianceId}` : "",
        r.durationSeconds !== null ? `t=${r.durationSeconds}s` : "",
        r.isActive !== null ? (r.isActive ? "active" : "passive") : "",
      ].filter(Boolean);
      lines.push(`${parts.join(" ")} :: ${r.label}`);
    }
    writeHuman(lines);
    return EXIT_SUCCESS;
  }

  // Default: full JSON
  if (flags.json) {
    writeJson({ ok: true, build });
    return EXIT_SUCCESS;
  }
  writeJson(build);
  return EXIT_SUCCESS;
}


async function cmdFind(flags: GlobalFlags, argv: string[]): Promise<number> {
  const query = argv[0]?.trim().toLowerCase();
  const summaries = await listBuilds();

  // Group builds by itemId
  const byItem = new Map<string, typeof summaries>();
  for (const b of summaries) {
    const existing = byItem.get(b.itemId) ?? [];
    existing.push(b);
    byItem.set(b.itemId, existing);
  }

  // Filter if query provided
  let matchedItems: Array<{ itemId: string; builds: typeof summaries; matchedName?: string }> = [];

  if (query) {
    for (const [itemId, builds] of byItem) {
      // Match by itemId
      if (itemId.toLowerCase().includes(query)) {
        const name = builds.find((b) => b.name)?.name;
        matchedItems.push({ itemId, builds, matchedName: name });
        continue;
      }
      // Match by any build name
      const matchingBuild = builds.find((b) => b.name?.toLowerCase().includes(query));
      if (matchingBuild) {
        matchedItems.push({ itemId, builds, matchedName: matchingBuild.name });
      }
    }
  } else {
    // No query — show all
    for (const [itemId, builds] of byItem) {
      const name = builds.find((b) => b.name)?.name;
      matchedItems.push({ itemId, builds, matchedName: name });
    }
  }

  // Sort by itemId
  matchedItems.sort((a, b) => a.itemId.localeCompare(b.itemId));

  if (flags.json) {
    writeJson({
      ok: true,
      query: query ?? null,
      matches: matchedItems.map((m) => ({
        itemId: m.itemId,
        name: m.matchedName ?? null,
        buildCount: m.builds.length,
        builds: m.builds.map((b) => ({
          buildId: b.buildId,
          name: b.name ?? null,
          version: b.version,
          status: b.status,
        })),
      })),
    });
    return EXIT_SUCCESS;
  }

  if (matchedItems.length === 0) {
    writeHuman([query ? `no matches for "${query}"` : "no builds found"]);
    return EXIT_SUCCESS;
  }

  const lines: string[] = [];
  lines.push(query ? `${matchedItems.length} match(es) for "${query}":` : `${matchedItems.length} menu item(s):`);
  for (const m of matchedItems) {
    const nameDisplay = m.matchedName ? ` "${m.matchedName}"` : "";
    lines.push(`- ${m.itemId}${nameDisplay} (${m.builds.length} build${m.builds.length === 1 ? "" : "s"})`);
  }
  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdList(flags: GlobalFlags, argv: string[]): Promise<number> {
  const itemId = argv[0];
  if (!itemId) {
    writeError(flags, "usage: list <itemId>");
    return EXIT_USAGE_ERROR;
  }

  const summaries = await listBuilds();
  const filtered = summaries.filter((b) => b.itemId === itemId);

  if (flags.json) {
    writeJson({ ok: true, itemId, builds: filtered });
    return EXIT_SUCCESS;
  }

  if (filtered.length === 0) {
    writeHuman([`no builds found for itemId=${itemId}`]);
    return EXIT_SUCCESS;
  }

  // Get a representative name from any build
  const itemName = filtered.find((b) => b.name)?.name;
  const header = itemName ? `builds for ${itemId} "${itemName}":` : `builds for ${itemId}:`;

  const lines: string[] = [header];
  for (const b of filtered) {
    const nameDisplay = b.name ? ` "${b.name}"` : "";
    lines.push(`- v${b.version}${nameDisplay} (${b.status}) buildId=${b.buildId}`);
  }
  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdView(flags: GlobalFlags, argv: string[]): Promise<number> {
  const buildId = argv[0];
  if (!buildId) {
    writeError(flags, "usage: view <buildId>");
    return EXIT_USAGE_ERROR;
  }

  // Validate the build exists (and is parseable) before telling the viewer.
  try {
    await readBuild(buildId);
  } catch {
    writeError(flags, `build not found: ${buildId}`);
    return EXIT_USAGE_ERROR;
  }

  const selectionPathAbs = path.join(DATA_ROOT_ABS, "viewer", "selection.json");
  const now = new Date().toISOString();
  const requestId = randomUUID();

  await atomicWriteJsonFile(selectionPathAbs, {
    buildId,
    requestId,
    timestamp: now,
  });

  if (flags.json) {
    writeJson({ ok: true, buildId, requestId, selectionPathAbs });
    return EXIT_SUCCESS;
  }

  writeHuman([`viewer selection requested: buildId=${buildId}`, `requestId=${requestId}`]);
  return EXIT_SUCCESS;
}

async function validateBuildWithOptionalBom(build: BenchTopLineBuild) {
  const bom = await readBom(build.itemId);
  const result = validateBuild(build, { bom });
  return { bomFound: !!bom, result };
}

async function cmdValidate(flags: GlobalFlags, argv: string[]): Promise<number> {
  const buildId = argv[0];
  if (!buildId) {
    writeError(flags, "usage: validate <buildId>");
    return EXIT_USAGE_ERROR;
  }

  const build = await readBuild(buildId);
  const { bomFound, result } = await validateBuildWithOptionalBom(build);

  const { output, filePathAbs } = await writeValidationOutput(build, result);

  if (flags.json) {
    writeJson({ ok: true, validation: output, filePathAbs, bomFound });
    return result.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
  }

  const lines: string[] = [];
  lines.push(`buildId=${build.id} itemId=${build.itemId} valid=${String(result.valid)}`);
  lines.push(`validationFile=${filePathAbs}`);
  if (bomFound) lines.push("bom=loaded");
  if (result.hardErrors.length > 0) {
    lines.push("");
    lines.push(`hardErrors (${result.hardErrors.length}):`);
    for (const e of result.hardErrors) {
      lines.push(
        `- [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
      );
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(`warnings (${result.warnings.length}):`);
    for (const e of result.warnings) {
      lines.push(
        `- [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
      );
    }
  }
  writeHuman(lines);

  return result.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
}

async function cmdValidateStdin(flags: GlobalFlags): Promise<number> {
  // Read and parse JSON from stdin
  const raw = await readStdinUtf8();
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch (err) {
    if (flags.json) {
      writeJson({
        ok: false,
        error: { message: `invalid JSON on stdin: ${(err as { message?: string }).message ?? String(err)}` },
      });
    } else {
      writeError(flags, `invalid JSON on stdin: ${(err as { message?: string }).message ?? String(err)}`);
    }
    return EXIT_VALIDATION_FAILED;
  }

  // Parse build schema
  let build: BenchTopLineBuild;
  try {
    build = parseBuild(json);
  } catch (err) {
    if (err instanceof BuildParseError) {
      if (flags.json) {
        writeJson({ ok: false, error: { message: err.message, issues: err.issues } });
      } else {
        writeHuman([
          err.message,
          ...err.issues.map((i) => `- ${i.path}: ${i.message} (${i.code})`),
        ]);
      }
      return EXIT_VALIDATION_FAILED;
    }
    throw err;
  }

  // Validate build (draft-safe: no writing)
  const { bomFound, result } = await validateBuildWithOptionalBom(build);

  if (flags.json) {
    writeJson({
      ok: true,
      valid: result.valid,
      bomFound,
      validation: {
        valid: result.valid,
        hardErrors: result.hardErrors,
        warnings: result.warnings,
        metrics: result.metrics,
      },
    });
    return result.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
  }

  const lines: string[] = [];
  lines.push(`valid=${String(result.valid)}`);
  if (bomFound) lines.push("bom=loaded");
  if (result.hardErrors.length > 0) {
    lines.push("");
    lines.push(`hardErrors (${result.hardErrors.length}):`);
    for (const e of result.hardErrors) {
      lines.push(
        `- [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
      );
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(`warnings (${result.warnings.length}):`);
    for (const e of result.warnings) {
      lines.push(
        `- [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
      );
    }
  }
  writeHuman(lines);

  return result.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
}

type GapStep = {
  stepId: string;
  orderIndex: number;
  label: string;
  fieldPaths: string[];
};

type Gap = {
  ruleId: string;
  scope: "Build" | "Step";
  appliesTo: string | null;
  message: string;
  steps: GapStep[];
};

function buildGapsFromValidation(
  build: BenchTopLineBuild,
  result: ReturnType<typeof validateBuild>,
): Gap[] {
  // Group errors by ruleId
  const byRule = new Map<string, Array<typeof result.hardErrors[number]>>();
  for (const err of result.hardErrors) {
    const existing = byRule.get(err.ruleId) ?? [];
    existing.push(err);
    byRule.set(err.ruleId, existing);
  }

  // Create step lookup for labels
  const stepById = new Map(build.steps.map((s) => [s.id, s] as const));

  const gaps: Gap[] = [];
  for (const [ruleId, errors] of byRule) {
    const rule = getRuleById(ruleId);
    const scope = rule?.scope ?? "Build";
    const appliesTo = rule?.appliesTo ?? null;

    // Collect step details for step-level errors
    const stepDetails: GapStep[] = [];
    const seenSteps = new Set<string>();

    for (const err of errors) {
      if (err.stepId && !seenSteps.has(err.stepId)) {
        seenSteps.add(err.stepId);
        const step = stepById.get(err.stepId);
        stepDetails.push({
          stepId: err.stepId,
          orderIndex: step?.orderIndex ?? -1,
          label: step ? buildMatchLabel(step) : "",
          fieldPaths: errors
            .filter((e) => e.stepId === err.stepId && e.fieldPath)
            .map((e) => e.fieldPath!),
        });
      }
    }

    // Sort steps by orderIndex
    stepDetails.sort((a, b) => a.orderIndex - b.orderIndex);

    // Use first error message as representative
    const message = errors[0]?.message?.replace(/^H\d+:\s*/, "") ?? rule?.description ?? ruleId;

    gaps.push({
      ruleId,
      scope,
      appliesTo,
      message,
      steps: stepDetails,
    });
  }

  // Sort gaps by rule ID
  gaps.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  return gaps;
}

async function cmdGaps(flags: GlobalFlags, argv: string[]): Promise<number> {
  const buildId = argv[0];
  if (!buildId) {
    writeError(flags, "usage: gaps <buildId>");
    return EXIT_USAGE_ERROR;
  }

  const build = await readBuild(buildId);
  const { bomFound, result } = await validateBuildWithOptionalBom(build);
  const gaps = buildGapsFromValidation(build, result);

  if (flags.json) {
    writeJson({
      ok: true,
      buildId: build.id,
      valid: result.valid,
      bomFound,
      gaps,
    });
    return EXIT_SUCCESS;
  }

  if (result.valid) {
    writeHuman([`buildId=${build.id} valid=true gaps=0`]);
    return EXIT_SUCCESS;
  }

  const lines: string[] = [];
  lines.push(`buildId=${build.id} valid=false gaps=${gaps.length}`);
  if (bomFound) lines.push("bom=loaded");
  lines.push("");

  for (const gap of gaps) {
    const appliesTo = gap.appliesTo ? ` [${gap.appliesTo}]` : "";
    lines.push(`[${gap.ruleId}]${appliesTo}: ${gap.message}`);
    if (gap.steps.length > 0) {
      for (const s of gap.steps) {
        const fields = s.fieldPaths.length > 0 ? ` fields=[${s.fieldPaths.join(", ")}]` : "";
        lines.push(`  - step ${s.stepId} (order=${s.orderIndex})${fields}: ${s.label}`);
      }
    }
    lines.push("");
  }

  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdGapsStdin(flags: GlobalFlags): Promise<number> {
  // Read and parse JSON from stdin
  const raw = await readStdinUtf8();
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch (err) {
    if (flags.json) {
      writeJson({
        ok: false,
        error: { message: `invalid JSON on stdin: ${(err as { message?: string }).message ?? String(err)}` },
      });
    } else {
      writeError(flags, `invalid JSON on stdin: ${(err as { message?: string }).message ?? String(err)}`);
    }
    return EXIT_VALIDATION_FAILED;
  }

  // Parse build schema
  let build: BenchTopLineBuild;
  try {
    build = parseBuild(json);
  } catch (err) {
    if (err instanceof BuildParseError) {
      if (flags.json) {
        writeJson({ ok: false, error: { message: err.message, issues: err.issues } });
      } else {
        writeHuman([
          err.message,
          ...err.issues.map((i) => `- ${i.path}: ${i.message} (${i.code})`),
        ]);
      }
      return EXIT_VALIDATION_FAILED;
    }
    throw err;
  }

  const { bomFound, result } = await validateBuildWithOptionalBom(build);
  const gaps = buildGapsFromValidation(build, result);

  if (flags.json) {
    writeJson({
      ok: true,
      buildId: build.id,
      valid: result.valid,
      bomFound,
      gaps,
    });
    return EXIT_SUCCESS;
  }

  if (result.valid) {
    writeHuman([`valid=true gaps=0`]);
    return EXIT_SUCCESS;
  }

  const lines: string[] = [];
  lines.push(`valid=false gaps=${gaps.length}`);
  if (bomFound) lines.push("bom=loaded");
  lines.push("");

  for (const gap of gaps) {
    const appliesTo = gap.appliesTo ? ` [${gap.appliesTo}]` : "";
    lines.push(`[${gap.ruleId}]${appliesTo}: ${gap.message}`);
    if (gap.steps.length > 0) {
      for (const s of gap.steps) {
        const fields = s.fieldPaths.length > 0 ? ` fields=[${s.fieldPaths.join(", ")}]` : "";
        lines.push(`  - step ${s.stepId} (order=${s.orderIndex})${fields}: ${s.label}`);
      }
    }
    lines.push("");
  }

  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdWrite(flags: GlobalFlags): Promise<number> {
  const raw = await readStdinUtf8();
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch (err) {
    writeError(flags, `invalid JSON on stdin: ${(err as { message?: string }).message ?? String(err)}`);
    return EXIT_VALIDATION_FAILED;
  }
  const parsed = parseBuild(json);

  // Update updatedAt on write to make viewer polling deterministic later.
  const now = new Date().toISOString();
  const build: BenchTopLineBuild = { ...parsed, updatedAt: now };

  const { result } = await validateBuildWithOptionalBom(build);
  if (!result.valid) {
    if (flags.json) {
      writeJson({ ok: false, validation: result });
    } else {
      writeHuman([
        `validation failed (buildId=${build.id} itemId=${build.itemId})`,
        ...result.hardErrors.map(
          (e) => `- [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
        ),
      ]);
    }
    return EXIT_VALIDATION_FAILED;
  }

  const buildFilePathAbs = await writeBuild(build);
  const { output: validationOutput, filePathAbs: validationFilePathAbs } =
    await writeValidationOutput(build, result, now);

  const touchedFiles = [buildFilePathAbs, validationFilePathAbs];
  const { receipt, filePathAbs: receiptPathAbs } = await writeReceipt({
    command: "write",
    timestamp: now,
    inputs: { buildId: build.id, itemId: build.itemId },
    outputs: { buildFilePathAbs, validationFilePathAbs, valid: true },
    touchedFiles,
  });
  touchedFiles.push(receiptPathAbs);

  if (flags.json) {
    writeJson({
      ok: true,
      buildId: build.id,
      itemId: build.itemId,
      buildFilePathAbs,
      validationFilePathAbs,
      receipt,
      receiptPathAbs,
    });
    return EXIT_SUCCESS;
  }

  writeHuman([
    `wrote buildId=${build.id} itemId=${build.itemId}`,
    `buildFile=${buildFilePathAbs}`,
    `validationFile=${validationFilePathAbs}`,
    `receiptFile=${receiptPathAbs}`,
  ]);
  return EXIT_SUCCESS;
}

async function cmdSearch(flags: GlobalFlags, argv: string[]): Promise<number> {
  let rest = argv;
  const equipmentOpt = takeOption(rest, "--equipment");
  rest = equipmentOpt.rest;
  const actionOpt = takeOption(rest, "--action");
  rest = actionOpt.rest;

  const equipment = equipmentOpt.value;
  const action = actionOpt.value;

  if (!equipment && !action) {
    writeError(flags, "usage: search --equipment=<applianceId> --action=<family> (at least one required)");
    return EXIT_USAGE_ERROR;
  }

  const builds = await loadAllBuilds();
  const matches: Array<{
    buildId: string;
    itemId: string;
    version: number;
    status: BenchTopLineBuild["status"];
    stepId: string;
    orderIndex: number;
    applianceId?: string;
    actionFamily: string;
    instruction?: string;
  }> = [];

  for (const b of builds) {
    for (const s of b.steps) {
      if (equipment && s.equipment?.applianceId !== equipment) continue;
      if (action && s.action.family !== action) continue;
      matches.push({
        buildId: b.id,
        itemId: b.itemId,
        version: b.version,
        status: b.status,
        stepId: s.id,
        orderIndex: s.orderIndex,
        applianceId: s.equipment?.applianceId,
        actionFamily: s.action.family,
        instruction: s.instruction,
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

  if (flags.json) {
    writeJson({ ok: true, query: { equipment, action }, matches });
    return EXIT_SUCCESS;
  }

  writeHuman([
    `matches: ${matches.length}`,
    ...matches.map(
      (m) =>
        `- ${m.itemId} v${m.version} step=${m.stepId} order=${m.orderIndex} family=${m.actionFamily} eq=${m.applianceId ?? "-"}` +
        (m.instruction ? ` :: ${m.instruction}` : ""),
    ),
  ]);
  return EXIT_SUCCESS;
}

async function cmdQuery(flags: GlobalFlags, argv: string[]): Promise<number> {
  const whereOpt = takeOption(argv, "--where");
  const where = whereOpt.value;
  if (!where) {
    writeError(flags, "usage: query --where <dsl>");
    return EXIT_USAGE_ERROR;
  }

  const builds = await loadAllBuilds();
  const { matches } = runQuery({ builds, where });

  if (flags.json) {
    writeJson({ ok: true, where, matches });
    return EXIT_SUCCESS;
  }

  writeHuman([
    `matches: ${matches.length}`,
    ...matches.map(
      (m) =>
        `- ${m.itemId} v${m.version} (${m.status}) step=${m.stepId} order=${m.orderIndex} :: ${m.label}`,
    ),
  ]);
  return EXIT_SUCCESS;
}

async function cmdBulkUpdate(flags: GlobalFlags, argv: string[]): Promise<number> {
  let rest = argv;
  const whereOpt = takeOption(rest, "--where");
  rest = whereOpt.rest;
  const setsOpt = takeRepeatedOption(rest, "--set");
  rest = setsOpt.rest;
  const applyFlag = hasFlag(rest, "--apply");
  rest = applyFlag.rest;

  const where = whereOpt.value;
  if (!where) {
    writeError(flags, "usage: bulk-update --where <dsl> --set <field>=<value> [--set ...] [--apply]");
    return EXIT_USAGE_ERROR;
  }

  const sets = parseSetOps(setsOpt.values);
  const builds = await loadAllBuilds();
  const { planned } = planBulkUpdate({ builds, where, sets });

  const changed = planned.filter((p) => p.changes.length > 0);

  if (!applyFlag.present) {
    // Dry-run (default)
    if (flags.json) {
      writeJson({
        ok: true,
        mode: "dry-run",
        where,
        matchedBuilds: planned.length,
        changedBuilds: changed.length,
        summary: planned.map((p) => ({
          buildId: p.buildId,
          itemId: p.itemId,
          version: p.version,
          status: p.status,
          matchedSteps: p.matchedSteps,
          changeCount: p.changes.length,
          changes: p.changes,
        })),
      });
      return EXIT_SUCCESS;
    }

    const lines: string[] = [];
    lines.push(`dry-run: matchedBuilds=${planned.length} changedBuilds=${changed.length}`);
    for (const p of planned) {
      lines.push(``);
      lines.push(
        `- ${p.itemId} v${p.version} buildId=${p.buildId} matchedSteps=${p.matchedSteps} changes=${p.changes.length}`,
      );
      for (const c of p.changes) {
        if (c.scope === "build") {
          lines.push(`  - build ${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
        } else {
          lines.push(
            `  - step ${c.stepId} (order=${c.orderIndex}) ${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`,
          );
        }
      }
    }
    writeHuman(lines);
    return EXIT_SUCCESS;
  }

  // Apply mode: validate all changed builds first, then write.
  if (changed.length === 0) {
    if (flags.json) {
      writeJson({ ok: true, mode: "apply", where, appliedBuilds: 0 });
      return EXIT_SUCCESS;
    }
    writeHuman(["apply: no changes to write"]);
    return EXIT_SUCCESS;
  }

  const now = new Date().toISOString();
  const validations: Array<{
    build: BenchTopLineBuild;
    result: ReturnType<typeof validateBuild>;
  }> = [];

  for (const p of changed) {
    const updated: BenchTopLineBuild = { ...p.after, updatedAt: now };
    const { result } = await validateBuildWithOptionalBom(updated);
    validations.push({ build: updated, result });
  }

  const invalid = validations.filter((v) => !v.result.valid);
  if (invalid.length > 0) {
    if (flags.json) {
      writeJson({
        ok: false,
        mode: "apply",
        where,
        error: "validation_failed",
        invalidBuilds: invalid.map((v) => ({
          buildId: v.build.id,
          itemId: v.build.itemId,
          hardErrors: v.result.hardErrors,
          warnings: v.result.warnings,
        })),
      });
    } else {
      const lines: string[] = [];
      lines.push(`apply aborted: ${invalid.length} build(s) would be invalid`);
      for (const v of invalid) {
        lines.push(`- buildId=${v.build.id} itemId=${v.build.itemId}`);
      }
      writeHuman(lines);
    }
    return EXIT_VALIDATION_FAILED;
  }

  const touchedFiles: string[] = [];
  const applied: Array<{ buildId: string; itemId: string; buildFilePathAbs: string; validationFilePathAbs: string }> = [];

  for (const v of validations) {
    const buildFilePathAbs = await writeBuild(v.build);
    touchedFiles.push(buildFilePathAbs);

    const { filePathAbs: validationFilePathAbs } = await writeValidationOutput(
      v.build,
      v.result,
      now,
    );
    touchedFiles.push(validationFilePathAbs);

    applied.push({
      buildId: v.build.id,
      itemId: v.build.itemId,
      buildFilePathAbs,
      validationFilePathAbs,
    });
  }

  const { receipt, filePathAbs: receiptPathAbs } = await writeReceipt({
    command: "bulk-update",
    timestamp: now,
    inputs: { where, sets, apply: true },
    outputs: { appliedBuilds: applied.length },
    touchedFiles,
  });
  touchedFiles.push(receiptPathAbs);

  if (flags.json) {
    writeJson({
      ok: true,
      mode: "apply",
      where,
      applied,
      receipt,
      receiptPathAbs,
    });
    return EXIT_SUCCESS;
  }

  writeHuman([
    `apply: wrote ${applied.length} build(s)`,
    ...applied.map((a) => `- buildId=${a.buildId} itemId=${a.itemId}`),
    `receiptFile=${receiptPathAbs}`,
  ]);
  return EXIT_SUCCESS;
}

async function cmdSearchNotes(flags: GlobalFlags, argv: string[]): Promise<number> {
  let rest = argv;
  const pattern = rest[0];
  if (!pattern) {
    writeError(flags, "usage: search-notes <pattern> [--flags <reFlags>]");
    return EXIT_USAGE_ERROR;
  }
  rest = rest.slice(1);
  const flagsOpt = takeOption(rest, "--flags");
  const reFlags = flagsOpt.value;

  const builds = await loadAllBuilds();
  let result: ReturnType<typeof searchNotes>;
  try {
    result = searchNotes({ builds, pattern, flags: reFlags });
  } catch (err) {
    writeError(flags, `invalid regex: ${(err as { message?: string }).message ?? String(err)}`);
    return EXIT_USAGE_ERROR;
  }

  if (flags.json) {
    writeJson({ ok: true, ...result });
    return EXIT_SUCCESS;
  }

  writeHuman([
    `matches: ${result.matches.length}`,
    ...result.matches.map(
      (m) =>
        `- ${m.itemId} v${m.version} step=${m.stepId} order=${m.orderIndex} field=${m.field} match=${m.matchText} :: ${m.snippet}`,
    ),
  ]);
  return EXIT_SUCCESS;
}

async function cmdRules(flags: GlobalFlags, argv: string[]): Promise<number> {
  const ruleId = argv[0];

  if (ruleId) {
    // Show specific rule
    const rule = getRuleById(ruleId);
    if (!rule) {
      writeError(flags, `rule not found: ${ruleId}`);
      return EXIT_USAGE_ERROR;
    }

    if (flags.json) {
      writeJson({ ok: true, rule });
      return EXIT_SUCCESS;
    }

    const appliesTo = rule.appliesTo ? ` (applies to: ${rule.appliesTo})` : "";
    writeHuman([`${rule.id}: ${rule.description}${appliesTo}`, `Scope: ${rule.scope}`]);
    return EXIT_SUCCESS;
  }

  // List all rules
  if (flags.json) {
    writeJson({ ok: true, rules: VALIDATION_RULES });
    return EXIT_SUCCESS;
  }

  const buildRules = getRulesByScope("Build");
  const stepRules = getRulesByScope("Step");

  const lines: string[] = [];
  lines.push(`Validation Rules (${VALIDATION_RULES.length} total)`);
  lines.push("");
  lines.push(`Build-level rules (${buildRules.length}):`);
  for (const r of buildRules) {
    const appliesTo = r.appliesTo ? ` [${r.appliesTo}]` : "";
    lines.push(`  ${r.id}: ${r.description}${appliesTo}`);
  }
  lines.push("");
  lines.push(`Step-level rules (${stepRules.length}):`);
  for (const r of stepRules) {
    const appliesTo = r.appliesTo ? ` [${r.appliesTo}]` : "";
    lines.push(`  ${r.id}: ${r.description}${appliesTo}`);
  }
  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdValidateFixtures(flags: GlobalFlags, argv: string[]): Promise<number> {
  if (argv.length > 0) {
    writeError(flags, "usage: validate-fixtures");
    return EXIT_USAGE_ERROR;
  }

  const summary = await validateFixtures();

  if (flags.json) {
    writeJson({
      ok: summary.ok,
      fixtureCount: summary.fixtureCount,
      passed: summary.passed,
      failed: summary.failed,
      rows: summary.rows,
    });
    return summary.ok ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
  }

  const lines: string[] = [];
  lines.push(`fixtures: ${summary.fixtureCount} passed=${summary.passed} failed=${summary.failed}`);
  for (const r of summary.rows) {
    const expectedValid = r.expected?.expectedValid;
    const actualValid = r.validation?.valid;
    lines.push(
      `- ${r.fileName} buildId=${r.buildId ?? "-"} itemId=${r.itemId ?? "-"} expectedValid=${
        expectedValid === undefined ? "-" : String(expectedValid)
      } actualValid=${actualValid === undefined ? "-" : String(actualValid)} ok=${String(r.ok)}`,
    );
    if (r.notes) lines.push(`  - note: ${r.notes}`);

    if (r.parseIssues && r.parseIssues.length > 0) {
      lines.push(`  - parseIssues (${r.parseIssues.length}):`);
      for (const i of r.parseIssues.slice(0, 10)) {
        lines.push(`    - ${i.path}: ${i.message} (${i.code})`);
      }
      if (r.parseIssues.length > 10) lines.push(`    - ... ${r.parseIssues.length - 10} more`);
      continue;
    }

    if (r.validation) {
      if (r.validation.hardErrors.length > 0) {
        lines.push(`  - hardErrors (${r.validation.hardErrors.length}):`);
        for (const e of r.validation.hardErrors.slice(0, 10)) {
          lines.push(
            `    - [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
          );
        }
        if (r.validation.hardErrors.length > 10) {
          lines.push(`    - ... ${r.validation.hardErrors.length - 10} more`);
        }
      }
      if (r.validation.warnings.length > 0) {
        lines.push(`  - warnings (${r.validation.warnings.length}):`);
        for (const e of r.validation.warnings.slice(0, 10)) {
          lines.push(
            `    - [${e.ruleId}] step=${e.stepId ?? "-"} field=${e.fieldPath ?? "-"} ${e.message}`,
          );
        }
        if (r.validation.warnings.length > 10) {
          lines.push(`    - ... ${r.validation.warnings.length - 10} more`);
        }
      }
    }
  }

  writeHuman(lines);
  return summary.ok ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    printHelp();
    return EXIT_SUCCESS;
  }

  const { flags, rest } = parseGlobalFlags(argv);
  const [cmd, ...args] = rest;

  if (!cmd) {
    printHelp();
    return EXIT_USAGE_ERROR;
  }

  switch (cmd) {
    case "find":
      return await cmdFind(flags, args);
    case "list":
      return await cmdList(flags, args);
    case "read":
      return await cmdRead(flags, args);
    case "write":
      if (args.length > 0) {
        writeError(flags, "usage: write");
        return EXIT_USAGE_ERROR;
      }
      return await cmdWrite(flags);
    case "view":
      return await cmdView(flags, args);
    case "validate":
      return await cmdValidate(flags, args);
    case "validate-stdin":
      if (args.length > 0) {
        writeError(flags, "usage: validate-stdin (reads JSON from stdin)");
        return EXIT_USAGE_ERROR;
      }
      return await cmdValidateStdin(flags);
    case "gaps":
      return await cmdGaps(flags, args);
    case "gaps-stdin":
      if (args.length > 0) {
        writeError(flags, "usage: gaps-stdin (reads JSON from stdin)");
        return EXIT_USAGE_ERROR;
      }
      return await cmdGapsStdin(flags);
    case "search":
      return await cmdSearch(flags, args);
    case "query":
      return await cmdQuery(flags, args);
    case "bulk-update":
      return await cmdBulkUpdate(flags, args);
    case "search-notes":
      return await cmdSearchNotes(flags, args);
    case "validate-fixtures":
      return await cmdValidateFixtures(flags, args);
    case "rules":
      return await cmdRules(flags, args);
    default:
      writeError(flags, `unknown command: ${cmd}`);
      return EXIT_USAGE_ERROR;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    const { flags } = parseGlobalFlags(process.argv.slice(2));

    // Usage (query parsing, bulk-update parsing, etc.)
    if (err instanceof QueryParseError || err instanceof BulkUpdateError) {
      writeError(flags, err.message);
      process.exitCode = EXIT_USAGE_ERROR;
      return;
    }

    // Validation (schema parse errors, etc.)
    if (err instanceof BuildParseError) {
      if (flags.json) {
        writeJson({ ok: false, error: { message: err.message, issues: err.issues } });
      } else {
        writeHuman([
          err.message,
          ...err.issues.map((i) => `- ${i.path}: ${i.message} (${i.code})`),
        ]);
      }
      process.exitCode = EXIT_VALIDATION_FAILED;
      return;
    }
    if (err instanceof SyntaxError) {
      // JSON.parse failures (e.g., corrupted build files) should be treated as validation failures.
      writeError(flags, `validation failed: ${err.message}`);
      process.exitCode = EXIT_VALIDATION_FAILED;
      return;
    }

    // IO / other
    const e = err as { message?: string; code?: string };
    if (e?.code === "ENOENT" || e?.code === "EACCES") {
      writeError(flags, `io error: ${e.code ?? "IO"} ${e.message ?? String(err)}`);
      process.exitCode = EXIT_IO_ERROR;
      return;
    }

    writeError(flags, `error: ${e?.message ?? String(err)}`);
    process.exitCode = EXIT_IO_ERROR;
  });

