import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parseBuild, type BenchTopLineBuild, type BuildParseIssue } from "./schema";
import { validateBuild, type BuildValidationResult } from "./validate";
import { DATA_ROOT_ABS } from "./store";

export const FIXTURES_DIR_ABS = path.join(DATA_ROOT_ABS, "fixtures");

export type FixtureExpectation = {
  expectedValid: boolean;
  /**
   * If provided, all of these ruleIds must appear in hardErrors.
   * (Used for fixtures that are expected to fail for a specific invariant.)
   */
  mustHaveHardRuleIds?: string[];
};

export type FixtureValidationRow = {
  fileName: string;
  filePathAbs: string;
  buildId?: string;
  itemId?: string;
  expected?: FixtureExpectation;
  parseOk: boolean;
  validation?: BuildValidationResult;
  ok: boolean;
  notes?: string;
  parseIssues?: BuildParseIssue[];
};

const EXPECTATIONS: Record<string, FixtureExpectation> = {
  // Valid builds
  "simple-linear.json": { expectedValid: true },
  "parallel-join.json": { expectedValid: true },
  "external-consume.json": { expectedValid: true },

  // Structural errors
  "cycle-error.json": { expectedValid: false, mustHaveHardRuleIds: ["H9"] },

  // Common interview failure modes (authoring gaps)
  "heat-missing-equipment.json": { expectedValid: false, mustHaveHardRuleIds: ["H15"] },
  "heat-missing-time-notes.json": { expectedValid: false, mustHaveHardRuleIds: ["H22"] },
  "portion-missing-quantity-notes.json": { expectedValid: false, mustHaveHardRuleIds: ["H24"] },
  "prep-missing-technique-notes.json": { expectedValid: false, mustHaveHardRuleIds: ["H25"] },
  "quantity-value-zero.json": { expectedValid: false, mustHaveHardRuleIds: ["H10"] },
  "container-in-target-name.json": { expectedValid: false, mustHaveHardRuleIds: ["H4"] },
};

async function listFixtureFiles(): Promise<Array<{ fileName: string; filePathAbs: string }>> {
  const entries = await fs.readdir(FIXTURES_DIR_ABS, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => ({ fileName: e.name, filePathAbs: path.join(FIXTURES_DIR_ABS, e.name) }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function includesAll(haystack: string[], needles: string[]): boolean {
  const set = new Set(haystack);
  return needles.every((n) => set.has(n));
}

export async function validateFixtures(): Promise<{
  ok: boolean;
  fixtureCount: number;
  passed: number;
  failed: number;
  rows: FixtureValidationRow[];
}> {
  const fixtures = await listFixtureFiles();

  const rows: FixtureValidationRow[] = [];
  for (const f of fixtures) {
    const expected = EXPECTATIONS[f.fileName];
    if (!expected) {
      rows.push({
        fileName: f.fileName,
        filePathAbs: f.filePathAbs,
        expected: undefined,
        parseOk: false,
        ok: false,
        notes: "No expectation registered for this fixture filename (update EXPECTATIONS).",
      });
      continue;
    }

    let raw: string;
    try {
      raw = await fs.readFile(f.filePathAbs, { encoding: "utf8" });
    } catch (err) {
      rows.push({
        fileName: f.fileName,
        filePathAbs: f.filePathAbs,
        expected,
        parseOk: false,
        ok: false,
        notes: `Failed to read fixture: ${(err as { message?: string }).message ?? String(err)}`,
      });
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch (err) {
      rows.push({
        fileName: f.fileName,
        filePathAbs: f.filePathAbs,
        expected,
        parseOk: false,
        ok: false,
        notes: `Invalid JSON: ${(err as { message?: string }).message ?? String(err)}`,
      });
      continue;
    }

    let build: BenchTopLineBuild;
    try {
      build = parseBuild(json);
    } catch (err) {
      const e = err as { issues?: BuildParseIssue[]; message?: string };
      rows.push({
        fileName: f.fileName,
        filePathAbs: f.filePathAbs,
        expected,
        parseOk: false,
        ok: false,
        notes: e.message ?? "Build JSON failed schema validation",
        parseIssues: Array.isArray(e.issues) ? e.issues : undefined,
      });
      continue;
    }

    const validation = validateBuild(build);
    const hardRuleIds = validation.hardErrors.map((e) => e.ruleId);
    const mustHave = expected.mustHaveHardRuleIds ?? [];

    const expectationMatch =
      validation.valid === expected.expectedValid &&
      (mustHave.length === 0 || includesAll(hardRuleIds, mustHave));

    rows.push({
      fileName: f.fileName,
      filePathAbs: f.filePathAbs,
      buildId: build.id,
      itemId: build.itemId,
      expected,
      parseOk: true,
      validation,
      ok: expectationMatch,
      notes: expectationMatch
        ? undefined
        : `Expected valid=${String(expected.expectedValid)}${
            mustHave.length > 0 ? ` and must include hard rule(s): ${mustHave.join(", ")}` : ""
          }`,
    });
  }

  const passed = rows.filter((r) => r.ok).length;
  const failed = rows.length - passed;
  return {
    ok: failed === 0,
    fixtureCount: rows.length,
    passed,
    failed,
    rows,
  };
}

