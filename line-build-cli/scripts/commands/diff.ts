import { readBuild, BUILDS_DIR_ABS } from "../lib/store";
import { normalizeBuild } from "../lib/normalize";
import type { GlobalFlags } from "../lb";
import type { BenchTopLineBuild } from "../lib/schema";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const EXIT_SUCCESS = 0;
const EXIT_USAGE_ERROR = 3;
const EXIT_DIFF_FOUND = 1;

function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
function writeError(flags: GlobalFlags, message: string) {
  if (flags.json) writeJson({ ok: false, error: { message } });
  else process.stderr.write(message + "\n");
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

type JsonPatch = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
  oldValue?: unknown;
};

function computePatches(
  source: unknown,
  target: unknown,
  currentPath: string = ""
): JsonPatch[] {
  const patches: JsonPatch[] = [];

  if (source === target) return patches;

  if (typeof source !== typeof target) {
    patches.push({ op: "replace", path: currentPath || "/", value: target, oldValue: source });
    return patches;
  }

  if (source === null || target === null) {
    if (source !== target) {
      patches.push({ op: "replace", path: currentPath || "/", value: target, oldValue: source });
    }
    return patches;
  }

  if (Array.isArray(source) && Array.isArray(target)) {
    const maxLen = Math.max(source.length, target.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${currentPath}/${i}`;
      if (i >= source.length) {
        patches.push({ op: "add", path: itemPath, value: target[i] });
      } else if (i >= target.length) {
        patches.push({ op: "remove", path: itemPath, oldValue: source[i] });
      } else {
        patches.push(...computePatches(source[i], target[i], itemPath));
      }
    }
    return patches;
  }

  if (typeof source === "object" && typeof target === "object") {
    const sourceObj = source as Record<string, unknown>;
    const targetObj = target as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(sourceObj), ...Object.keys(targetObj)]);

    for (const key of allKeys) {
      const keyPath = `${currentPath}/${key}`;
      if (!(key in sourceObj)) {
        patches.push({ op: "add", path: keyPath, value: targetObj[key] });
      } else if (!(key in targetObj)) {
        patches.push({ op: "remove", path: keyPath, oldValue: sourceObj[key] });
      } else {
        patches.push(...computePatches(sourceObj[key], targetObj[key], keyPath));
      }
    }
    return patches;
  }

  if (source !== target) {
    patches.push({ op: "replace", path: currentPath || "/", value: target, oldValue: source });
  }

  return patches;
}

function formatUnifiedDiff(patches: JsonPatch[], sourceLabel: string, targetLabel: string): string[] {
  const lines: string[] = [
    `--- ${sourceLabel}`,
    `+++ ${targetLabel}`,
  ];

  for (const patch of patches.slice(0, 50)) {
    switch (patch.op) {
      case "add":
        lines.push(`+ ${patch.path}: ${JSON.stringify(patch.value)}`);
        break;
      case "remove":
        lines.push(`- ${patch.path}: ${JSON.stringify(patch.oldValue)}`);
        break;
      case "replace":
        lines.push(`- ${patch.path}: ${JSON.stringify(patch.oldValue)}`);
        lines.push(`+ ${patch.path}: ${JSON.stringify(patch.value)}`);
        break;
    }
  }

  if (patches.length > 50) {
    lines.push(`... and ${patches.length - 50} more changes`);
  }

  return lines;
}

async function loadBuildOrFile(ref: string): Promise<{ build: BenchTopLineBuild; label: string }> {
  if (ref.endsWith(".json")) {
    const content = await fs.readFile(ref, "utf8");
    return { build: JSON.parse(content), label: ref };
  }
  const build = await readBuild(ref);
  return { build, label: `${ref}.json` };
}

export async function cmdDiff(flags: GlobalFlags, argv: string[]): Promise<number> {
  const againstOpt = takeOption(argv, "--against");
  const formatOpt = takeOption(againstOpt.rest, "--format");
  const buildId = formatOpt.rest[0];

  if (!buildId) {
    writeError(flags, "usage: validate diff <buildId> --against <buildId|file|normalized>");
    return EXIT_USAGE_ERROR;
  }

  const against = againstOpt.value;
  if (!against) {
    writeError(flags, "usage: validate diff <buildId> --against <buildId|file|normalized>");
    return EXIT_USAGE_ERROR;
  }

  const format = formatOpt.value || (flags.json ? "json" : "unified");

  let source: BenchTopLineBuild;
  let target: BenchTopLineBuild;
  let sourceLabel: string;
  let targetLabel: string;

  try {
    const sourceResult = await loadBuildOrFile(buildId);
    source = sourceResult.build;
    sourceLabel = sourceResult.label;
  } catch (err) {
    writeError(flags, `Failed to load source build: ${(err as Error).message}`);
    return EXIT_USAGE_ERROR;
  }

  try {
    if (against === "normalized") {
      target = normalizeBuild(source);
      targetLabel = `${buildId} (normalized)`;
    } else {
      const targetResult = await loadBuildOrFile(against);
      target = targetResult.build;
      targetLabel = targetResult.label;
    }
  } catch (err) {
    writeError(flags, `Failed to load target: ${(err as Error).message}`);
    return EXIT_USAGE_ERROR;
  }

  const patches = computePatches(source, target);

  if (patches.length === 0) {
    if (flags.json || format === "json") {
      writeJson({ ok: true, sourceId: buildId, targetId: against, patches: [], identical: true });
    } else {
      writeHuman(["No differences found."]);
    }
    return EXIT_SUCCESS;
  }

  if (flags.json || format === "json") {
    writeJson({
      ok: true,
      sourceId: buildId,
      targetId: against,
      patchCount: patches.length,
      patches,
    });
  } else {
    const diffLines = formatUnifiedDiff(patches, sourceLabel, targetLabel);
    writeHuman(diffLines);
  }

  return EXIT_DIFF_FOUND;
}
