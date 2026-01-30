/**
 * CopilotKit Tools and Actions
 *
 * This module provides all CopilotKit integrations for the Line Build MVP:
 * - Search tools for finding line builds
 * - Bulk edit tools for batch modifications
 * - Form actions for individual edits
 * - React hooks for registering actions
 */

// Search tools
export {
  searchLineBuilds,
  filterLineBuildsByStatus,
  filterLineBuildsbyAction,
  filterLineBuildsbyPhase,
  filterLineBuildsbyAuthor,
  getSearchFacets,
  type LineBuildsSearchResult,
} from './searchTools';

// Bulk edit tools
export {
  findStepsMatchingCriteria,
  proposeBulkEdit,
  applyBulkEdit,
  cancelProposal,
  getProposal,
  listPendingProposals,
  clearOldProposals,
  findStepsByEquipment,
  findStepsByAction,
  findStepsOverTime,
  proposeEquipmentChange,
  proposeStationChangeByAction,
  formatFindResultSummary,
  formatProposalSummary,
  formatBulkEditResultSummary,
  type StepSearchCriteria,
  type MatchedStep,
  type FindStepsResult,
  type BulkEditType,
  type FieldChange,
  type StepEditPreview,
  type BulkEditProposal,
  type BulkEditResult,
} from './bulkEditTools';

// Form actions
export { useCopilotFormActions } from './formActions';

// Bulk edit React hook
export { useBulkEditActions, type BulkEditState } from './useBulkEditActions';

// Chat integration
export {
  ChatIntegrationService,
  getChatIntegrationService,
  type ChatInterpretation,
  type WorkUnitSuggestion,
} from './chatIntegrationService';
