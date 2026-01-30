import type { GlobalFlags } from "../lb";

const EXIT_SUCCESS = 0;

function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }

const COMMAND_HELP: Record<string, string[]> = {
  validate: [
    "lb validate - Validation and diagnostics",
    "",
    "Usage:",
    "  lb validate <buildId> [flags]     Validate a single build",
    "  lb validate --all [flags]         Validate all builds",
    "  lb validate --changed <min>       Validate recently modified builds",
    "  lb validate watch [flags]         Watch for changes and auto-validate",
    "  lb validate diff <id> --against   Compare builds",
    "",
    "Flags:",
    "  --ops           Include candidate EditOps for auto-fixable rules",
    "  --summary       Show aggregate stats only (for batch modes)",
    "  --gaps          Show validation gaps (structural issues)",
    "  --item <id>     Filter to specific itemId",
    "  --json          Machine-readable JSON output",
    "",
    "Watch subcommand:",
    "  lb validate watch [--log <path>] [--once] [--quiet]",
    "",
    "  --log <path>    Write JSONL events to file for agent consumption",
    "  --once          Validate all builds once and exit (no file watching)",
    "  --quiet         Suppress human-readable output",
    "",
    "Diff subcommand:",
    "  lb validate diff <buildId> --against <target>",
    "",
    "  --against <id>        Compare against another buildId",
    "  --against <file>      Compare against a JSON file",
    "  --against normalized  Compare against normalized version of same build",
    "  --format json|unified Output format (default: unified for TTY, json otherwise)",
    "",
    "Examples:",
    "  lb validate my-build-id",
    "  lb validate my-build-id --ops",
    "  lb validate --all --summary",
    "  lb validate --changed 15",
    "  lb validate watch --log /tmp/lb.jsonl",
    "  lb validate diff my-build --against normalized",
  ],

  edit: [
    "lb edit - Incremental build mutations",
    "",
    "Usage:",
    "  lb edit <buildId> [--op <json>]... [--apply] [--normalize]",
    "",
    "Flags:",
    "  --op <json>     Edit operation (can be repeated)",
    "  --apply         Commit changes (default is dry-run)",
    "  --normalize     Normalize orderIndex values",
    "",
    "Edit Operations:",
    '  {"type":"set_field","where":"<dsl>","field":"<path>","value":<val>}',
    '  {"type":"add_step","step":{...},"afterStepId":"<id>"}',
    '  {"type":"remove_step","stepId":"<id>"}',
    '  {"type":"add_dep","stepId":"<id>","dependsOn":"<id>"}',
    '  {"type":"remove_dep","stepId":"<id>","dependsOn":"<id>"}',
    '  {"type":"set_build_field","field":"<path>","value":<val>}',
    "",
    "Examples:",
    "  lb edit my-build --op '{\"type\":\"set_field\",\"where\":\"step.action.family=HEAT\",\"field\":\"step.stationId\",\"value\":\"grill\"}' --apply",
  ],

  view: [
    "lb view - Control the viewer",
    "",
    "Usage:",
    "  lb view <buildId> [--step <stepId>]",
    "",
    "Flags:",
    "  --step <id>     Also select this step in the viewer",
    "",
    "Examples:",
    "  lb view my-build-id",
    "  lb view my-build-id --step step-5",
  ],

  list: [
    "lb list - Discover builds",
    "",
    "Usage:",
    "  lb list [--query <q>] [--item <itemId>]",
    "",
    "Flags:",
    "  --query <q>     Filter by name or itemId",
    "  --item <id>     Filter to specific itemId",
    "  --json          Machine-readable JSON output",
  ],

  get: [
    "lb get - Read build details",
    "",
    "Usage:",
    "  lb get <buildId> [--format full|summary|steps|gaps]",
    "",
    "Flags:",
    "  --format <f>    Output format (default: full)",
    "  --json          Machine-readable JSON output",
  ],

  write: [
    "lb write - Create or replace a build",
    "",
    "Usage:",
    "  lb write [--stdin | --file <path>]",
    "",
    "Flags:",
    "  --stdin         Read JSON from stdin",
    "  --file <path>   Read JSON from file",
    "  --json          Machine-readable JSON output",
  ],

  search: [
    "lb search - Search steps across builds",
    "",
    "Usage:",
    "  lb search [--where <dsl>] [--notes <regex>]",
    "",
    "Flags:",
    "  --where <dsl>   Query DSL filter",
    "  --notes <regex> Search step notes",
    "  --json          Machine-readable JSON output",
    "",
    "Query DSL:",
    "  field = value             Equality",
    "  field != value            Inequality",
    "  field in [val1, val2]     Set membership",
    "  exists(field)             Field exists",
    "  clause AND clause         Conjunction",
  ],

  rules: [
    "lb rules - Validation rules reference",
    "",
    "Usage:",
    "  lb rules [ruleId]",
    "",
    "Examples:",
    "  lb rules          List all rules",
    "  lb rules H15      Show details for rule H15",
  ],
  techniques: [
    "lb techniques - Technique vocabulary reference",
    "",
    "Usage:",
    "  lb techniques [--family <ActionFamily>]",
    "",
    "Flags:",
    "  --family <id>   Filter to a single action family (e.g., PREP, HEAT)",
    "  --json          Machine-readable JSON output",
    "",
    "Examples:",
    "  lb techniques",
    "  lb techniques --family PREP",
  ],

  watch: [
    "lb watch - Alias for 'lb validate watch'",
    "",
    "See: lb help validate",
  ],
};

const MAIN_HELP = [
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
  "",
  "Usage: lb <command> [options]",
  "",
  "For command-specific help: lb help <command>",
  "For example: lb help validate",
  "",
  "Global options:",
  "  --json     Machine-readable JSON output",
  "  --help     Show help",
];

export async function cmdHelp(_flags: GlobalFlags, argv: string[]): Promise<number> {
  const topic = argv[0];

  if (!topic) {
    writeHuman(MAIN_HELP);
    return EXIT_SUCCESS;
  }

  const help = COMMAND_HELP[topic];
  if (help) {
    writeHuman(help);
  } else {
    writeHuman([`Unknown topic: ${topic}`, "", "Available topics: " + Object.keys(COMMAND_HELP).join(", ")]);
  }

  return EXIT_SUCCESS;
}
