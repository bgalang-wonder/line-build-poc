import { randomUUID } from "node:crypto";
import * as path from "node:path";

import { RECEIPTS_DIR_ABS, atomicWriteJsonFile } from "./store";

/**
 * Receipt writer for write/apply commands.
 *
 * Path source of truth:
 * - docs/handoff/POC_TASKS.json -> shared_conventions.paths.receipts
 *
 * File naming convention (per docs/handoff/POC-CLI-VIEWER-IMPLEMENTATION-PLAN.md):
 * - data/receipts/<timestamp>-<command>.json
 */

export type Receipt = {
  id: string;
  command: string;
  timestamp: string; // ISO-8601
  inputs?: unknown;
  outputs?: unknown;
  touchedFiles?: string[];
};

function fileSafeTimestamp(iso: string): string {
  // Example: 2026-01-10T05-12-34.567Z
  return iso.replace(/:/g, "-");
}

function sanitizeCommand(command: string): string {
  const s = command.trim().toLowerCase();
  const cleaned = s.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-");
  return cleaned.length > 0 ? cleaned : "command";
}

export async function writeReceipt(input: {
  command: string;
  timestamp?: string;
  inputs?: unknown;
  outputs?: unknown;
  touchedFiles?: string[];
}): Promise<{ receipt: Receipt; filePathAbs: string }> {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const receipt: Receipt = {
    id: randomUUID(),
    command: input.command,
    timestamp,
    inputs: input.inputs,
    outputs: input.outputs,
    touchedFiles: input.touchedFiles,
  };

  const fileName = `${fileSafeTimestamp(timestamp)}-${sanitizeCommand(input.command)}-${receipt.id}.json`;
  const filePathAbs = path.join(RECEIPTS_DIR_ABS, fileName);

  await atomicWriteJsonFile(filePathAbs, receipt);

  return { receipt, filePathAbs };
}

