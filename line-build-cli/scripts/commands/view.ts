import { DATA_ROOT_ABS } from "../lib/store";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";

const EXIT_SUCCESS = 0;
const EXIT_USAGE_ERROR = 3;

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

export async function cmdView(argv: string[]): Promise<number> {
  const stepOpt = takeOption(argv, "--step");
  const bid = stepOpt.rest[0];
  
  if (!bid) {
    process.stderr.write("usage: view <buildId> [--step <stepId>]\n");
    return EXIT_USAGE_ERROR;
  }

  const ctrl: Record<string, string> = {
    buildId: bid,
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  if (stepOpt.value) {
    ctrl.stepId = stepOpt.value;
  }

  await fs.mkdir(`${DATA_ROOT_ABS}/viewer`, { recursive: true });
  await fs.writeFile(`${DATA_ROOT_ABS}/viewer/selection.json`, JSON.stringify(ctrl));
  
  return EXIT_SUCCESS;
}
