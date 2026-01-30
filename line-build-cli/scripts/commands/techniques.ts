import type { GlobalFlags } from "../lb";
import { ActionFamily } from "../lib/schema";
import { getTechniquesForActionFamily } from "../../config";

const EXIT_SUCCESS = 0;
const EXIT_USAGE_ERROR = 3;

function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }

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

function normalizeFamily(input?: string): ActionFamily | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toUpperCase();
  return (Object.values(ActionFamily) as string[]).includes(normalized)
    ? (normalized as ActionFamily)
    : undefined;
}

function formatTechniqueLine(t: {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  typicalTools?: string[];
}): string {
  const extras: string[] = [];
  if (t.aliases?.length) extras.push(`aliases: ${t.aliases.join(", ")}`);
  if (t.typicalTools?.length) extras.push(`tools: ${t.typicalTools.join(", ")}`);
  if (t.description) extras.push(t.description);
  const suffix = extras.length ? ` (${extras.join(" • ")})` : "";
  return `  ${t.id} — ${t.label}${suffix}`;
}

export async function cmdTechniques(flags: GlobalFlags, argv: string[]): Promise<number> {
  const familyOpt = takeOption(argv, "--family");
  const family = normalizeFamily(familyOpt.value);

  if (familyOpt.value && !family) {
    const allowed = Object.values(ActionFamily).join(", ");
    writeHuman([`Unknown family: ${familyOpt.value}`, `Valid families: ${allowed}`]);
    return EXIT_USAGE_ERROR;
  }

  if (flags.json) {
    if (family) {
      writeJson({
        ok: true,
        family,
        techniques: getTechniquesForActionFamily(family),
      });
      return EXIT_SUCCESS;
    }
    const grouped: Record<string, unknown> = {};
    for (const fam of Object.values(ActionFamily)) {
      grouped[fam] = getTechniquesForActionFamily(fam as ActionFamily);
    }
    writeJson({ ok: true, techniques: grouped });
    return EXIT_SUCCESS;
  }

  if (family) {
    const lines = [`Techniques for ${family}:`];
    const techs = getTechniquesForActionFamily(family);
    for (const t of techs) lines.push(formatTechniqueLine(t));
    writeHuman(lines);
    return EXIT_SUCCESS;
  }

  const lines: string[] = [];
  for (const fam of Object.values(ActionFamily)) {
    lines.push(`${fam}:`);
    const techs = getTechniquesForActionFamily(fam as ActionFamily);
    for (const t of techs) lines.push(formatTechniqueLine(t));
    lines.push("");
  }
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  writeHuman(lines);
  return EXIT_SUCCESS;
}
