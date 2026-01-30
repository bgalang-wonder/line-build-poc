/**
 * CopilotKit Bulk Edit Tools (for agent-assisted batch modifications)
 *
 * Provides tools for the agent to:
 * 1. Find steps matching criteria across all line builds
 * 2. Propose bulk edits with before/after preview
 * 3. Apply bulk edits with changelog tracking
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LineBuild,
  WorkUnit,
  ActionType,
  Phase,
  ChangelogEntry,
} from '../model/types';
import { getPersistence } from '../model/data/persistence';

// ============================================================================
// Types
// ============================================================================

/**
 * Criteria for finding steps across builds
 */
export interface StepSearchCriteria {
  /** Match steps using specific equipment (e.g., "fryer", "waterbath") */
  equipment?: string;
  /** Match steps with specific action type */
  actionType?: ActionType;
  /** Match steps with time greater than this value (in seconds) */
  timeGreaterThan?: number;
  /** Match steps with time less than this value (in seconds) */
  timeLessThan?: number;
  /** Match steps in specific phase */
  phase?: Phase;
  /** Match steps by target name (partial match) */
  targetName?: string;
  /** Match steps by station */
  station?: string;
  /** Only include draft builds */
  draftOnly?: boolean;
}

/**
 * A matched step with its build context
 */
export interface MatchedStep {
  buildId: string;
  buildName: string;
  buildStatus: 'draft' | 'active';
  stepId: string;
  stepIndex: number;
  action: ActionType;
  targetName: string;
  equipment?: string;
  timeSeconds?: number;
  phase?: Phase;
  station?: string;
}

/**
 * Result of finding steps
 */
export interface FindStepsResult {
  criteria: StepSearchCriteria;
  matches: MatchedStep[];
  totalBuildsSearched: number;
  totalStepsSearched: number;
  matchCount: number;
}

/**
 * Types of edits that can be proposed
 */
export type BulkEditType =
  | 'updateEquipment'
  | 'updateTime'
  | 'updateStation'
  | 'updatePhase'
  | 'updateTargetName';

/**
 * A single field change in a bulk edit
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Preview of a single step edit
 */
export interface StepEditPreview {
  buildId: string;
  buildName: string;
  stepId: string;
  stepIndex: number;
  targetName: string;
  changes: FieldChange[];
}

/**
 * A bulk edit proposal (not yet applied)
 */
export interface BulkEditProposal {
  id: string;
  createdAt: string;
  criteria: StepSearchCriteria;
  editType: BulkEditType;
  editDescription: string;
  /** What value to set for the field being edited */
  newValue: unknown;
  /** Original value pattern being matched (for display) */
  matchPattern?: string;
  previews: StepEditPreview[];
  affectedBuildIds: string[];
  totalChanges: number;
  status: 'pending' | 'applied' | 'cancelled';
}

/**
 * Result of applying a bulk edit
 */
export interface BulkEditResult {
  proposalId: string;
  appliedAt: string;
  successCount: number;
  failureCount: number;
  updatedBuildIds: string[];
  failures: Array<{
    buildId: string;
    stepId: string;
    error: string;
  }>;
}

// ============================================================================
// In-Memory Proposal Store
// ============================================================================

/**
 * Store pending proposals in memory (cleared on server restart)
 * In production, this could be persisted to a database
 */
const proposalStore = new Map<string, BulkEditProposal>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert time to seconds for comparison
 */
function timeToSeconds(time?: WorkUnit['tags']['time']): number | undefined {
  if (!time) return undefined;
  return time.unit === 'min' ? time.value * 60 : time.value;
}

/**
 * Check if a step matches the search criteria
 */
function stepMatchesCriteria(
  step: WorkUnit,
  criteria: StepSearchCriteria
): boolean {
  const { tags } = step;

  // Equipment match (case-insensitive partial match)
  if (criteria.equipment) {
    if (!tags.equipment) return false;
    if (
      !tags.equipment.toLowerCase().includes(criteria.equipment.toLowerCase())
    ) {
      return false;
    }
  }

  // Action type match
  if (criteria.actionType && tags.action !== criteria.actionType) {
    return false;
  }

  // Time thresholds
  const timeSeconds = timeToSeconds(tags.time);
  if (criteria.timeGreaterThan !== undefined) {
    if (timeSeconds === undefined || timeSeconds <= criteria.timeGreaterThan) {
      return false;
    }
  }
  if (criteria.timeLessThan !== undefined) {
    if (timeSeconds === undefined || timeSeconds >= criteria.timeLessThan) {
      return false;
    }
  }

  // Phase match
  if (criteria.phase && tags.phase !== criteria.phase) {
    return false;
  }

  // Target name match (case-insensitive partial match)
  if (criteria.targetName) {
    const targetName = tags.target?.name || '';
    if (!targetName.toLowerCase().includes(criteria.targetName.toLowerCase())) {
      return false;
    }
  }

  // Station match (case-insensitive partial match)
  if (criteria.station) {
    if (!tags.station) return false;
    if (!tags.station.toLowerCase().includes(criteria.station.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Format criteria for display
 */
function formatCriteria(criteria: StepSearchCriteria): string {
  const parts: string[] = [];

  if (criteria.equipment) parts.push(`equipment contains "${criteria.equipment}"`);
  if (criteria.actionType) parts.push(`action = ${criteria.actionType}`);
  if (criteria.timeGreaterThan !== undefined)
    parts.push(`time > ${criteria.timeGreaterThan}s`);
  if (criteria.timeLessThan !== undefined)
    parts.push(`time < ${criteria.timeLessThan}s`);
  if (criteria.phase) parts.push(`phase = ${criteria.phase}`);
  if (criteria.targetName) parts.push(`target contains "${criteria.targetName}"`);
  if (criteria.station) parts.push(`station contains "${criteria.station}"`);
  if (criteria.draftOnly) parts.push('draft builds only');

  return parts.length > 0 ? parts.join(', ') : 'all steps';
}

/**
 * Create a changelog entry for bulk edit
 */
function createBulkEditChangelogEntry(
  proposalId: string,
  editDescription: string,
  affectedStepCount: number
): ChangelogEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    userId: 'current-user', // TODO: Get from auth context
    agentAssisted: true,
    action: 'bulk edit applied',
    details: `${editDescription} (proposal ${proposalId}, ${affectedStepCount} step${affectedStepCount !== 1 ? 's' : ''} modified)`,
  };
}

// ============================================================================
// Core Tool Functions
// ============================================================================

/**
 * Find steps matching criteria across all line builds
 *
 * @param criteria - Search criteria for matching steps
 * @returns Matching steps with their build context
 */
export async function findStepsMatchingCriteria(
  criteria: StepSearchCriteria
): Promise<FindStepsResult> {
  const persistence = getPersistence();
  const allBuilds = await persistence.loadAll();

  const matches: MatchedStep[] = [];
  let totalStepsSearched = 0;

  for (const build of allBuilds) {
    // Skip active builds if draftOnly is true
    if (criteria.draftOnly && build.metadata.status !== 'draft') {
      continue;
    }

    for (let stepIndex = 0; stepIndex < build.workUnits.length; stepIndex++) {
      const step = build.workUnits[stepIndex];
      totalStepsSearched++;

      if (stepMatchesCriteria(step, criteria)) {
        matches.push({
          buildId: build.id,
          buildName: build.menuItemName,
          buildStatus: build.metadata.status,
          stepId: step.id,
          stepIndex,
          action: step.tags.action,
          targetName: step.tags.target?.name || 'Unknown',
          equipment: step.tags.equipment,
          timeSeconds: timeToSeconds(step.tags.time),
          phase: step.tags.phase,
          station: step.tags.station,
        });
      }
    }
  }

  return {
    criteria,
    matches,
    totalBuildsSearched: allBuilds.length,
    totalStepsSearched,
    matchCount: matches.length,
  };
}

/**
 * Propose a bulk edit for steps matching criteria
 * Returns a preview without applying changes
 *
 * @param criteria - Criteria to match steps
 * @param editType - Type of edit to perform
 * @param newValue - New value to set
 * @param matchPattern - Optional description of what's being matched (for display)
 * @returns A proposal with previews of changes
 */
export async function proposeBulkEdit(
  criteria: StepSearchCriteria,
  editType: BulkEditType,
  newValue: unknown,
  matchPattern?: string
): Promise<BulkEditProposal> {
  // First, find all matching steps
  const findResult = await findStepsMatchingCriteria(criteria);

  // Load builds to get current values for preview
  const persistence = getPersistence();
  const buildMap = new Map<string, LineBuild>();

  for (const match of findResult.matches) {
    if (!buildMap.has(match.buildId)) {
      try {
        const result = await persistence.load(match.buildId);
        buildMap.set(match.buildId, result.build);
      } catch (error) {
        console.warn(`Failed to load build ${match.buildId}:`, error);
      }
    }
  }

  // Generate previews
  const previews: StepEditPreview[] = [];
  const affectedBuildIds = new Set<string>();

  for (const match of findResult.matches) {
    const build = buildMap.get(match.buildId);
    if (!build) continue;

    const step = build.workUnits.find((wu) => wu.id === match.stepId);
    if (!step) continue;

    // Skip active builds (can't edit them)
    if (build.metadata.status !== 'draft') continue;

    const changes: FieldChange[] = [];

    switch (editType) {
      case 'updateEquipment':
        if (step.tags.equipment !== newValue) {
          changes.push({
            field: 'equipment',
            oldValue: step.tags.equipment,
            newValue,
          });
        }
        break;

      case 'updateTime':
        // newValue expected as { value: number, unit: 'sec' | 'min', type: 'active' | 'passive' }
        const timeValue = newValue as WorkUnit['tags']['time'];
        if (
          step.tags.time?.value !== timeValue?.value ||
          step.tags.time?.unit !== timeValue?.unit
        ) {
          changes.push({
            field: 'time',
            oldValue: step.tags.time,
            newValue: timeValue,
          });
        }
        break;

      case 'updateStation':
        if (step.tags.station !== newValue) {
          changes.push({
            field: 'station',
            oldValue: step.tags.station,
            newValue,
          });
        }
        break;

      case 'updatePhase':
        if (step.tags.phase !== newValue) {
          changes.push({
            field: 'phase',
            oldValue: step.tags.phase,
            newValue,
          });
        }
        break;

      case 'updateTargetName':
        if (step.tags.target?.name !== newValue) {
          changes.push({
            field: 'target.name',
            oldValue: step.tags.target?.name,
            newValue,
          });
        }
        break;
    }

    if (changes.length > 0) {
      previews.push({
        buildId: match.buildId,
        buildName: match.buildName,
        stepId: match.stepId,
        stepIndex: match.stepIndex,
        targetName: match.targetName,
        changes,
      });
      affectedBuildIds.add(match.buildId);
    }
  }

  // Create edit description
  const editDescriptions: Record<BulkEditType, string> = {
    updateEquipment: `Change equipment to "${newValue}"`,
    updateTime: `Change time to ${JSON.stringify(newValue)}`,
    updateStation: `Change station to "${newValue}"`,
    updatePhase: `Change phase to "${newValue}"`,
    updateTargetName: `Change target name to "${newValue}"`,
  };

  const proposal: BulkEditProposal = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    criteria,
    editType,
    editDescription: editDescriptions[editType],
    newValue,
    matchPattern,
    previews,
    affectedBuildIds: Array.from(affectedBuildIds),
    totalChanges: previews.length,
    status: 'pending',
  };

  // Store the proposal
  proposalStore.set(proposal.id, proposal);

  return proposal;
}

/**
 * Apply a previously created bulk edit proposal
 *
 * @param proposalId - ID of the proposal to apply
 * @returns Result of the bulk edit operation
 */
export async function applyBulkEdit(
  proposalId: string
): Promise<BulkEditResult> {
  const proposal = proposalStore.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  if (proposal.status !== 'pending') {
    throw new Error(
      `Proposal ${proposalId} has already been ${proposal.status}`
    );
  }

  const persistence = getPersistence();
  const appliedAt = new Date().toISOString();
  const updatedBuildIds: string[] = [];
  const failures: BulkEditResult['failures'] = [];

  // Group previews by build ID for efficient processing
  const previewsByBuild = new Map<string, StepEditPreview[]>();
  for (const preview of proposal.previews) {
    const existing = previewsByBuild.get(preview.buildId) || [];
    existing.push(preview);
    previewsByBuild.set(preview.buildId, existing);
  }

  // Process each build
  for (const [buildId, previews] of Array.from(previewsByBuild.entries())) {
    try {
      // Load the build
      const loadResult = await persistence.load(buildId);
      let build = loadResult.build;

      // Verify it's still a draft
      if (build.metadata.status !== 'draft') {
        for (const preview of previews) {
          failures.push({
            buildId,
            stepId: preview.stepId,
            error: 'Build is no longer a draft',
          });
        }
        continue;
      }

      // Apply changes to each step
      let changesApplied = 0;
      const newWorkUnits = build.workUnits.map((step) => {
        const preview = previews.find((p) => p.stepId === step.id);
        if (!preview) return step;

        // Apply each field change
        let updatedStep = { ...step, tags: { ...step.tags } };
        for (const change of preview.changes) {
          switch (change.field) {
            case 'equipment':
              updatedStep.tags.equipment = change.newValue as string;
              break;
            case 'time':
              updatedStep.tags.time = change.newValue as WorkUnit['tags']['time'];
              break;
            case 'station':
              updatedStep.tags.station = change.newValue as string;
              break;
            case 'phase':
              updatedStep.tags.phase = change.newValue as Phase;
              break;
            case 'target.name':
              updatedStep.tags.target = {
                ...updatedStep.tags.target,
                name: change.newValue as string,
              };
              break;
          }
          changesApplied++;
        }

        return updatedStep;
      });

      // Add changelog entry
      const changelogEntry = createBulkEditChangelogEntry(
        proposalId,
        proposal.editDescription,
        changesApplied
      );

      // Update build
      const updatedBuild: LineBuild = {
        ...build,
        workUnits: newWorkUnits,
        metadata: {
          ...build.metadata,
          version: build.metadata.version + 1,
          changelog: [...(build.metadata.changelog || []), changelogEntry],
        },
      };

      // Save
      await persistence.save(updatedBuild);
      updatedBuildIds.push(buildId);
    } catch (error) {
      for (const preview of previews) {
        failures.push({
          buildId,
          stepId: preview.stepId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Update proposal status
  proposal.status = 'applied';
  proposalStore.set(proposalId, proposal);

  return {
    proposalId,
    appliedAt,
    successCount: proposal.previews.length - failures.length,
    failureCount: failures.length,
    updatedBuildIds,
    failures,
  };
}

/**
 * Cancel a pending proposal
 */
export function cancelProposal(proposalId: string): boolean {
  const proposal = proposalStore.get(proposalId);
  if (!proposal || proposal.status !== 'pending') {
    return false;
  }

  proposal.status = 'cancelled';
  proposalStore.set(proposalId, proposal);
  return true;
}

/**
 * Get a proposal by ID
 */
export function getProposal(proposalId: string): BulkEditProposal | undefined {
  return proposalStore.get(proposalId);
}

/**
 * List all pending proposals
 */
export function listPendingProposals(): BulkEditProposal[] {
  return Array.from(proposalStore.values()).filter(
    (p) => p.status === 'pending'
  );
}

/**
 * Clear old proposals (for cleanup)
 */
export function clearOldProposals(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let cleared = 0;

  for (const [id, proposal] of Array.from(proposalStore.entries())) {
    const age = now - new Date(proposal.createdAt).getTime();
    if (age > maxAgeMs) {
      proposalStore.delete(id);
      cleared++;
    }
  }

  return cleared;
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Find all steps using a specific piece of equipment
 */
export async function findStepsByEquipment(
  equipment: string,
  draftOnly: boolean = true
): Promise<FindStepsResult> {
  return findStepsMatchingCriteria({ equipment, draftOnly });
}

/**
 * Find all steps with a specific action type
 */
export async function findStepsByAction(
  actionType: ActionType,
  draftOnly: boolean = true
): Promise<FindStepsResult> {
  return findStepsMatchingCriteria({ actionType, draftOnly });
}

/**
 * Find all steps over a time threshold (in minutes)
 */
export async function findStepsOverTime(
  minutes: number,
  draftOnly: boolean = true
): Promise<FindStepsResult> {
  return findStepsMatchingCriteria({
    timeGreaterThan: minutes * 60,
    draftOnly,
  });
}

/**
 * Propose changing equipment for all matching steps
 */
export async function proposeEquipmentChange(
  fromEquipment: string,
  toEquipment: string
): Promise<BulkEditProposal> {
  return proposeBulkEdit(
    { equipment: fromEquipment, draftOnly: true },
    'updateEquipment',
    toEquipment,
    `equipment containing "${fromEquipment}"`
  );
}

/**
 * Propose changing station for all steps with a specific action
 */
export async function proposeStationChangeByAction(
  actionType: ActionType,
  newStation: string
): Promise<BulkEditProposal> {
  return proposeBulkEdit(
    { actionType, draftOnly: true },
    'updateStation',
    newStation,
    `${actionType} steps`
  );
}

// ============================================================================
// Summary/Report Functions
// ============================================================================

/**
 * Generate a human-readable summary of a find result
 */
export function formatFindResultSummary(result: FindStepsResult): string {
  const { criteria, matches, totalBuildsSearched, totalStepsSearched, matchCount } = result;

  let summary = `Found ${matchCount} step${matchCount !== 1 ? 's' : ''} matching: ${formatCriteria(criteria)}\n`;
  summary += `(Searched ${totalStepsSearched} steps across ${totalBuildsSearched} builds)\n\n`;

  if (matches.length === 0) {
    summary += 'No matching steps found.';
    return summary;
  }

  // Group by build
  const byBuild = new Map<string, MatchedStep[]>();
  for (const match of matches) {
    const existing = byBuild.get(match.buildId) || [];
    existing.push(match);
    byBuild.set(match.buildId, existing);
  }

  for (const [_buildId, steps] of Array.from(byBuild.entries())) {
    const first = steps[0];
    summary += `[${first.buildName}] (${first.buildStatus}):\n`;
    for (const step of steps) {
      summary += `  - Step ${step.stepIndex + 1}: ${step.action} ${step.targetName}`;
      if (step.equipment) summary += ` (${step.equipment})`;
      if (step.timeSeconds) summary += ` [${step.timeSeconds}s]`;
      summary += '\n';
    }
    summary += '\n';
  }

  return summary;
}

/**
 * Generate a human-readable summary of a proposal
 */
export function formatProposalSummary(proposal: BulkEditProposal): string {
  let summary = `Bulk Edit Proposal: ${proposal.id}\n`;
  summary += `Created: ${proposal.createdAt}\n`;
  summary += `Status: ${proposal.status}\n\n`;
  summary += `Action: ${proposal.editDescription}\n`;
  if (proposal.matchPattern) {
    summary += `Matching: ${proposal.matchPattern}\n`;
  }
  summary += `Criteria: ${formatCriteria(proposal.criteria)}\n\n`;
  summary += `Total changes: ${proposal.totalChanges} step${proposal.totalChanges !== 1 ? 's' : ''} in ${proposal.affectedBuildIds.length} build${proposal.affectedBuildIds.length !== 1 ? 's' : ''}\n\n`;

  summary += 'Preview of changes:\n';
  for (const preview of proposal.previews.slice(0, 10)) {
    summary += `  [${preview.buildName}] Step ${preview.stepIndex + 1} (${preview.targetName}):\n`;
    for (const change of preview.changes) {
      summary += `    ${change.field}: "${change.oldValue}" -> "${change.newValue}"\n`;
    }
  }

  if (proposal.previews.length > 10) {
    summary += `  ... and ${proposal.previews.length - 10} more changes\n`;
  }

  return summary;
}

/**
 * Generate a human-readable summary of a bulk edit result
 */
export function formatBulkEditResultSummary(result: BulkEditResult): string {
  let summary = `Bulk Edit Result for proposal ${result.proposalId}\n`;
  summary += `Applied at: ${result.appliedAt}\n\n`;
  summary += `Success: ${result.successCount} change${result.successCount !== 1 ? 's' : ''}\n`;
  summary += `Failures: ${result.failureCount}\n`;
  summary += `Updated builds: ${result.updatedBuildIds.length}\n`;

  if (result.failures.length > 0) {
    summary += '\nFailures:\n';
    for (const failure of result.failures) {
      summary += `  - Build ${failure.buildId}, Step ${failure.stepId}: ${failure.error}\n`;
    }
  }

  return summary;
}
