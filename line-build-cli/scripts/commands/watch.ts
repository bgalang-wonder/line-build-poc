import * as fs from "node:fs";
import * as path from "node:path";
import { BUILDS_DIR_ABS, DATA_ROOT_ABS, readBuild, readBom } from "../lib/store";
import { validateBuild } from "../lib/validate";
import { writeValidationOutput } from "../lib/validationOutput";
import { randomUUID } from "node:crypto";
import * as fsPromises from "node:fs/promises";
import { getFixHint } from "../lib/fixHints";

const EXIT_SUCCESS = 0;

type WatchFlags = {
  log?: string;
  once: boolean;
  quiet: boolean;
};

type WatchEvent = {
  type: "build_validation";
  buildId: string;
  itemId: string;
  name?: string;
  timestamp: string;
  valid: boolean;
  hardErrorCount: number;
  warningCount: number;
  topErrors: Array<{
    ruleId: string;
    stepId?: string;
    message: string;
    fixHint?: string;
  }>;
};

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function colorize(text: string, code: number): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}

const green = (t: string) => colorize(t, 32);
const red = (t: string) => colorize(t, 31);
const yellow = (t: string) => colorize(t, 33);
const dim = (t: string) => colorize(t, 2);

async function jumpViewer(buildId: string): Promise<void> {
  const ctrl = { buildId, requestId: randomUUID(), timestamp: new Date().toISOString() };
  await fsPromises.mkdir(`${DATA_ROOT_ABS}/viewer`, { recursive: true });
  await fsPromises.writeFile(`${DATA_ROOT_ABS}/viewer/selection.json`, JSON.stringify(ctrl));
}

async function appendJsonl(filePath: string, event: WatchEvent): Promise<void> {
  await fsPromises.appendFile(filePath, JSON.stringify(event) + "\n");
}

async function validateAndReport(
  buildId: string,
  flags: WatchFlags,
  logStream?: fsPromises.FileHandle
): Promise<void> {
  try {
    const build = await readBuild(buildId);
    const bom = await readBom(build.itemId);
    const validation = validateBuild(build, { bom });
    await writeValidationOutput(build, validation);

    const event: WatchEvent = {
      type: "build_validation",
      buildId: build.id,
      itemId: build.itemId,
      name: build.name,
      timestamp: new Date().toISOString(),
      valid: validation.valid,
      hardErrorCount: validation.hardErrors.length,
      warningCount: validation.warnings.length,
      topErrors: validation.hardErrors.slice(0, 5).map(err => ({
        ruleId: err.ruleId,
        stepId: err.stepId,
        message: err.message,
        fixHint: getFixHint(err.ruleId) ?? undefined,
      })),
    };

    if (flags.log) {
      await appendJsonl(flags.log, event);
    }

    if (!flags.quiet) {
      const time = dim(`[${formatTime()}]`);
      const name = build.name || build.itemId || buildId;

      if (validation.valid) {
        console.log(`${time} ${green("VALID")} ${name}`);
      } else {
        const errCount = validation.hardErrors.length;
        const warnCount = validation.warnings.length;
        console.log(`${time} ${red("INVALID")} ${name} - ${red(`${errCount} error(s)`)}${warnCount > 0 ? `, ${yellow(`${warnCount} warning(s)`)}` : ""}`);
        
        const topErrors = validation.hardErrors.slice(0, 3);
        for (const err of topErrors) {
          const hint = getFixHint(err.ruleId);
          const stepRef = err.stepId ? ` (${err.stepId})` : "";
          console.log(`  ${red(">")} [${err.ruleId}]${stepRef} ${err.message}${hint ? dim(` -> ${hint}`) : ""}`);
        }
        if (validation.hardErrors.length > 3) {
          console.log(dim(`  ... and ${validation.hardErrors.length - 3} more`));
        }
      }
    }

    await jumpViewer(buildId);
  } catch (err) {
    if (!flags.quiet) {
      const time = dim(`[${formatTime()}]`);
      console.log(`${time} ${red("ERROR")} ${buildId}: ${(err as Error).message}`);
    }
  }
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

export async function cmdWatch(argv: string[]): Promise<number> {
  const logOpt = takeOption(argv, "--log");
  const onceFlag = hasFlag(logOpt.rest, "--once");
  const quietFlag = hasFlag(onceFlag.rest, "--quiet");

  const flags: WatchFlags = {
    log: logOpt.value,
    once: onceFlag.present,
    quiet: quietFlag.present,
  };

  if (!flags.quiet) {
    if (flags.once) {
      console.log(dim(`Validating all builds in ${BUILDS_DIR_ABS}...`));
    } else {
      console.log(dim(`Watching ${BUILDS_DIR_ABS} for changes...`));
      console.log(dim("Press Ctrl+C to stop.\n"));
    }
  }

  const lastMtimes = new Map<string, number>();

  try {
    const entries = await fsPromises.readdir(BUILDS_DIR_ABS, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const buildId = entry.name.slice(0, -".json".length);
        const stat = await fsPromises.stat(path.join(BUILDS_DIR_ABS, entry.name));
        lastMtimes.set(buildId, stat.mtimeMs);
        await validateAndReport(buildId, flags);
      }
    }
  } catch (err) {
    if ((err as { code?: string }).code !== "ENOENT") {
      console.error(`Error reading builds directory: ${(err as Error).message}`);
    }
  }

  if (flags.once) {
    return EXIT_SUCCESS;
  }

  if (!flags.quiet) {
    console.log(dim("\n--- Watching for changes ---\n"));
  }

  const watcher = fs.watch(BUILDS_DIR_ABS, { persistent: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith(".json")) return;

    const buildId = filename.slice(0, -".json".length);
    const filePath = path.join(BUILDS_DIR_ABS, filename);

    try {
      const stat = await fsPromises.stat(filePath);
      const prevMtime = lastMtimes.get(buildId) ?? 0;
      if (stat.mtimeMs <= prevMtime) return;
      lastMtimes.set(buildId, stat.mtimeMs);
    } catch {
      lastMtimes.delete(buildId);
      return;
    }

    await new Promise((r) => setTimeout(r, 100));

    await validateAndReport(buildId, flags);
  });

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      watcher.close();
      if (!flags.quiet) {
        console.log(dim("\nStopped watching."));
      }
      resolve();
    });
  });

  return EXIT_SUCCESS;
}
