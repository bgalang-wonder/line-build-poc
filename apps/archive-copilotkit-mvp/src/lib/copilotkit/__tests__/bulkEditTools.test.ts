/**
 * Tests for bulk edit tools
 */

import {
  findStepsMatchingCriteria,
  proposeBulkEdit,
  applyBulkEdit,
  cancelProposal,
  getProposal,
  listPendingProposals,
  clearOldProposals,
  formatFindResultSummary,
  formatProposalSummary,
  type StepSearchCriteria,
} from '../bulkEditTools';
import { LineBuild, ActionType } from '../../model/types';
import { getPersistence } from '../../model/data/persistence';

// Mock the persistence layer
jest.mock('../../model/data/persistence', () => ({
  getPersistence: jest.fn(),
}));

const mockGetPersistence = getPersistence as jest.MockedFunction<
  typeof getPersistence
>;

// Sample test data
const createMockBuild = (
  id: string,
  name: string,
  status: 'draft' | 'active',
  workUnits: LineBuild['workUnits']
): LineBuild => ({
  id,
  menuItemId: `menu-${id}`,
  menuItemName: name,
  workUnits,
  metadata: {
    author: 'test-author',
    version: 1,
    status,
    changelog: [],
  },
});

const createMockWorkUnit = (
  id: string,
  action: ActionType,
  targetName: string,
  equipment?: string,
  timeMinutes?: number,
  phase?: 'PRE_COOK' | 'COOK' | 'POST_COOK' | 'ASSEMBLY' | 'PASS'
) => ({
  id,
  tags: {
    action,
    target: { name: targetName },
    equipment,
    time: timeMinutes
      ? { value: timeMinutes, unit: 'min' as const, type: 'active' as const }
      : undefined,
    phase,
  },
  dependsOn: [],
});

describe('bulkEditTools', () => {
  let mockPersistence: {
    loadAll: jest.Mock;
    load: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    mockPersistence = {
      loadAll: jest.fn(),
      load: jest.fn(),
      save: jest.fn(),
    };
    mockGetPersistence.mockReturnValue(mockPersistence as any);

    // Clear any pending proposals between tests
    clearOldProposals(0);
  });

  describe('findStepsMatchingCriteria', () => {
    it('finds steps by equipment', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer', 5),
          createMockWorkUnit('wu-2', 'PREP', 'lettuce'),
        ]),
        createMockBuild('build-2', 'Fries', 'draft', [
          createMockWorkUnit('wu-3', 'HEAT', 'potatoes', 'fryer', 8),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);

      const result = await findStepsMatchingCriteria({ equipment: 'fryer' });

      expect(result.matchCount).toBe(2);
      expect(result.matches[0].equipment).toBe('fryer');
      expect(result.matches[1].equipment).toBe('fryer');
    });

    it('finds steps by action type', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty'),
          createMockWorkUnit('wu-2', 'PREP', 'lettuce'),
          createMockWorkUnit('wu-3', 'HEAT', 'bun'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);

      const result = await findStepsMatchingCriteria({ actionType: 'HEAT' });

      expect(result.matchCount).toBe(2);
      expect(result.matches.every((m) => m.action === 'HEAT')).toBe(true);
    });

    it('finds steps over time threshold', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', undefined, 15),
          createMockWorkUnit('wu-2', 'HEAT', 'bun', undefined, 5),
          createMockWorkUnit('wu-3', 'PREP', 'cheese', undefined, 2),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);

      const result = await findStepsMatchingCriteria({
        timeGreaterThan: 10 * 60, // 10 minutes in seconds
      });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].targetName).toBe('patty');
    });

    it('respects draftOnly filter', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
        createMockBuild('build-2', 'Fries', 'active', [
          createMockWorkUnit('wu-2', 'HEAT', 'potatoes', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);

      const resultDraftOnly = await findStepsMatchingCriteria({
        equipment: 'fryer',
        draftOnly: true,
      });

      expect(resultDraftOnly.matchCount).toBe(1);
      expect(resultDraftOnly.matches[0].buildStatus).toBe('draft');
    });

    it('combines multiple criteria with AND logic', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer', 5, 'COOK'),
          createMockWorkUnit('wu-2', 'HEAT', 'bun', 'toaster', 2, 'COOK'),
          createMockWorkUnit('wu-3', 'PREP', 'lettuce', undefined, 1, 'PRE_COOK'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);

      const result = await findStepsMatchingCriteria({
        actionType: 'HEAT',
        phase: 'COOK',
        equipment: 'fryer',
      });

      expect(result.matchCount).toBe(1);
      expect(result.matches[0].targetName).toBe('patty');
    });
  });

  describe('proposeBulkEdit', () => {
    it('creates a proposal with previews', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer',
        'equipment containing "fryer"'
      );

      expect(proposal.status).toBe('pending');
      expect(proposal.editType).toBe('updateEquipment');
      expect(proposal.totalChanges).toBe(1);
      expect(proposal.previews[0].changes[0].oldValue).toBe('fryer');
      expect(proposal.previews[0].changes[0].newValue).toBe('turbo-fryer');
    });

    it('stores proposal for later application', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      const retrieved = getProposal(proposal.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(proposal.id);
    });

    it('skips active builds in proposal', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'active', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      // Should have 0 changes because active builds cannot be edited
      expect(proposal.totalChanges).toBe(0);
    });
  });

  describe('applyBulkEdit', () => {
    it('applies changes and updates changelog', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });
      mockPersistence.save.mockResolvedValue({});

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      const result = await applyBulkEdit(proposal.id);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockPersistence.save).toHaveBeenCalled();

      // Check that changelog was added
      const savedBuild = mockPersistence.save.mock.calls[0][0] as LineBuild;
      expect(savedBuild.metadata.changelog?.length).toBeGreaterThan(0);
      expect(savedBuild.metadata.changelog?.[0].agentAssisted).toBe(true);
    });

    it('marks proposal as applied', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });
      mockPersistence.save.mockResolvedValue({});

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      await applyBulkEdit(proposal.id);

      const updatedProposal = getProposal(proposal.id);
      expect(updatedProposal?.status).toBe('applied');
    });

    it('throws error for already applied proposal', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });
      mockPersistence.save.mockResolvedValue({});

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      await applyBulkEdit(proposal.id);

      await expect(applyBulkEdit(proposal.id)).rejects.toThrow('already been applied');
    });
  });

  describe('cancelProposal', () => {
    it('cancels a pending proposal', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      const success = cancelProposal(proposal.id);
      expect(success).toBe(true);

      const updatedProposal = getProposal(proposal.id);
      expect(updatedProposal?.status).toBe('cancelled');
    });

    it('returns false for non-existent proposal', () => {
      const success = cancelProposal('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('listPendingProposals', () => {
    it('returns only pending proposals', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
          createMockWorkUnit('wu-2', 'HEAT', 'bun', 'toaster'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });
      mockPersistence.save.mockResolvedValue({});

      // Create two proposals
      const proposal1 = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );
      const proposal2 = await proposeBulkEdit(
        { equipment: 'toaster' },
        'updateEquipment',
        'turbo-toaster'
      );

      // Apply one
      await applyBulkEdit(proposal1.id);

      const pending = listPendingProposals();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(proposal2.id);
    });
  });

  describe('formatFindResultSummary', () => {
    it('formats empty results correctly', () => {
      const result = {
        criteria: { equipment: 'fryer' },
        matches: [],
        totalBuildsSearched: 5,
        totalStepsSearched: 20,
        matchCount: 0,
      };

      const summary = formatFindResultSummary(result);
      expect(summary).toContain('Found 0 steps');
      expect(summary).toContain('No matching steps found');
    });

    it('formats results with matches', () => {
      const result = {
        criteria: { equipment: 'fryer' },
        matches: [
          {
            buildId: 'build-1',
            buildName: 'Burger',
            buildStatus: 'draft' as const,
            stepId: 'wu-1',
            stepIndex: 0,
            action: 'HEAT' as const,
            targetName: 'patty',
            equipment: 'fryer',
            timeSeconds: 300,
          },
        ],
        totalBuildsSearched: 5,
        totalStepsSearched: 20,
        matchCount: 1,
      };

      const summary = formatFindResultSummary(result);
      expect(summary).toContain('Found 1 step');
      expect(summary).toContain('Burger');
      expect(summary).toContain('HEAT');
      expect(summary).toContain('patty');
    });
  });

  describe('formatProposalSummary', () => {
    it('formats proposal correctly', async () => {
      const builds: LineBuild[] = [
        createMockBuild('build-1', 'Burger', 'draft', [
          createMockWorkUnit('wu-1', 'HEAT', 'patty', 'fryer'),
        ]),
      ];

      mockPersistence.loadAll.mockResolvedValue(builds);
      mockPersistence.load.mockResolvedValue({ build: builds[0] });

      const proposal = await proposeBulkEdit(
        { equipment: 'fryer' },
        'updateEquipment',
        'turbo-fryer'
      );

      const summary = formatProposalSummary(proposal);
      expect(summary).toContain(proposal.id);
      expect(summary).toContain('pending');
      expect(summary).toContain('Change equipment to "turbo-fryer"');
      expect(summary).toContain('Preview of changes');
    });
  });
});
