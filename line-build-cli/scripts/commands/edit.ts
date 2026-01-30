 import { readBuild, readBom, writeBuild } from "../lib/store";
 import { validateBuild } from "../lib/validate";
 import { writeValidationOutput } from "../lib/validationOutput";
 import { applyOps, type EditOp } from "../lib/edit";
 import type { GlobalFlags } from "../lb";
 
 const EXIT_SUCCESS = 0;
 const EXIT_VALIDATION_FAILED = 2;
 const EXIT_USAGE_ERROR = 3;
 
 function writeJson(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
 function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
 function writeError(flags: GlobalFlags, message: string) {
   if (flags.json) writeJson({ ok: false, error: { message } });
   else process.stderr.write(message + "\n");
 }
 
 function takeRepeatedOption(argv: string[], name: string): { values: string[]; rest: string[] } {
   const values: string[] = [];
   const out: string[] = [];
   for (let i = 0; i < argv.length; i++) {
     const a = argv[i]!;
     if (a === name) { const v = argv[i + 1]; if (v) values.push(v); i += 1; continue; }
     if (a.startsWith(`${name}=`)) { values.push(a.slice(name.length + 1)); continue; }
     out.push(a);
   }
   return { values, rest: out };
 }
 
 function hasFlag(argv: string[], name: string): { present: boolean; rest: string[] } {
   const rest = argv.filter((a) => a !== name);
   return { present: rest.length !== argv.length, rest };
 }
 
 export async function cmdEdit(flags: GlobalFlags, argv: string[]): Promise<number> {
   const opsOpt = takeRepeatedOption(argv, "--op");
   const applyFlag = hasFlag(opsOpt.rest, "--apply");
   const normalizeFlag = hasFlag(applyFlag.rest, "--normalize");
   const buildId = normalizeFlag.rest[0];
 
   if (!buildId) { writeError(flags, "usage: edit <buildId> [--op <json>] [--apply]"); return EXIT_USAGE_ERROR; }
 
   const build = await readBuild(buildId);
   let ops: EditOp[];
   try {
     ops = opsOpt.values.map(v => JSON.parse(v) as EditOp);
   } catch (err) {
     const msg = err instanceof Error ? err.message : String(err);
     writeError(flags, `Invalid --op JSON: ${msg}`);
     return EXIT_USAGE_ERROR;
   }
   if (normalizeFlag.present) ops.push({ type: "normalize_indices" });
 
   try {
     const updated = applyOps(build, ops);
     const bom = await readBom(updated.itemId);
     const validation = validateBuild(updated, { bom });
 
     if (!applyFlag.present) {
       if (flags.json) writeJson({ ok: true, dryRun: true, build: updated, validation });
       else writeHuman(["Dry run successful. Use --apply to commit.", `Valid: ${validation.valid}`, `Errors: ${validation.hardErrors.length}`]);
       return EXIT_SUCCESS;
     }
 
     if (updated.status === "published" && !validation.valid) {
       writeError(flags, `Publish blocked after edit: ${validation.hardErrors[0]?.message}`);
       return EXIT_VALIDATION_FAILED;
     }
 
     const path = await writeBuild(updated);
     await writeValidationOutput(updated, validation);
     if (flags.json) writeJson({ ok: true, buildId: updated.id, path });
     else writeHuman([`Updated ${updated.id} at ${path}`]);
     return EXIT_SUCCESS;
   } catch (err) {
     writeError(flags, `Edit failed: ${err instanceof Error ? err.message : String(err)}`);
     return EXIT_USAGE_ERROR;
   }
 }
