/**
 * Line Build PoC CLI
 *
 * Usage:
 *   npx tsx scripts/lb.ts <command> [options]
 */

import { validateFixtures } from "./lib/fixtures";

import { cmdList } from "./commands/list";
import { cmdGet } from "./commands/get";
import { cmdWrite } from "./commands/write";
import { cmdEdit } from "./commands/edit";
import { cmdValidate } from "./commands/validate";
import { cmdSearch } from "./commands/search";
import { cmdView } from "./commands/view";
import { cmdRules } from "./commands/rules";
import { cmdWatch } from "./commands/watch";
import { cmdDiff } from "./commands/diff";
import { cmdHelp } from "./commands/help";
import { cmdTechniques } from "./commands/techniques";
import { cmdScore } from "./commands/score";
import { cmdScorePortfolio } from "./commands/score-portfolio";
import { cmdScorePreview } from "./commands/score-preview";

const EXIT_SUCCESS = 0;
const EXIT_VALIDATION_FAILED = 2;
const EXIT_USAGE_ERROR = 3;

export type GlobalFlags = { json: boolean };

function printHelp(): void {
  process.stdout.write(
    [
      "Line Build CLI",
      "",
      "Commands:",
      "  validate   Validation and diagnostics (batch, watch, diff, suggest)",
      "  edit       Incremental build mutations",
      "  view       Control the viewer (jump to build/step)",
      "  list       Discover builds",
      "  get        Read build details",
      "  write      Create or replace a build",
      "  search     Search steps across builds",
      "  rules      Validation rules reference",
      "  techniques Technique vocabulary reference",
      "  score      Score a build's complexity",
      "  score-portfolio  Score all builds and show ranking",
      "  score-preview    Preview weight impact on portfolio scores",
      "  help       Show detailed help for a command",
      "",
      "Usage: lb <command> [options]",
      "",
      "For command-specific help: lb help <command>",
      "",
      "Global options:",
      "  --json     Machine-readable JSON output",
      "  --help     Show this help",
      "",
    ].join("\n"),
  );
}

function parseGlobalFlags(argv: string[]): { flags: GlobalFlags; rest: string[] } {
  let json = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === "--json") { json = true; continue; }
    rest.push(a);
  }
  return { flags: { json }, rest };
}

export function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
export function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
function writeError(flags: GlobalFlags, message: string) {
  if (flags.json) writeJson({ ok: false, error: { message } });
  else process.stderr.write(message + "\n");
}

async function handleValidate(flags: GlobalFlags, args: string[]): Promise<number> {
  const subcommand = args[0];
  
  if (subcommand === "watch") {
    return await cmdWatch(args.slice(1));
  }
  
  if (subcommand === "diff") {
    return await cmdDiff(flags, args.slice(1));
  }
  
  return await cmdValidate(flags, args);
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
    case "validate": return await handleValidate(flags, args);
    case "search": return await cmdSearch(flags, args);
    case "view": return await cmdView(args);
    case "rules": return await cmdRules(args);
    case "techniques": return await cmdTechniques(flags, args);
    case "watch": return await cmdWatch(args);
    case "help": return await cmdHelp(flags, args);
    case "score": return await cmdScore(flags, args);
    case "score-portfolio": return await cmdScorePortfolio(flags, args);
    case "score-preview": return await cmdScorePreview(flags, args);
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
