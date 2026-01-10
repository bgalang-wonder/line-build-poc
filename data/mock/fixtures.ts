/**
 * Sample Line Build Fixtures (benchtop-x0c.1.6)
 *
 * Realistic line build examples for UI development and testing.
 * Based on Cookbook menu items (80* prefix) and Grubhub/QSR use cases.
 *
 * NOTE: This file imports types from docs/schema/types-benchtop.ts
 * If using these fixtures, ensure types are available.
 */

// Types are now in docs/schema/types-benchtop.ts
// Import would be: import { LineBuild, WorkUnit } from '../../docs/schema/types-benchtop';
// For now, keeping as reference data - update imports when used

// ============================================================================
// Helper: Generate ISO timestamp
// ============================================================================

function nowISO(): string {
  return new Date().toISOString();
}

function minutesAgo(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

// ============================================================================
// Sample Fixture 1: Grilled Chicken Bowl (Complete, Published)
// ============================================================================

export const FIXTURE_GRILLED_CHICKEN_BOWL = {
  id: 'build-grilled-chicken-001',
  menuItemId: '8001001',
  menuItemName: 'Grilled Chicken Bowl',
  workUnits: [
    {
      id: 'wu-001-prep',
      dependsOn: [],
      tags: {
        action: 'PREP',
        target: { bomId: '4001001', name: 'Chicken breast' },
        equipment: 'Cutting board',
        time: { value: 5, unit: 'min' as const, type: 'active' as const },
        phase: 'PRE_COOK' as const,
        timingMode: 'a_la_minute' as const,
        station: 'Cold prep',
      },
    },
    {
      id: 'wu-001-marinate',
      dependsOn: ['wu-001-prep'],
      tags: {
        action: 'TRANSFER' as const,
        target: { name: 'Marinating station' },
        time: { value: 15, unit: 'min' as const, type: 'passive' as const },
        phase: 'PRE_COOK' as const,
        station: 'Walk-in cooler',
      },
    },
    {
      id: 'wu-001-grill',
      dependsOn: ['wu-001-marinate'],
      tags: {
        action: 'HEAT' as const,
        target: { bomId: '4001001', name: 'Grill station' },
        equipment: 'Flat-top grill',
        time: { value: 8, unit: 'min' as const, type: 'active' as const },
        phase: 'COOK' as const,
        timingMode: 'sandbag' as const,
        station: 'Hot line',
      },
    },
    {
      id: 'wu-001-assemble',
      dependsOn: ['wu-001-grill'],
      tags: {
        action: 'ASSEMBLE' as const,
        target: { bomId: '4001001', name: 'Bowl' },
        time: { value: 3, unit: 'min' as const, type: 'active' as const },
        phase: 'ASSEMBLY' as const,
        station: 'Plating station',
      },
    },
    {
      id: 'wu-001-finish',
      dependsOn: ['wu-001-assemble'],
      tags: {
        action: 'FINISH' as const,
        target: { bomId: '4001001', name: 'Garnish' },
        time: { value: 2, unit: 'min' as const, type: 'active' as const },
        phase: 'PASS' as const,
        station: 'Plating station',
      },
    },
  ],
  metadata: {
    author: 'Chef Alice',
    version: 3,
    status: 'active' as const,
    sourceConversations: [
      'chat-001: User asked for simplified version',
      'chat-002: Updated timing based on kitchen feedback',
    ],
  },
};

// ============================================================================
// Sample Fixture 2: Crispy Fish Tacos (Draft, Under Development)
// ============================================================================

export const FIXTURE_CRISPY_FISH_TACOS = {
  id: 'build-fish-tacos-002',
  menuItemId: '8001002',
  menuItemName: 'Crispy Fish Tacos',
  workUnits: [
    {
      id: 'wu-002-prep',
      dependsOn: [],
      tags: {
        action: 'PREP' as const,
        target: { bomId: '4001002', name: 'Fish fillet' },
        equipment: 'Cutting board',
        time: { value: 8, unit: 'min' as const, type: 'active' as const },
        phase: 'PRE_COOK' as const,
        timingMode: 'a_la_minute' as const,
        station: 'Cold prep',
      },
    },
    {
      id: 'wu-002-bread',
      dependsOn: ['wu-002-prep'],
      tags: {
        action: 'PREP' as const,
        target: { bomId: '4001002', name: 'Breading station' },
        time: { value: 3, unit: 'min' as const, type: 'active' as const },
        phase: 'PRE_COOK' as const,
        station: 'Cold prep',
      },
    },
    {
      id: 'wu-002-fry',
      dependsOn: ['wu-002-bread'],
      tags: {
        action: 'HEAT' as const,
        target: { bomId: '4001002', name: 'Deep fryer' },
        equipment: 'Deep fryer, 350°F',
        time: { value: 4, unit: 'min' as const, type: 'active' as const },
        phase: 'COOK' as const,
        station: 'Hot line',
      },
    },
    {
      id: 'wu-002-plate',
      dependsOn: ['wu-002-fry'],
      tags: {
        action: 'ASSEMBLE' as const,
        target: { bomId: '4001002', name: 'Taco assembly' },
        time: { value: 2, unit: 'min' as const, type: 'active' as const },
        phase: 'ASSEMBLY' as const,
        station: 'Plating station',
        requiresOrder: true,
      },
    },
  ],
  metadata: {
    author: 'Chef Bob',
    version: 1,
    status: 'draft' as const,
    sourceConversations: ['chat-003: Initial workflow created'],
  },
};

// ============================================================================
// Sample Fixture 3: Vegetarian Buddha Bowl (In Review)
// ============================================================================

export const FIXTURE_BUDDHA_BOWL = {
  id: 'build-buddha-bowl-003',
  menuItemId: '8001003',
  menuItemName: 'Vegetarian Buddha Bowl',
  workUnits: [
    {
      id: 'wu-003-grains',
      dependsOn: [],
      tags: {
        action: 'PREP' as const,
        target: { bomId: '4001003', name: 'Quinoa + rice mix' },
        equipment: 'Rice cooker',
        time: { value: 20, unit: 'min' as const, type: 'passive' as const },
        phase: 'PRE_COOK' as const,
        timingMode: 'hot_hold' as const,
        station: 'Hot line',
        bulkPrep: true,
      },
    },
    {
      id: 'wu-003-roast-veggies',
      dependsOn: [],
      tags: {
        action: 'HEAT' as const,
        target: { bomId: '4001003', name: 'Root vegetables' },
        equipment: 'Convection oven, 400°F',
        time: { value: 25, unit: 'min' as const, type: 'active' as const },
        phase: 'COOK' as const,
        station: 'Hot line',
      },
    },
    {
      id: 'wu-003-prep-toppings',
      dependsOn: [],
      tags: {
        action: 'PREP' as const,
        target: { name: 'Hummus, tahini, greens' },
        time: { value: 10, unit: 'min' as const, type: 'active' as const },
        phase: 'PRE_COOK' as const,
        station: 'Cold prep',
      },
    },
    {
      id: 'wu-003-bowl-assembly',
      dependsOn: ['wu-003-grains', 'wu-003-roast-veggies', 'wu-003-prep-toppings'],
      tags: {
        action: 'ASSEMBLE' as const,
        target: { bomId: '4001003', name: 'Bowl with all components' },
        time: { value: 4, unit: 'min' as const, type: 'active' as const },
        phase: 'ASSEMBLY' as const,
        station: 'Plating station',
      },
    },
  ],
  metadata: {
    author: 'Chef Carol',
    version: 2,
    status: 'draft' as const,
    sourceConversations: [
      'chat-004: Created initial workflow',
      'chat-005: Added bulk prep note for efficiency',
    ],
  },
};

// ============================================================================
// Sample Fixture 4: Simple Sandwich (Minimal, P&L)
// ============================================================================

export const FIXTURE_SIMPLE_SANDWICH = {
  id: 'build-sandwich-004',
  menuItemId: '8001004',
  menuItemName: 'Simple Sandwich',
  workUnits: [
    {
      id: 'wu-004-assemble',
      dependsOn: [],
      tags: {
        action: 'ASSEMBLE' as const,
        target: { bomId: '4001004', name: 'Bread + fillings' },
        time: { value: 2, unit: 'min' as const, type: 'active' as const },
        phase: 'ASSEMBLY' as const,
        timingMode: 'a_la_minute' as const,
        station: 'Assembly line',
      },
    },
    {
      id: 'wu-004-wrap',
      dependsOn: ['wu-004-assemble'],
      tags: {
        action: 'FINISH' as const,
        target: { bomId: '4001004', name: 'Wrapping station' },
        time: { value: 1, unit: 'min' as const, type: 'active' as const },
        phase: 'PASS' as const,
        station: 'Packaging',
      },
    },
  ],
  metadata: {
    author: 'Chef David',
    version: 5,
    status: 'active' as const,
  },
};

// ============================================================================
// Fixture Array (for easy iteration in UI/testing)
// ============================================================================

export const SAMPLE_FIXTURES = [
  FIXTURE_GRILLED_CHICKEN_BOWL,
  FIXTURE_CRISPY_FISH_TACOS,
  FIXTURE_BUDDHA_BOWL,
  FIXTURE_SIMPLE_SANDWICH,
];

// ============================================================================
// Export by Status (useful for filter/test scenarios)
// ============================================================================

export const ACTIVE_FIXTURES = SAMPLE_FIXTURES.filter(
  (b: any) => b.metadata.status === 'active'
);

export const DRAFT_FIXTURES = SAMPLE_FIXTURES.filter(
  (b: any) => b.metadata.status === 'draft'
);

// ============================================================================
// Helper: Get fixture by ID
// ============================================================================

export function getFixtureById(buildId: string): any {
  return SAMPLE_FIXTURES.find((b: any) => b.id === buildId);
}

// ============================================================================
// Helper: Get all fixtures with metadata
// ============================================================================

export function listFixtures(): Array<{
  id: string;
  menuItemName: string;
  status: 'draft' | 'active';
  author: string;
  stepCount: number;
}> {
  return SAMPLE_FIXTURES.map((b: any) => ({
    id: b.id,
    menuItemName: b.menuItemName,
    status: b.metadata.status,
    author: b.metadata.author,
    stepCount: b.workUnits.length,
  }));
}
