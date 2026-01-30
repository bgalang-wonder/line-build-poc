 import { readBuild, readBom } from "../lib/store";
 import { validateBuild } from "../lib/validate";
 import { buildMatchLabel, buildGapsFromValidation } from "../lib/query";
 import type { GlobalFlags } from "../lb";
 
 const EXIT_SUCCESS = 0;
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
 
 export async function cmdGet(flags: GlobalFlags, argv: string[]): Promise<number> {
   const formatOpt = takeOption(argv, "--format");
   const buildId = formatOpt.rest[0];
   if (!buildId) { writeError(flags, "usage: get <buildId> [--format full|summary|steps|gaps]"); return EXIT_USAGE_ERROR; }
 
   const build = await readBuild(buildId);
   const format = formatOpt.value || "full";
 
   if (format === "summary") {
     const summary = { id: build.id, itemId: build.itemId, version: build.version, status: build.status, steps: build.steps.length };
     if (flags.json) writeJson({ ok: true, ...summary });
     else writeHuman(Object.entries(summary).map(([k, v]) => `${k}=${v}`));
   } else if (format === "steps") {
     if (flags.json) writeJson({ ok: true, steps: build.steps });
     else {
       const lines = [`buildId=${build.id} (${build.steps.length} steps):`];
       for (const s of build.steps) lines.push(`[${s.orderIndex}] ${s.id} ${s.action.family} :: ${buildMatchLabel(s)}`);
       writeHuman(lines);
     }
   } else if (format === "gaps") {
     const bom = await readBom(build.itemId);
     const validation = validateBuild(build, { bom });
     const gaps = buildGapsFromValidation(build, validation);
     if (flags.json) writeJson({ ok: true, gaps });
     else {
       const lines = [`Gaps for ${build.id} (${gaps.length}):`];
       for (const g of gaps) lines.push(`[${g.ruleId}] ${g.message} (${g.steps.length} steps affected)`);
       writeHuman(lines);
     }
   } else {
     writeJson(build);
   }
   return EXIT_SUCCESS;
 }
