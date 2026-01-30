import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = '/Users/brandongalang/Documents/01_Projects/line-build-redesign/poc/line-build-cli/data/line-builds';

const BUILDS_TO_FIX = [
  'quesadilla-byo-limesalt-8005007',
  'chips-corn-salsa-limesalt-8005118',
  'original-square-pizza-difara-8006375',
  'regular-round-pizza-difara-8006380',
  'taco-beef-barbacoa-barrio-8006860',
  'beef-barbacoa-quesadilla-8006896',
  'chicken-kebab-maydan-8007022',
  'cheeseburger-melt-burger-baby-8007391',
  'sandwich-byo-yasas-8007402',
  'baked-potato-mainstay-v1',
  'general-tsos-chicken-kin-house-8009007',
  'cheese-fries-burger-baby-8009068',
  'pad-thai-chicken-sri-8009813',
  'french-fries-bellies-8010062',
  'byo-spicy-poke-bowl-hanu-poke-8010500',
];

interface Step {
  id: string;
  orderIndex: number;
  trackId?: string;
  dependsOn?: string[];
  output?: { source?: { assemblyId?: string } }[];
  [key: string]: unknown;
}

interface Build {
  steps: Step[];
  assemblies?: { id: string; name: string; groupId: string }[];
  [key: string]: unknown;
}

for (const buildId of BUILDS_TO_FIX) {
  const filePath = join(DATA_DIR, `${buildId}.json`);
  const build: Build = JSON.parse(readFileSync(filePath, 'utf-8'));

  // Find terminal steps (steps that no other step depends on)
  const allDeps = new Set(build.steps.flatMap((s) => s.dependsOn || []));
  const terminalSteps = build.steps.filter((s) => !allDeps.has(s.id));

  if (terminalSteps.length <= 1) {
    console.log(`${buildId}: Only ${terminalSteps.length} terminal step, skipping`);
    continue;
  }

  // Check if there's already a merge step that depends on multiple terminals
  const terminalIds = new Set(terminalSteps.map(s => s.id));
  const hasExistingMerge = build.steps.some((s) => {
    const deps = s.dependsOn || [];
    const terminalDepsCount = deps.filter(d => terminalIds.has(d)).length;
    return terminalDepsCount >= 2;
  });

  if (hasExistingMerge) {
    console.log(`${buildId}: Already has merge step, skipping`);
    continue;
  }

  // Find the max step number
  const maxStepNum = Math.max(...build.steps.map((s) => {
    const match = s.id.match(/step-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }));

  const newStepId = `step-${maxStepNum + 1}`;

  // Build input array from terminal steps' outputs
  const inputs = terminalSteps.map((s, i) => {
    const lastOutput = s.output?.[s.output.length - 1];
    const assemblyId = lastOutput?.source?.assemblyId || `${s.id}_output`;
    return {
      source: { type: 'in_build', assemblyId },
      role: i === 0 ? 'base' : 'added',
      from: { stationId: 'expo', sublocation: { type: 'window_shelf' } }
    };
  });

  // Create merge step
  const mergeStep = {
    id: newStepId,
    orderIndex: build.steps.length,
    action: { family: 'CHECK' },
    instruction: 'Complete Order Handoff',
    trackId: terminalSteps[0].trackId || 'default',
    groupingId: 'cold_side',
    stationId: 'expo',
    toolId: 'hand',
    cookingPhase: 'PASS',
    sublocation: { type: 'window_shelf' },
    from: { stationId: 'expo', sublocation: { type: 'work_surface' } },
    to: { stationId: 'expo', sublocation: { type: 'window_shelf' } },
    dependsOn: terminalSteps.map((s) => s.id),
    input: inputs,
    output: [{
      source: { type: 'in_build', assemblyId: 'complete_order_v1' },
      to: { stationId: 'expo', sublocation: { type: 'window_shelf' } }
    }]
  };

  // Add to build
  build.steps.push(mergeStep as Step);

  // Add assembly if not exists
  if (!build.assemblies) build.assemblies = [];
  if (!build.assemblies.find((a) => a.id === 'complete_order_v1')) {
    build.assemblies.push({
      id: 'complete_order_v1',
      name: 'Complete Order',
      groupId: 'order'
    });
  }

  // Write back
  writeFileSync(filePath, JSON.stringify(build, null, 2));
  const terminalNames = terminalSteps.map((s) => s.id).join(', ');
  console.log(`${buildId}: Added ${newStepId} merging ${terminalSteps.length} terminal steps (${terminalNames})`);
}

console.log('\nDone!');
