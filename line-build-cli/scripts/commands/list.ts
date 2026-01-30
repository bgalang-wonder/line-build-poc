 import { listBuilds } from "../lib/store";
 import type { GlobalFlags } from "../lb";
 
 const EXIT_SUCCESS = 0;
 
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
 
 export async function cmdList(flags: GlobalFlags, argv: string[]): Promise<number> {
   const queryOpt = takeOption(argv, "--query");
   const itemOpt = takeOption(queryOpt.rest, "--item");
   const query = queryOpt.value?.toLowerCase();
   const itemId = itemOpt.value;
 
   let builds = await listBuilds();
   if (itemId) builds = builds.filter(b => b.itemId === itemId);
   if (query) builds = builds.filter(b => b.itemId.includes(query) || b.name?.toLowerCase().includes(query));
 
   if (flags.json) {
     writeJson({ ok: true, builds });
     return EXIT_SUCCESS;
   }
 
   const lines = [`Found ${builds.length} build(s):`];
   for (const b of builds) {
     lines.push(`- ${b.itemId} "${b.name || '(unnamed)'}" v${b.version} (${b.status}) id=${b.buildId}`);
   }
   writeHuman(lines);
   return EXIT_SUCCESS;
 }
