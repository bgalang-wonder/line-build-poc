 import { VALIDATION_RULES, getRuleById } from "../lib/rules";
 
 const EXIT_SUCCESS = 0;
 
 function writeHuman(lines: string[]) { process.stdout.write(lines.join("\n") + "\n"); }
 
 export async function cmdRules(argv: string[]): Promise<number> {
   const rid = argv[0];
   if (rid) {
     const rule = getRuleById(rid);
     if (rule) writeHuman([`${rule.id}: ${rule.description}`, `Scope: ${rule.scope}`]);
     return EXIT_SUCCESS;
   }
   writeHuman(["Rules:", ...VALIDATION_RULES.map(r => `  ${r.id}: ${r.description}`)]);
   return EXIT_SUCCESS;
 }
