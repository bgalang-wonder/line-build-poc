import { readBom, writeBuild } from "../lib/store";
import { validateBuild } from "../lib/validate";
import { writeReceipt } from "../lib/receipts";
import { writeValidationOutput } from "../lib/validationOutput";
import { parseBuild, BuildParseError } from "../lib/schema";
import type { GlobalFlags } from "../lb";
import * as fs from "node:fs/promises";

const EXIT_SUCCESS = 0;
const EXIT_VALIDATION_FAILED = 2;
const EXIT_USAGE_ERROR = 3;

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

export async function cmdWrite(flags: GlobalFlags, argv: string[]): Promise<number> {
  const fileOpt = takeOption(argv, "--file");
  const stdinFlag = hasFlag(fileOpt.rest, "--stdin");
  let raw: string;
  if (fileOpt.value) raw = await fs.readFile(fileOpt.value, "utf8");
  else raw = await readStdin();

  let build: any;
  try {
    build = parseBuild(JSON.parse(raw));
  } catch (err) {
    if (err instanceof BuildParseError) {
      // Format detailed schema validation errors
      const issueLines = err.issues.map(
        (i) => `  - ${i.path}: ${i.message} (code: ${i.code})`
      );
      
      // Build context-sensitive hints based on which fields failed
      const hints: string[] = [];
      for (const issue of err.issues) {
        if (issue.path.includes("customizationGroups") && issue.path.includes("type")) {
          hints.push("Valid customizationGroups.type values: MANDATORY_CHOICE, OPTIONAL_ADDITION, OPTIONAL_SUBTRACTION, EXTRA_REQUESTS, DISH_PREFERENCE, ON_THE_SIDE");
        }
        if (issue.path.includes("action") && issue.path.includes("family")) {
          hints.push("Valid action.family values: PREP, HEAT, TRANSFER, COMBINE, ASSEMBLE, PORTION, CHECK, PACKAGING, OTHER");
        }
        if (issue.path.includes("stationId")) {
          hints.push("Valid stationId values: fryer, waterbath, turbo, toaster, salamander, clamshell_grill, press, induction, conveyor, hot_box, hot_well, rice_cooker, pasta_cooker, pizza_oven, pizza_conveyor_oven, steam_well, sauce_warmer, garnish, speed_line, expo, prep, pass, vending, other");
        }
        if (issue.path.includes("toolId")) {
          hints.push("Valid toolId values: hand, tongs, mini_tong, paddle, spatula, spoon, spoodle_1oz, spoodle_2oz, spoodle_3oz, fry_basket, squeeze_bottle, shaker, viper, scale, bench_scraper, utility_knife, whisk, ladle, other");
        }
        if (issue.path.includes("cookingPhase")) {
          hints.push("Valid cookingPhase values: PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS");
        }
        if (issue.path.includes("applianceId")) {
          hints.push("Valid equipment.applianceId values: turbo, fryer, waterbath, toaster, salamander, clamshell_grill, press, induction, conveyor, hot_box, hot_well, rice_cooker, pasta_cooker, pizza_oven, pizza_conveyor_oven, steam_well, sauce_warmer, other");
        }
      }
      
      const uniqueHints = [...new Set(hints)];
      const hintSection = uniqueHints.length > 0 ? "\n\n" + uniqueHints.join("\n") : "";
      
      writeError(flags, `Schema validation failed:\n${issueLines.join("\n")}${hintSection}`);
      return EXIT_USAGE_ERROR;
    }
    const msg = err instanceof Error ? err.message : String(err);
    writeError(flags, `Invalid JSON input: ${msg}`);
    return EXIT_USAGE_ERROR;
  }
  const bom = await readBom(build.itemId);
  const validation = validateBuild(build, { bom });

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
