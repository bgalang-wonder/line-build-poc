 import { readBuild, listBuilds } from "../lib/store";
 import { runQuery } from "../lib/query";
 import { searchNotes } from "../lib/searchNotes";
 import type { GlobalFlags } from "../lb";
 import type { BenchTopLineBuild } from "../lib/schema";
 
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
 
 async function loadAllBuilds(): Promise<BenchTopLineBuild[]> {
   const summaries = await listBuilds();
   const builds: BenchTopLineBuild[] = [];
   for (const s of summaries) builds.push(await readBuild(s.buildId));
   return builds;
 }
 
 export async function cmdSearch(flags: GlobalFlags, argv: string[]): Promise<number> {
   const whereOpt = takeOption(argv, "--where");
   const notesOpt = takeOption(whereOpt.rest, "--notes");
   const builds = await loadAllBuilds();
 
   if (whereOpt.value) {
     const { matches } = runQuery({ builds, where: whereOpt.value });
     if (flags.json) writeJson({ ok: true, matches });
     else writeHuman(matches.map(m => `${m.buildId} :: step=${m.stepId} :: ${m.label}`));
   } else if (notesOpt.value) {
     const result = searchNotes({ builds, pattern: notesOpt.value });
     if (flags.json) writeJson({ ok: true, ...result });
     else writeHuman(result.matches.map(m => `${m.buildId} :: step=${m.stepId} :: ${m.matchText}`));
   } else {
     writeError(flags, "usage: search [--where <dsl>] [--notes <regex>]");
     return EXIT_USAGE_ERROR;
   }
   return EXIT_SUCCESS;
 }
