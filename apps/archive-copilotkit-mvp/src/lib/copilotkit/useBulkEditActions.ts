/**
 * CopilotKit Bulk Edit Actions Hook
 *
 * Provides useCopilotAction hooks for bulk edit operations.
 * Import and call this hook in dashboard or other pages to enable
 * agent-assisted bulk editing via the chat interface.
 *
 * Usage:
 * ```tsx
 * import { useBulkEditActions } from '@/lib/copilotkit/useBulkEditActions';
 *
 * function MyComponent() {
 *   useBulkEditActions(); // Registers all bulk edit actions
 *   return <CopilotSidebar />;
 * }
 * ```
 */

'use client';

import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useState, useCallback } from 'react';
import {
  findStepsMatchingCriteria,
  proposeBulkEdit,
  applyBulkEdit,
  cancelProposal,
  getProposal,
  listPendingProposals,
  formatFindResultSummary,
  formatProposalSummary,
  formatBulkEditResultSummary,
  type StepSearchCriteria,
  type BulkEditType,
  type BulkEditProposal,
  type FindStepsResult,
  type BulkEditResult,
} from './bulkEditTools';
import type { ActionType, Phase } from '../model/types';

/**
 * State for tracking active proposals in the UI
 */
export interface BulkEditState {
  lastFindResult: FindStepsResult | null;
  activeProposal: BulkEditProposal | null;
  lastApplyResult: BulkEditResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to register all bulk edit CopilotKit actions
 *
 * Returns state for UI integration (e.g., showing proposal previews)
 */
export function useBulkEditActions() {
  const [state, setState] = useState<BulkEditState>({
    lastFindResult: null,
    activeProposal: null,
    lastApplyResult: null,
    isLoading: false,
    error: null,
  });

  // Make current bulk edit state readable by the agent
  useCopilotReadable({
    description: 'Current bulk edit state including active proposals',
    value: {
      hasActiveProposal: state.activeProposal !== null,
      activeProposalId: state.activeProposal?.id,
      activeProposalStatus: state.activeProposal?.status,
      activeProposalChanges: state.activeProposal?.totalChanges,
      lastFindMatchCount: state.lastFindResult?.matchCount,
      pendingProposalCount: listPendingProposals().length,
    },
  });

  // ==========================================================================
  // Action: Find Steps by Criteria
  // ==========================================================================
  useCopilotAction({
    name: 'findStepsMatchingCriteria',
    description: `Find steps across all line builds matching specific criteria.
Use this to discover steps that might need bulk editing.
Returns a list of matching steps with their build context.
Supports multiple criteria that are AND-ed together.`,
    parameters: [
      {
        name: 'equipment',
        type: 'string',
        description:
          'Find steps using this equipment (partial match, e.g., "fryer", "waterbath")',
        required: false,
      },
      {
        name: 'actionType',
        type: 'string',
        description:
          'Find steps with this action type: PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, QUALITY_CHECK',
        required: false,
      },
      {
        name: 'timeGreaterThanMinutes',
        type: 'number',
        description: 'Find steps with time greater than this many minutes',
        required: false,
      },
      {
        name: 'timeLessThanMinutes',
        type: 'number',
        description: 'Find steps with time less than this many minutes',
        required: false,
      },
      {
        name: 'phase',
        type: 'string',
        description:
          'Find steps in this phase: PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS',
        required: false,
      },
      {
        name: 'targetName',
        type: 'string',
        description: 'Find steps targeting items with this name (partial match)',
        required: false,
      },
      {
        name: 'station',
        type: 'string',
        description: 'Find steps at this station (partial match)',
        required: false,
      },
      {
        name: 'draftOnly',
        type: 'boolean',
        description: 'Only search draft builds (default: true)',
        required: false,
      },
    ],
    handler: async ({
      equipment,
      actionType,
      timeGreaterThanMinutes,
      timeLessThanMinutes,
      phase,
      targetName,
      station,
      draftOnly = true,
    }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const criteria: StepSearchCriteria = {
          equipment: equipment || undefined,
          actionType: actionType as ActionType | undefined,
          timeGreaterThan: timeGreaterThanMinutes
            ? timeGreaterThanMinutes * 60
            : undefined,
          timeLessThan: timeLessThanMinutes
            ? timeLessThanMinutes * 60
            : undefined,
          phase: phase as Phase | undefined,
          targetName: targetName || undefined,
          station: station || undefined,
          draftOnly,
        };

        const result = await findStepsMatchingCriteria(criteria);
        setState((s) => ({
          ...s,
          lastFindResult: result,
          isLoading: false,
        }));

        return formatFindResultSummary(result);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to find steps';
        setState((s) => ({ ...s, error: errorMsg, isLoading: false }));
        return `Error: ${errorMsg}`;
      }
    },
  });

  // ==========================================================================
  // Action: Propose Bulk Edit
  // ==========================================================================
  useCopilotAction({
    name: 'proposeBulkEdit',
    description: `Propose a bulk edit for steps matching criteria.
This creates a preview of changes WITHOUT applying them.
The user must confirm before changes are applied.
Returns a proposal ID and preview of what would change.`,
    parameters: [
      {
        name: 'equipment',
        type: 'string',
        description: 'Match steps using this equipment (partial match)',
        required: false,
      },
      {
        name: 'actionType',
        type: 'string',
        description:
          'Match steps with this action type: PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, QUALITY_CHECK',
        required: false,
      },
      {
        name: 'timeGreaterThanMinutes',
        type: 'number',
        description: 'Match steps with time greater than this many minutes',
        required: false,
      },
      {
        name: 'phase',
        type: 'string',
        description:
          'Match steps in this phase: PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS',
        required: false,
      },
      {
        name: 'targetName',
        type: 'string',
        description: 'Match steps targeting items with this name (partial match)',
        required: false,
      },
      {
        name: 'editType',
        type: 'string',
        description:
          'Type of edit: updateEquipment, updateTime, updateStation, updatePhase, updateTargetName',
        required: true,
      },
      {
        name: 'newEquipment',
        type: 'string',
        description: 'New equipment value (for updateEquipment)',
        required: false,
      },
      {
        name: 'newStation',
        type: 'string',
        description: 'New station value (for updateStation)',
        required: false,
      },
      {
        name: 'newPhase',
        type: 'string',
        description:
          'New phase value (for updatePhase): PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS',
        required: false,
      },
      {
        name: 'newTargetName',
        type: 'string',
        description: 'New target name (for updateTargetName)',
        required: false,
      },
      {
        name: 'newTimeMinutes',
        type: 'number',
        description: 'New time in minutes (for updateTime)',
        required: false,
      },
      {
        name: 'newTimeType',
        type: 'string',
        description: 'New time type: active or passive (for updateTime)',
        required: false,
      },
    ],
    handler: async ({
      equipment,
      actionType,
      timeGreaterThanMinutes,
      phase,
      targetName,
      editType,
      newEquipment,
      newStation,
      newPhase,
      newTargetName,
      newTimeMinutes,
      newTimeType,
    }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const criteria: StepSearchCriteria = {
          equipment: equipment || undefined,
          actionType: actionType as ActionType | undefined,
          timeGreaterThan: timeGreaterThanMinutes
            ? timeGreaterThanMinutes * 60
            : undefined,
          phase: phase as Phase | undefined,
          targetName: targetName || undefined,
          draftOnly: true, // Always only edit drafts
        };

        // Determine the new value based on edit type
        let newValue: unknown;
        let matchPattern: string | undefined;

        switch (editType as BulkEditType) {
          case 'updateEquipment':
            if (!newEquipment) {
              throw new Error('newEquipment is required for updateEquipment');
            }
            newValue = newEquipment;
            matchPattern = equipment
              ? `equipment containing "${equipment}"`
              : undefined;
            break;

          case 'updateStation':
            if (!newStation) {
              throw new Error('newStation is required for updateStation');
            }
            newValue = newStation;
            break;

          case 'updatePhase':
            if (!newPhase) {
              throw new Error('newPhase is required for updatePhase');
            }
            newValue = newPhase;
            break;

          case 'updateTargetName':
            if (!newTargetName) {
              throw new Error('newTargetName is required for updateTargetName');
            }
            newValue = newTargetName;
            break;

          case 'updateTime':
            if (newTimeMinutes === undefined) {
              throw new Error('newTimeMinutes is required for updateTime');
            }
            newValue = {
              value: newTimeMinutes,
              unit: 'min' as const,
              type: (newTimeType as 'active' | 'passive') || 'active',
            };
            break;

          default:
            throw new Error(`Unknown edit type: ${editType}`);
        }

        const proposal = await proposeBulkEdit(
          criteria,
          editType as BulkEditType,
          newValue,
          matchPattern
        );

        setState((s) => ({
          ...s,
          activeProposal: proposal,
          isLoading: false,
        }));

        return formatProposalSummary(proposal);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to create proposal';
        setState((s) => ({ ...s, error: errorMsg, isLoading: false }));
        return `Error: ${errorMsg}`;
      }
    },
  });

  // ==========================================================================
  // Action: Apply Bulk Edit
  // ==========================================================================
  useCopilotAction({
    name: 'applyBulkEdit',
    description: `Apply a previously proposed bulk edit.
This actually modifies the line builds and records changes in the changelog.
Requires user confirmation before calling.
Returns a summary of what was changed.`,
    parameters: [
      {
        name: 'proposalId',
        type: 'string',
        description:
          'ID of the proposal to apply (from proposeBulkEdit result)',
        required: true,
      },
      {
        name: 'confirmed',
        type: 'boolean',
        description: 'User has confirmed they want to apply this edit',
        required: true,
      },
    ],
    handler: async ({ proposalId, confirmed }) => {
      if (!confirmed) {
        return 'Please confirm you want to apply this bulk edit. Say "yes, apply the changes" to proceed.';
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const result = await applyBulkEdit(proposalId);

        setState((s) => ({
          ...s,
          lastApplyResult: result,
          activeProposal: null, // Clear active proposal after applying
          isLoading: false,
        }));

        return formatBulkEditResultSummary(result);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to apply bulk edit';
        setState((s) => ({ ...s, error: errorMsg, isLoading: false }));
        return `Error: ${errorMsg}`;
      }
    },
  });

  // ==========================================================================
  // Action: Cancel Proposal
  // ==========================================================================
  useCopilotAction({
    name: 'cancelBulkEditProposal',
    description: 'Cancel a pending bulk edit proposal without applying it.',
    parameters: [
      {
        name: 'proposalId',
        type: 'string',
        description: 'ID of the proposal to cancel',
        required: true,
      },
    ],
    handler: async ({ proposalId }) => {
      const success = cancelProposal(proposalId);

      if (success) {
        setState((s) => ({
          ...s,
          activeProposal:
            s.activeProposal?.id === proposalId ? null : s.activeProposal,
        }));
        return `Proposal ${proposalId} has been cancelled.`;
      } else {
        return `Could not cancel proposal ${proposalId}. It may have already been applied or does not exist.`;
      }
    },
  });

  // ==========================================================================
  // Action: List Pending Proposals
  // ==========================================================================
  useCopilotAction({
    name: 'listPendingBulkEdits',
    description:
      'List all pending bulk edit proposals that have not been applied yet.',
    parameters: [],
    handler: async () => {
      const pending = listPendingProposals();

      if (pending.length === 0) {
        return 'No pending bulk edit proposals.';
      }

      let summary = `Found ${pending.length} pending proposal${pending.length !== 1 ? 's' : ''}:\n\n`;

      for (const proposal of pending) {
        summary += `ID: ${proposal.id}\n`;
        summary += `  Created: ${proposal.createdAt}\n`;
        summary += `  Action: ${proposal.editDescription}\n`;
        summary += `  Changes: ${proposal.totalChanges} step${proposal.totalChanges !== 1 ? 's' : ''}\n\n`;
      }

      return summary;
    },
  });

  // ==========================================================================
  // Action: Get Proposal Details
  // ==========================================================================
  useCopilotAction({
    name: 'getBulkEditProposal',
    description: 'Get detailed information about a specific bulk edit proposal.',
    parameters: [
      {
        name: 'proposalId',
        type: 'string',
        description: 'ID of the proposal to retrieve',
        required: true,
      },
    ],
    handler: async ({ proposalId }) => {
      const proposal = getProposal(proposalId);

      if (!proposal) {
        return `Proposal ${proposalId} not found.`;
      }

      return formatProposalSummary(proposal);
    },
  });

  return {
    state,
    clearState: useCallback(() => {
      setState({
        lastFindResult: null,
        activeProposal: null,
        lastApplyResult: null,
        isLoading: false,
        error: null,
      });
    }, []),
  };
}
