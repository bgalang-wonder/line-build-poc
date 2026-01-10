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
import { validateBuild } from "./lib/validate";
import { writeReceipt } from "./lib/receipts";
import { writeValidationOutput } from "./lib/validationOutput";
import { BuildParseError, parseBuild, type BenchTopLineBuild } from "./lib/schema";
import { QueryParseError, runQuery } from "./lib/query";
import { BulkUpdateError, parseSetOps, planBulkUpdate } from "./lib/bulkUpdate";
import { searchNotes } from "./lib/searchNotes";
import { validateFixtures } from "./lib/fixtures";

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
      "  read <buildId>",
      "  write             Read build JSON from stdin and write if valid",
      "  validate <buildId>",
      "  list",
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
  const buildId = argv[0];
  if (!buildId) {
    writeError(flags, "usage: read <buildId>");
    return EXIT_USAGE_ERROR;
  }

  const build = await readBuild(buildId);
  if (flags.json) {
    writeJson({ ok: true, build });
    return EXIT_SUCCESS;
  }
  writeJson(build);
  return EXIT_SUCCESS;
}

async function cmdList(flags: GlobalFlags): Promise<number> {
  const summaries = await listBuilds();
  if (flags.json) {
    writeJson({ ok: true, builds: summaries });
    return EXIT_SUCCESS;
  }

  const lines: string[] = [];
  lines.push(`builds: ${summaries.length}`);
  for (const b of summaries) {
    lines.push(
      `- ${b.itemId} v${b.version} (${b.status}) buildId=${b.buildId} updatedAt=${b.updatedAt}`,
    );
  }
  writeHuman(lines);
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
    case "read":
      return await cmdRead(flags, args);
    case "write":
      if (args.length > 0) {
        writeError(flags, "usage: write");
        return EXIT_USAGE_ERROR;
      }
      return await cmdWrite(flags);
    case "validate":
      return await cmdValidate(flags, args);
    case "list":
      if (args.length > 0) {
        writeError(flags, "usage: list");
        return EXIT_USAGE_ERROR;
      }
      return await cmdList(flags);
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

