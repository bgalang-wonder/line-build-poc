import * as path from "node:path";

import type { BenchTopLineBuild } from "./schema";
import type { BuildValidationResult, ValidationError } from "./validate";
import { VALIDATION_DIR_ABS, atomicWriteJsonFile } from "./store";

/**
 * Validation output writer.
 *
 * Source of truth:
 * - docs/handoff/POC_TASKS.json -> shared_conventions.validation_output_contract
 *
 * Writes:
 * - poc/line-build-cli/data/validation/<buildId>.latest.json
 */

export type ValidationOutput = {
  buildId: string;
  itemId: string;
  timestamp: string; // ISO-8601
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
  metrics?: Record<string, unknown>;
};

function validationFilePathAbs(buildId: string): string {
  return path.join(VALIDATION_DIR_ABS, `${buildId}.latest.json`);
}

export function buildValidationOutput(
  build: BenchTopLineBuild,
  result: BuildValidationResult,
  timestamp: string = new Date().toISOString(),
): ValidationOutput {
  return {
    buildId: build.id,
    itemId: build.itemId,
    timestamp,
    valid: result.valid,
    hardErrors: result.hardErrors,
    warnings: result.warnings,
    metrics: result.metrics,
  };
}

export async function writeValidationOutput(
  build: BenchTopLineBuild,
  result: BuildValidationResult,
  timestamp?: string,
): Promise<{ output: ValidationOutput; filePathAbs: string }> {
  const output = buildValidationOutput(build, result, timestamp);
  const filePathAbs = validationFilePathAbs(build.id);
  await atomicWriteJsonFile(filePathAbs, output);
  return { output, filePathAbs };
}

