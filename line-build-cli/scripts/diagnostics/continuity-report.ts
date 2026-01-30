import { listBuilds, readBuild } from "../lib/store";
import { getOrderedSteps } from "../lib/validate/helpers";
import type { BenchTopLineBuild, Step } from "../lib/schema";

type ContinuityIssue =
  | {
      type: "missing_producer";
      buildId: string;
      stepId: string;
      assemblyId: string;
      inputIndex: number;
    }
  | {
      type: "multiple_producers";
      buildId: string;
      stepId: string;
      assemblyId: string;
      inputIndex: number;
      producerStepIds: string[];
    }
  | {
      type: "location_mismatch";
      buildId: string;
      stepId: string;
      assemblyId: string;
      inputIndex: number;
      producerStepId: string;
      producerLocation: string;
      consumerLocation: string;
    };

function usage(): void {
  process.stdout.write(
    [
      "Continuity report",
      "",
      "Usage:",
      "  npx tsx scripts/diagnostics/continuity-report.ts --all",
      "  npx tsx scripts/diagnostics/continuity-report.ts --build <buildId>",
      "  npx tsx scripts/diagnostics/continuity-report.ts --all --json",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): { all: boolean; buildId?: string; json: boolean } {
  let all = false;
  let buildId: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--all") { all = true; continue; }
    if (arg === "--json") { json = true; continue; }
    if (arg === "--build") { buildId = argv[i + 1]; i += 1; continue; }
    if (arg.startsWith("--build=")) { buildId = arg.split("=")[1]; continue; }
  }

  return { all, buildId, json };
}

function formatLocation(loc?: Step["from"]): string {
  if (!loc) return "(missing)";
  const station = loc.stationId ?? "?";
  const subloc = loc.sublocation?.type ?? "?";
  if (subloc === "equipment") {
    const eq = loc.sublocation?.equipmentId ?? "?";
    return `${station}/equipment(${eq})`;
  }
  return `${station}/${subloc}`;
}

function locationsMatch(from: Step["from"], to: Step["to"]): boolean {
  if (!from || !to) return false;
  if (from.sublocation?.type !== to.sublocation?.type) return false;
  if (from.sublocation?.type === "equipment" || to.sublocation?.type === "equipment") {
    return from.sublocation?.equipmentId === to.sublocation?.equipmentId;
  }
  if (from.stationId && to.stationId && from.stationId !== to.stationId) return false;
  return true;
}

function collectContinuityIssues(build: BenchTopLineBuild): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  const outputsByAssembly = new Map<string, Array<{ stepId: string; to?: Step["to"] }>>();
  for (const step of getOrderedSteps(build)) {
    for (const out of step.output ?? []) {
      if (out.source.type !== "in_build") continue;
      const list = outputsByAssembly.get(out.source.assemblyId) ?? [];
      list.push({ stepId: step.id, to: out.to });
      outputsByAssembly.set(out.source.assemblyId, list);
    }
  }

  for (const step of getOrderedSteps(build)) {
    const inputs = step.input ?? [];
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i]!;
      if (inp.source.type !== "in_build") continue;
      const producers = outputsByAssembly.get(inp.source.assemblyId) ?? [];

      if (producers.length === 0) {
        issues.push({
          type: "missing_producer",
          buildId: build.id,
          stepId: step.id,
          assemblyId: inp.source.assemblyId,
          inputIndex: i,
        });
        continue;
      }

      if (producers.length > 1) {
        issues.push({
          type: "multiple_producers",
          buildId: build.id,
          stepId: step.id,
          assemblyId: inp.source.assemblyId,
          inputIndex: i,
          producerStepIds: producers.map((p) => p.stepId),
        });
        continue;
      }

      const producer = producers[0];
      if (!inp.from || !producer?.to) continue;
      if (!locationsMatch(inp.from, producer.to)) {
        issues.push({
          type: "location_mismatch",
          buildId: build.id,
          stepId: step.id,
          assemblyId: inp.source.assemblyId,
          inputIndex: i,
          producerStepId: producer.stepId,
          producerLocation: formatLocation(producer.to),
          consumerLocation: formatLocation(inp.from),
        });
      }
    }
  }

  return issues;
}

async function run(): Promise<number> {
  const { all, buildId, json } = parseArgs(process.argv.slice(2));
  if (!all && !buildId) {
    usage();
    return 3;
  }

  const buildIds = all
    ? (await listBuilds()).map((b) => b.buildId)
    : [buildId!];

  const results: Array<{ buildId: string; name?: string; issueCount: number; issues: ContinuityIssue[] }> = [];

  for (const id of buildIds) {
    const build = await readBuild(id);
    const issues = collectContinuityIssues(build);
    results.push({ buildId: build.id, name: build.name, issueCount: issues.length, issues });
  }

  if (json) {
    process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + "\n");
    return 0;
  }

  const lines: string[] = [];
  for (const result of results) {
    if (result.issueCount === 0) continue;
    lines.push(`\n${result.buildId} ${result.name ? `(${result.name})` : ""} — ${result.issueCount} issue(s)`);
    for (const issue of result.issues) {
      if (issue.type === "missing_producer") {
        lines.push(`  - ${issue.stepId} input[${issue.inputIndex}] '${issue.assemblyId}': no producer`);
      } else if (issue.type === "multiple_producers") {
        lines.push(`  - ${issue.stepId} input[${issue.inputIndex}] '${issue.assemblyId}': multiple producers (${issue.producerStepIds.join(", ")})`);
      } else if (issue.type === "location_mismatch") {
        lines.push(`  - ${issue.stepId} input[${issue.inputIndex}] '${issue.assemblyId}': ${issue.producerLocation} -> ${issue.consumerLocation} (producer ${issue.producerStepId})`);
      }
    }
  }

  if (lines.length === 0) {
    process.stdout.write("No continuity issues found.\n");
    return 0;
  }

  process.stdout.write(lines.join("\n") + "\n");
  return 2;
}

run().then((code) => {
  process.exitCode = code;
});
