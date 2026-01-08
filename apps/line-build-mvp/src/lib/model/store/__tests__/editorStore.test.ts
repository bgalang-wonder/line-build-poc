import { useEditorStore } from '../editorStore';
import { LineBuild, WorkUnit } from '../../types';

/**
 * Test fixtures
 */
const createMockWorkUnit = (id: string, overrides?: Partial<WorkUnit>): WorkUnit => ({
  id,
  tags: {
    action: 'PREP',
    target: { bomId: '4001234', name: 'Chicken Breast' },
    time: { value: 10, unit: 'min', type: 'active' },
    equipment: 'Cutting Board',
    phase: 'PRE_COOK',
    station: 'prep-1',
    timingMode: 'a_la_minute',
    prepType: 'pre_service',
  },
  dependsOn: [],
  ...overrides,
});

const createMockLineBuild = (workUnits: WorkUnit[]): LineBuild => ({
  id: 'build-001',
  bomItemId: '8001234',
  menuItemName: 'Grilled Chicken Bowl',
  workUnits,
  metadata: {
    author: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    version: 1,
    sourceConversations: [],
  },
  validationResults: undefined,
});

/**
 * Reset store before each test
 */
beforeEach(() => {
  useEditorStore.getState().reset();
});

/**
 * reorderWorkUnits action tests
 */
describe('editorStore.reorderWorkUnits', () => {
  it('reorders work units from index 0 to index 2', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
      createMockWorkUnit('step-3'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(0, 2);

    expect(result).toBe(true);
    const updatedBuild = useEditorStore.getState().currentBuild;
    expect(updatedBuild?.workUnits.map(wu => wu.id)).toEqual(['step-2', 'step-3', 'step-1']);
  });

  it('reorders work units from index 2 to index 0', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
      createMockWorkUnit('step-3'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(2, 0);

    expect(result).toBe(true);
    const updatedBuild = useEditorStore.getState().currentBuild;
    expect(updatedBuild?.workUnits.map(wu => wu.id)).toEqual(['step-3', 'step-1', 'step-2']);
  });

  it('reorders adjacent items (index 0 to index 1)', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(0, 1);

    expect(result).toBe(true);
    const updatedBuild = useEditorStore.getState().currentBuild;
    expect(updatedBuild?.workUnits.map(wu => wu.id)).toEqual(['step-2', 'step-1']);
  });

  it('returns true but no-ops when fromIndex equals toIndex', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);
    const versionBefore = build.metadata.version;

    const result = useEditorStore.getState().reorderWorkUnits(0, 0);

    expect(result).toBe(true);
    const updatedBuild = useEditorStore.getState().currentBuild;
    // Version should not change for no-op
    expect(updatedBuild?.metadata.version).toBe(versionBefore);
    expect(updatedBuild?.workUnits.map(wu => wu.id)).toEqual(['step-1', 'step-2']);
  });

  it('returns false when no build is loaded', () => {
    const result = useEditorStore.getState().reorderWorkUnits(0, 1);

    expect(result).toBe(false);
    expect(useEditorStore.getState().error).toBe('No build loaded');
  });

  it('returns false for invalid fromIndex (negative)', () => {
    const workUnits = [createMockWorkUnit('step-1')];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(-1, 0);

    expect(result).toBe(false);
    expect(useEditorStore.getState().error).toBe('Invalid reorder indices');
  });

  it('returns false for invalid toIndex (out of bounds)', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(0, 5);

    expect(result).toBe(false);
    expect(useEditorStore.getState().error).toBe('Invalid reorder indices');
  });

  it('returns false for invalid fromIndex (out of bounds)', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(10, 0);

    expect(result).toBe(false);
    expect(useEditorStore.getState().error).toBe('Invalid reorder indices');
  });

  it('returns false when build is not in draft status', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);
    build.metadata.status = 'active';

    useEditorStore.getState().setBuild(build);

    const result = useEditorStore.getState().reorderWorkUnits(0, 1);

    expect(result).toBe(false);
    expect(useEditorStore.getState().error).toBe('Cannot reorder steps in active build (demote first)');
  });

  it('increments version after successful reorder', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);
    build.metadata.version = 5;

    useEditorStore.getState().setBuild(build);

    useEditorStore.getState().reorderWorkUnits(0, 1);

    const updatedBuild = useEditorStore.getState().currentBuild;
    expect(updatedBuild?.metadata.version).toBe(6);
  });

  it('clears validation results after reorder', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);
    // Simulate having validation results
    useEditorStore.getState().setValidationStatus({
      isValid: true,
      structuralErrors: [],
      structuralWarnings: [],
      semanticViolations: [],
    });

    // Verify validation is set
    expect(useEditorStore.getState().validationSnapshot.status).not.toBeNull();

    // Perform reorder
    useEditorStore.getState().reorderWorkUnits(0, 1);

    // Validation should be cleared
    expect(useEditorStore.getState().validationSnapshot.status).toBeNull();
  });

  it('clears error after successful reorder', () => {
    const workUnits = [
      createMockWorkUnit('step-1'),
      createMockWorkUnit('step-2'),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);
    useEditorStore.getState().setError('Some previous error');

    useEditorStore.getState().reorderWorkUnits(0, 1);

    expect(useEditorStore.getState().error).toBeNull();
  });

  it('preserves all work unit data during reorder', () => {
    const workUnits = [
      createMockWorkUnit('step-1', {
        tags: {
          action: 'PREP',
          target: { bomId: '111', name: 'Item A' },
          equipment: 'Tool A',
        },
        dependsOn: ['step-2'],
      }),
      createMockWorkUnit('step-2', {
        tags: {
          action: 'HEAT',
          target: { bomId: '222', name: 'Item B' },
          equipment: 'Tool B',
        },
      }),
    ];
    const build = createMockLineBuild(workUnits);

    useEditorStore.getState().setBuild(build);

    useEditorStore.getState().reorderWorkUnits(0, 1);

    const updatedBuild = useEditorStore.getState().currentBuild;

    // step-1 should now be at index 1
    const movedStep = updatedBuild?.workUnits[1];
    expect(movedStep?.id).toBe('step-1');
    expect(movedStep?.tags.action).toBe('PREP');
    expect(movedStep?.tags.target.name).toBe('Item A');
    expect(movedStep?.dependsOn).toEqual(['step-2']);

    // step-2 should now be at index 0
    const otherStep = updatedBuild?.workUnits[0];
    expect(otherStep?.id).toBe('step-2');
    expect(otherStep?.tags.action).toBe('HEAT');
    expect(otherStep?.tags.target.name).toBe('Item B');
  });
});
