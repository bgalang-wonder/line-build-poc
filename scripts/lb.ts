/**
 * Line Build PoC CLI (Rebuilt for Stable Interface)
 *
 * Usage:
 *   npx tsx scripts/lb.ts <command> [options]
 */

import { readBuild, readBom, listBuilds, writeBuild, DATA_ROOT_ABS } from "./lib/store";
import { validateBuild } from "./lib/validate";
import { writeReceipt } from "./lib/receipts";
import { writeValidationOutput } from "./lib/validationOutput";
import { BuildParseError, parseBuild, type BenchTopLineBuild } from "./lib/schema";
import { runQuery, buildMatchLabel, buildGapsFromValidation, type QueryClause, parseWhere } from "./lib/query";
import { searchNotes } from "./lib/searchNotes";
import { validateFixtures } from "./lib/fixtures";
import { VALIDATION_RULES, getRuleById, getRulesByScope } from "./lib/rules";
import { applyOps, type EditOp, EditError } from "./lib/edit";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";

const EXIT_SUCCESS = 0;
const EXIT_VALIDATION_FAILED = 2;
const EXIT_USAGE_ERROR = 3;
const EXIT_IO_ERROR = 4;

type GlobalFlags = { json: boolean };

function printHelp(): void {
  process.stdout.write(
    [
      "Line Build CLI",
      "",
      "Commands:",
      "  list [--query <q>] [--item <itemId>]      Discover builds",
      "  get <buildId> [--format full|summary|steps|gaps]  Read build",
      "  write [--stdin | --file <path>]           Create/replace build from JSON",
      "  edit <buildId> [--op <json> ...] [--apply] [--normalize]  Incremental edits",
      "  validate <buildId> [--stdin] [--gaps]     Run validation",
      "  search [--where <dsl>] [--notes <regex>]  Search steps/notes",
      "  rules [ruleId]                            Reference rules",
      "  view <buildId>                            Jump viewer to build",
      "  validate-fixtures                         Run test harness",
      "",
      "Global options:",
      "  --json            Output machine-readable JSON",
      "  --help, -h        Show help",
      "",
    ].join("\n"),
  );
}

// --- Utils ---

function parseGlobalFlags(argv: string[]): { flags: GlobalFlags; rest: string[] } {
  let json = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--json") { json = true; continue; }
    rest.push(a);
  }
  return { flags: { json }, rest };
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

function takeRepeatedOption(argv: string[], name: string): { values: string[]; rest: string[] } {
  const values: string[] = [];
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === name) { const v = argv[i + 1]; if (v) values.push(v); i += 1; continue; }
    if (a.startsWith(`${name}=`)) { values.push(a.slice(name.length + 1)); continue; }
    out.push(a);
  }
  return { values, rest: out };
}

function hasFlag(argv: string[], name: string): { present: boolean; rest: string[] } {
  const rest = argv.filter((a) => a !== name);
  return { present: rest.length !== argv.length, rest };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
function writeError(flags: GlobalFlags, message: string) {
  if (flags.json) writeJson({ ok: false, error: { message } });
  else process.stderr.write(message + "\n");
}

async function loadAllBuilds(): Promise<BenchTopLineBuild[]> {
  const summaries = await listBuilds();
  const builds: BenchTopLineBuild[] = [];
  for (const s of summaries) builds.push(await readBuild(s.buildId));
  return builds;
}

// --- Commands ---

async function cmdList(flags: GlobalFlags, argv: string[]): Promise<number> {
  const queryOpt = takeOption(argv, "--query");
  const itemOpt = takeOption(queryOpt.rest, "--item");
  const query = queryOpt.value?.toLowerCase();
  const itemId = itemOpt.value;

  let builds = await listBuilds();
  if (itemId) builds = builds.filter(b => b.itemId === itemId);
  if (query) builds = builds.filter(b => b.itemId.includes(query) || b.name?.toLowerCase().includes(query));

  if (flags.json) {
    writeJson({ ok: true, builds });
    return EXIT_SUCCESS;
  }

  const lines = [`Found ${builds.length} build(s):`];
  for (const b of builds) {
    lines.push(`- ${b.itemId} "${b.name || '(unnamed)'}" v${b.version} (${b.status}) id=${b.buildId}`);
  }
  writeHuman(lines);
  return EXIT_SUCCESS;
}

async function cmdGet(flags: GlobalFlags, argv: string[]): Promise<number> {
  const formatOpt = takeOption(argv, "--format");
  const buildId = formatOpt.rest[0];
  if (!buildId) { writeError(flags, "usage: get <buildId> [--format full|summary|steps|gaps]"); return EXIT_USAGE_ERROR; }

  const build = await readBuild(buildId);
  const format = formatOpt.value || "full";

  if (format === "summary") {
    const summary = { id: build.id, itemId: build.itemId, version: build.version, status: build.status, steps: build.steps.length };
    if (flags.json) writeJson({ ok: true, ...summary });
    else writeHuman(Object.entries(summary).map(([k, v]) => `${k}=${v}`));
  } else if (format === "steps") {
    if (flags.json) writeJson({ ok: true, steps: build.steps });
    else {
      const lines = [`buildId=${build.id} (${build.steps.length} steps):`];
      for (const s of build.steps) lines.push(`[${s.orderIndex}] ${s.id} ${s.action.family} :: ${buildMatchLabel(s)}`);
      writeHuman(lines);
    }
  } else if (format === "gaps") {
    const bom = await readBom(build.itemId);
    const validation = validateBuild(build, { bom });
    const gaps = buildGapsFromValidation(build, validation);
    if (flags.json) writeJson({ ok: true, gaps });
    else {
      const lines = [`Gaps for ${build.id} (${gaps.length}):`];
      for (const g of gaps) lines.push(`[${g.ruleId}] ${g.message} (${g.steps.length} steps affected)`);
      writeHuman(lines);
    }
  } else {
    writeJson(build);
  }
  return EXIT_SUCCESS;
}

async function cmdWrite(flags: GlobalFlags, argv: string[]): Promise<number> {
  const fileOpt = takeOption(argv, "--file");
  const stdinFlag = hasFlag(fileOpt.rest, "--stdin");
  let raw: string;
  if (fileOpt.value) raw = await fs.readFile(fileOpt.value, "utf8");
  else raw = await readStdin();

  let build: BenchTopLineBuild;
  try {
    build = parseBuild(JSON.parse(raw));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeError(flags, `Invalid JSON input: ${msg}`);
    return EXIT_USAGE_ERROR;
  }
  const bom = await readBom(build.itemId);
  const validation = validateBuild(build, { bom });

  // Policy:
  // - Drafts may be invalid (validation output is still written).
  // - Published builds must be valid (no hard errors).
  if (build.status === "published" && !validation.valid) {
    writeError(flags, `Publish blocked: ${validation.hardErrors[0]?.message}`);
    return EXIT_VALIDATION_FAILED;
  }

  const buildPath = await writeBuild(build);
  await writeValidationOutput(build, validation);
  await writeReceipt({ command: "write", timestamp: new Date().toISOString(), inputs: { buildId: build.id }, outputs: { path: buildPath, valid: validation.valid }, touchedFiles: [buildPath] });

  if (flags.json) writeJson({ ok: true, buildId: build.id, path: buildPath });
  else writeHuman([`Wrote ${build.id} to ${buildPath}`]);
  return EXIT_SUCCESS;
}

async function cmdEdit(flags: GlobalFlags, argv: string[]): Promise<number> {
  const opsOpt = takeRepeatedOption(argv, "--op");
  const applyFlag = hasFlag(opsOpt.rest, "--apply");
  const normalizeFlag = hasFlag(applyFlag.rest, "--normalize");
  const buildId = normalizeFlag.rest[0];

  if (!buildId) { writeError(flags, "usage: edit <buildId> [--op <json>] [--apply]"); return EXIT_USAGE_ERROR; }

  const build = await readBuild(buildId);
  let ops: EditOp[];
  try {
    ops = opsOpt.values.map(v => JSON.parse(v) as EditOp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeError(flags, `Invalid --op JSON: ${msg}`);
    return EXIT_USAGE_ERROR;
  }
  if (normalizeFlag.present) ops.push({ type: "normalize_indices" });

  try {
    const updated = applyOps(build, ops);
    const bom = await readBom(updated.itemId);
    const validation = validateBuild(updated, { bom });

    if (!applyFlag.present) {
      if (flags.json) writeJson({ ok: true, dryRun: true, build: updated, validation });
      else writeHuman(["Dry run successful. Use --apply to commit.", `Valid: ${validation.valid}`, `Errors: ${validation.hardErrors.length}`]);
      return EXIT_SUCCESS;
    }

    // Policy:
    // - Draft edits may be invalid (save anyway; validation output will guide next steps).
    // - If the edit results in status=published, block unless valid.
    if (updated.status === "published" && !validation.valid) {
      writeError(flags, `Publish blocked after edit: ${validation.hardErrors[0]?.message}`);
      return EXIT_VALIDATION_FAILED;
    }

    const path = await writeBuild(updated);
    await writeValidationOutput(updated, validation);
    if (flags.json) writeJson({ ok: true, buildId: updated.id, path });
    else writeHuman([`Updated ${updated.id} at ${path}`]);
    return EXIT_SUCCESS;
  } catch (err) {
    writeError(flags, `Edit failed: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_USAGE_ERROR;
  }
}

async function cmdValidate(flags: GlobalFlags, argv: string[]): Promise<number> {
  const stdinFlag = hasFlag(argv, "--stdin");
  const gapsFlag = hasFlag(stdinFlag.rest, "--gaps");
  const buildId = gapsFlag.rest[0];

  let build: BenchTopLineBuild;
  if (stdinFlag.present) build = parseBuild(JSON.parse(await readStdin()));
  else if (buildId) build = await readBuild(buildId);
  else { writeError(flags, "usage: validate <buildId> [--stdin] [--gaps]"); return EXIT_USAGE_ERROR; }

  const bom = await readBom(build.itemId);
  const validation = validateBuild(build, { bom });
  await writeValidationOutput(build, validation);

  if (gapsFlag.present) {
    const gaps = buildGapsFromValidation(build, validation);
    if (flags.json) writeJson({ ok: true, gaps });
    else writeHuman(gaps.map(g => `[${g.ruleId}] ${g.message}`));
  } else {
    if (flags.json) writeJson({ ok: true, validation });
    else writeHuman([`Valid: ${validation.valid}`, `Errors: ${validation.hardErrors.length}`, `Warnings: ${validation.warnings.length}`]);
  }
  return validation.valid ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
}

async function cmdSearch(flags: GlobalFlags, argv: string[]): Promise<number> {
  const whereOpt = takeOption(argv, "--where");
  const notesOpt = takeOption(whereOpt.rest, "--notes");
  const builds = await loadAllBuilds();

  if (whereOpt.value) {
    const { matches } = runQuery({ builds, where: whereOpt.value });
    if (flags.json) writeJson({ ok: true, matches });
    else writeHuman(matches.map(m => `${m.buildId} :: step=${m.stepId} :: ${m.label}`));
  } else if (notesOpt.value) {
    const result = searchNotes({ builds, pattern: notesOpt.value });
    if (flags.json) writeJson({ ok: true, ...result });
    else writeHuman(result.matches.map(m => `${m.buildId} :: step=${m.stepId} :: ${m.matchText}`));
  } else {
    writeError(flags, "usage: search [--where <dsl>] [--notes <regex>]");
    return EXIT_USAGE_ERROR;
  }
  return EXIT_SUCCESS;
}

async function main(argv: string[]): Promise<number> {
  const { flags, rest } = parseGlobalFlags(argv);
  const [cmd, ...args] = rest;
  if (!cmd || cmd === "--help" || cmd === "-h") { printHelp(); return EXIT_SUCCESS; }

  switch (cmd) {
    case "list": return await cmdList(flags, args);
    case "get": return await cmdGet(flags, args);
    case "write": return await cmdWrite(flags, args);
    case "edit": return await cmdEdit(flags, args);
    case "validate": return await cmdValidate(flags, args);
    case "search": return await cmdSearch(flags, args);
    case "view": {
      const bid = args[0];
      if (!bid) return EXIT_USAGE_ERROR;
      const ctrl = { buildId: bid, requestId: randomUUID(), timestamp: new Date().toISOString() };
      await fs.mkdir(`${DATA_ROOT_ABS}/viewer`, { recursive: true });
      await fs.writeFile(`${DATA_ROOT_ABS}/viewer/selection.json`, JSON.stringify(ctrl));
      return EXIT_SUCCESS;
    }
    case "rules": {
      const rid = args[0];
      if (rid) {
        const rule = getRuleById(rid);
        if (rule) writeHuman([`${rule.id}: ${rule.description}`, `Scope: ${rule.scope}`]);
        return EXIT_SUCCESS;
      }
      writeHuman(["Rules:", ...VALIDATION_RULES.map(r => `  ${r.id}: ${r.description}`)]);
      return EXIT_SUCCESS;
    }
    case "validate-fixtures": {
      const res = await validateFixtures();
      if (flags.json) writeJson(res);
      else writeHuman([`Fixtures: ${res.fixtureCount}, Passed: ${res.passed}, Failed: ${res.failed}`]);
      return res.ok ? EXIT_SUCCESS : EXIT_VALIDATION_FAILED;
    }
    default: writeError(flags, `Unknown command: ${cmd}`); return EXIT_USAGE_ERROR;
  }
}

main(process.argv.slice(2)).then(code => process.exitCode = code);
