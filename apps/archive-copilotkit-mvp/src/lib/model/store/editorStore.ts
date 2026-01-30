'use client';

import { create } from 'zustand';
import { LineBuild, WorkUnit, BuildValidationStatus, ScenarioContext, ResolvedWorkUnit, ChangelogEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { stateSnapshotManager } from '@/lib/error/errorRecovery';
import { scoreLineBuild } from '@/lib/scoring/complexityEngine';
import { resolveWorkUnits, diffScenarios } from '../resolver';

// ============================================================================
// Chat Message Types (shared with ChatPanel)
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
}

// ============================================================================
// Validation State Types
// ============================================================================

export interface ValidationSnapshot {
  timestamp: string; // ISO 8601 - when validation was last run
  status: BuildValidationStatus | null; // null = never validated
  isRunning: boolean;
}

// ============================================================================
// Resolver State Types
// ============================================================================

export interface ResolverState {
  context: ScenarioContext | null; // Current scenario being previewed
  baseResolved: ResolvedWorkUnit[] | null; // Current build resolved (baseline)
  scenarioResolved: ResolvedWorkUnit[] | null; // Alternate scenario resolved
  diffs: Record<string, any> | null; // Diff between base and scenario
}

// ============================================================================
// Editor Store Interface (unified state for all 3 panels)
// ============================================================================

export interface EditorStore {
  // ========== FORM STATE ==========
  currentBuild: LineBuild | null;
  selectedStepId: string | null;

  // ========== CHAT STATE ==========
  chatMessages: ChatMessage[];

  // ========== VALIDATION STATE ==========
  validationSnapshot: ValidationSnapshot;

  // ========== RESOLVER STATE (P1.6 Overlays) ==========
  resolverState: ResolverState;

  // ========== UI STATE ==========
  isLoading: boolean;
  error: string | null;
  lastErrorTime?: string; // Track when error occurred for recovery UI

  // ========== FORM ACTIONS ==========
  setBuild: (build: LineBuild) => void;
  setSelectedStepId: (id: string | null) => void;

  // Form mutations (all accept optional agentAssisted flag for changelog)
  addWorkUnit: (input: {
    action: string;
    targetItemName: string;
    bomId?: string;
    equipment?: string;
    time?: { value: number; unit: 'sec' | 'min'; type: 'active' | 'passive' };
    phase?: string;
    station?: string;
    timingMode?: string;
    requiresOrder?: boolean;
    prepType?: string;
    storageLocation?: string;
    bulkPrep?: boolean;
    dependsOn?: string[];
  }, agentAssisted?: boolean) => WorkUnit | null;

  editWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>, agentAssisted?: boolean) => WorkUnit | null;
  removeWorkUnit: (workUnitId: string, agentAssisted?: boolean) => boolean;
  reorderWorkUnits: (fromIndex: number, toIndex: number, agentAssisted?: boolean) => boolean;
  setDependencies: (workUnitId: string, dependsOn: string[], agentAssisted?: boolean) => boolean;
  changeBOM: (menuItemId: string, menuItemName: string, agentAssisted?: boolean) => boolean;

  // ========== CHAT ACTIONS ==========
  addChatMessage: (role: 'user' | 'assistant' | 'system', content: string) => ChatMessage;
  clearChatHistory: () => void;

  // ========== VALIDATION ACTIONS ==========
  setValidationStatus: (status: BuildValidationStatus) => void;
  setValidationRunning: (running: boolean) => void;
  clearValidationResults: () => void;

  // ========== COMPLEXITY SCORING ==========
  updateComplexity: () => void; // Recompute and update complexity score

  // ========== RESOLVER ACTIONS (P1.6) ==========
  setResolverContext: (context: ScenarioContext) => void; // Set active scenario for preview
  resolveForScenario: (context: ScenarioContext) => void; // Resolve base and scenario, compute diffs
  clearResolverState: () => void; // Clear resolver preview

  // ========== UTIL ==========
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // ========== ERROR RECOVERY ACTIONS ==========
  restoreFromSnapshot: () => boolean; // Returns true if restored, false if no snapshot
  clearError: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const isDraft = (build: LineBuild | null): boolean => {
  return build?.metadata?.status === 'draft';
};

/**
 * Creates a changelog entry for audit trail
 */
const createChangelogEntry = (
  action: string,
  agentAssisted: boolean,
  details?: string
): ChangelogEntry => ({
  id: uuidv4(),
  timestamp: new Date().toISOString(),
  userId: 'current-user', // TODO: Get from auth context when available
  agentAssisted,
  action,
  details,
});

/**
 * Appends a changelog entry to the build's metadata
 */
const appendChangelog = (
  build: LineBuild,
  entry: ChangelogEntry
): LineBuild => ({
  ...build,
  metadata: {
    ...build.metadata,
    changelog: [...(build.metadata.changelog || []), entry],
  },
});

const hasDependencyPath = (
  build: LineBuild,
  from: string,
  to: string,
  visited: Set<string> = new Set()
): boolean => {
  if (visited.has(from)) return false;
  visited.add(from);

  const step = build.workUnits.find((s) => s.id === from);
  if (!step) return false;

  if (step.dependsOn.includes(to)) return true;

  for (const depId of step.dependsOn) {
    if (hasDependencyPath(build, depId, to, visited)) {
      return true;
    }
  }

  return false;
};

// ============================================================================
// Zustand Store Creation
// ============================================================================

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Initial state
  currentBuild: null,
  selectedStepId: null,
  chatMessages: [],
  validationSnapshot: {
    timestamp: new Date().toISOString(),
    status: null,
    isRunning: false,
  },
  resolverState: {
    context: null,
    baseResolved: null,
    scenarioResolved: null,
    diffs: null,
  },
  isLoading: false,
  error: null,

  // ========== FORM ACTIONS ==========

  setBuild: (build: LineBuild) => {
    set({ currentBuild: build, error: null });
  },

  setSelectedStepId: (id: string | null) => {
    set({ selectedStepId: id });
  },

  addWorkUnit: (input, agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return null;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot add step to active build (demote first)' });
      return null;
    }

    // Precondition: required fields
    if (!input.action || !input.targetItemName) {
      set({ error: 'Missing required fields: action, targetItemName' });
      return null;
    }

    // Create new WorkUnit
    const newStep: WorkUnit = {
      id: uuidv4(),
      tags: {
        action: input.action as any,
        target: { bomId: input.bomId, name: input.targetItemName },
        equipment: input.equipment,
        time: input.time,
        phase: input.phase as any,
        station: input.station,
        timingMode: input.timingMode as any,
        requiresOrder: input.requiresOrder,
        prepType: input.prepType as any,
        storageLocation: input.storageLocation,
        bulkPrep: input.bulkPrep,
      },
      dependsOn: input.dependsOn || [],
    };

    // Create changelog entry
    const changelogEntry = createChangelogEntry(
      'added step',
      agentAssisted,
      `Added ${input.action} step: ${input.targetItemName}`
    );

    // Update state with changelog
    let updated: LineBuild = {
      ...currentBuild,
      workUnits: [...currentBuild.workUnits, newStep],
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation (user must re-validate)
    get().clearValidationResults();
    return newStep;
  },

  editWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>, agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return null;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot edit step in active build (demote first)' });
      return null;
    }

    // Find step
    const stepIndex = currentBuild.workUnits.findIndex((s) => s.id === workUnitId);
    if (stepIndex === -1) {
      set({ error: 'Step not found' });
      return null;
    }

    const originalStep = currentBuild.workUnits[stepIndex];

    // Merge updates
    const updatedStep: WorkUnit = {
      ...originalStep,
      ...updates,
      tags: {
        ...originalStep.tags,
        ...(updates.tags || {}),
      },
    };

    // Create changelog entry with details about what changed
    const changelogEntry = createChangelogEntry(
      `edited step ${originalStep.tags.target.name || workUnitId}`,
      agentAssisted,
      `Modified step: ${originalStep.tags.action} ${originalStep.tags.target.name}`
    );

    // Update state
    const newWorkUnits = [...currentBuild.workUnits];
    newWorkUnits[stepIndex] = updatedStep;

    let updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return updatedStep;
  },

  removeWorkUnit: (workUnitId: string, agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return false;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot remove step from active build (demote first)' });
      return false;
    }

    // Check exists and get info for changelog
    const removedStep = currentBuild.workUnits.find((s) => s.id === workUnitId);
    if (!removedStep) {
      set({ error: 'Step not found' });
      return false;
    }

    // Create changelog entry before removal
    const changelogEntry = createChangelogEntry(
      'deleted step',
      agentAssisted,
      `Removed step: ${removedStep.tags.action} ${removedStep.tags.target.name}`
    );

    // Remove and clean up dependencies
    const newWorkUnits = currentBuild.workUnits
      .filter((s) => s.id !== workUnitId)
      .map((s) => ({
        ...s,
        dependsOn: s.dependsOn.filter((dep) => dep !== workUnitId),
      }));

    let updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, selectedStepId: null, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return true;
  },

  reorderWorkUnits: (fromIndex: number, toIndex: number, agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return false;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot reorder steps in active build (demote first)' });
      return false;
    }

    // Validate indices
    const { workUnits } = currentBuild;
    if (
      fromIndex < 0 ||
      fromIndex >= workUnits.length ||
      toIndex < 0 ||
      toIndex >= workUnits.length
    ) {
      set({ error: 'Invalid reorder indices' });
      return false;
    }

    // No-op if same position
    if (fromIndex === toIndex) {
      return true;
    }

    // Reorder array: remove from old position, insert at new position
    const newWorkUnits = [...workUnits];
    const [movedItem] = newWorkUnits.splice(fromIndex, 1);
    newWorkUnits.splice(toIndex, 0, movedItem);

    // Create changelog entry
    const changelogEntry = createChangelogEntry(
      'reordered steps',
      agentAssisted,
      `Moved step from position ${fromIndex + 1} to ${toIndex + 1}`
    );

    let updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return true;
  },

  setDependencies: (workUnitId: string, dependsOn: string[], agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return false;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot modify dependencies in active build (demote first)' });
      return false;
    }

    // Check step exists
    const step = currentBuild.workUnits.find((s) => s.id === workUnitId);
    if (!step) {
      set({ error: 'Step not found' });
      return false;
    }

    // Check all dependencies exist
    for (const depId of dependsOn) {
      if (!currentBuild.workUnits.find((s) => s.id === depId)) {
        set({ error: `Dependency ${depId} not found` });
        return false;
      }
    }

    // Check self-reference
    if (dependsOn.includes(workUnitId)) {
      set({ error: 'A step cannot depend on itself' });
      return false;
    }

    // Check circular dependencies
    for (const depId of dependsOn) {
      if (hasDependencyPath(currentBuild, depId, workUnitId)) {
        set({ error: 'Circular dependency detected' });
        return false;
      }
    }

    // Create changelog entry
    const changelogEntry = createChangelogEntry(
      'updated dependencies',
      agentAssisted,
      `Updated dependencies for step: ${step.tags.action} ${step.tags.target.name}`
    );

    // Update step
    const stepIndex = currentBuild.workUnits.findIndex((s) => s.id === workUnitId);
    const newWorkUnits = [...currentBuild.workUnits];
    newWorkUnits[stepIndex] = {
      ...newWorkUnits[stepIndex],
      dependsOn,
    };

    let updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return true;
  },

  changeBOM: (menuItemId: string, menuItemName: string, agentAssisted = false) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded' });
      return false;
    }

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      set({ error: 'Cannot change BOM of active build (demote first)' });
      return false;
    }

    // Create changelog entry
    const changelogEntry = createChangelogEntry(
      'changed menu item',
      agentAssisted,
      `Changed menu item from "${currentBuild.menuItemName}" to "${menuItemName}"`
    );

    // Update state: new BOM, clear steps, reset to draft
    let updated: LineBuild = {
      ...currentBuild,
      menuItemId,
      menuItemName,
      workUnits: [], // Clear all steps
      metadata: {
        ...currentBuild.metadata,
        status: 'draft',
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };
    updated = appendChangelog(updated, changelogEntry);

    set({ currentBuild: updated, selectedStepId: null, error: null });
    // Clear validation results on BOM change
    get().clearValidationResults();
    return true;
  },

  // ========== CHAT ACTIONS ==========

  addChatMessage: (role: 'user' | 'assistant' | 'system', content: string) => {
    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, message],
      error: null,
    }));

    return message;
  },

  clearChatHistory: () => {
    set({ chatMessages: [] });
  },

  // ========== VALIDATION ACTIONS ==========

  setValidationStatus: (status: BuildValidationStatus) => {
    set({
      validationSnapshot: {
        timestamp: new Date().toISOString(),
        status,
        isRunning: false,
      },
      error: null,
    });
  },

  setValidationRunning: (running: boolean) => {
    set((state) => ({
      validationSnapshot: {
        ...state.validationSnapshot,
        isRunning: running,
      },
    }));
  },

  clearValidationResults: () => {
    set((state) => ({
      validationSnapshot: {
        ...state.validationSnapshot,
        status: null,
      },
    }));
  },

  // ========== COMPLEXITY SCORING ==========

  updateComplexity: () => {
    const { currentBuild } = get();
    if (!currentBuild) {
      return;
    }

    try {
      const complexityScore = scoreLineBuild(currentBuild);
      const updated: LineBuild = {
        ...currentBuild,
        complexity: complexityScore,
      };
      set({ currentBuild: updated });
    } catch (error) {
      // Silently fail - complexity scoring is non-critical
      console.error('Failed to update complexity score:', error);
    }
  },

  // ========== UTIL ACTIONS ==========

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ 
      error,
      lastErrorTime: error ? new Date().toISOString() : undefined,
    });
  },

  // ========== ERROR RECOVERY ACTIONS ==========

  restoreFromSnapshot: () => {
    const snapshot = stateSnapshotManager.getSnapshot();
    if (snapshot) {
      set({
        currentBuild: snapshot.build,
        error: null,
        lastErrorTime: undefined,
      });
      stateSnapshotManager.clear();
      return true;
    }
    return false;
  },

  clearError: () => {
    set({ error: null, lastErrorTime: undefined });
  },

  // ========== RESOLVER ACTIONS (P1.6) ==========

  setResolverContext: (context: ScenarioContext) => {
    set((state) => ({
      resolverState: {
        ...state.resolverState,
        context,
      },
    }));
  },

  resolveForScenario: (context: ScenarioContext) => {
    const { currentBuild } = get();
    if (!currentBuild) {
      set({ error: 'No build loaded for resolution' });
      return;
    }

    try {
      // Resolve base scenario (current build with no overlays)
      const baseContext: ScenarioContext = {
        equipmentProfileId: '',
        capabilities: [],
        selectedCustomizationValueIds: [],
        customizationCount: 0,
      };
      const baseResolved = resolveWorkUnits(currentBuild.workUnits, baseContext);

      // Resolve alternate scenario
      const scenarioResolved = resolveWorkUnits(currentBuild.workUnits, context);

      // Compute diffs
      const diffs = diffScenarios(baseResolved, scenarioResolved);

      set((state) => ({
        resolverState: {
          ...state.resolverState,
          context,
          baseResolved,
          scenarioResolved,
          diffs,
        },
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve scenario';
      set({ error: `Resolver error: ${message}` });
    }
  },

  clearResolverState: () => {
    set({
      resolverState: {
        context: null,
        baseResolved: null,
        scenarioResolved: null,
        diffs: null,
      },
    });
  },

  reset: () => {
    set({
      currentBuild: null,
      selectedStepId: null,
      chatMessages: [],
      validationSnapshot: {
        timestamp: new Date().toISOString(),
        status: null,
        isRunning: false,
      },
      resolverState: {
        context: null,
        baseResolved: null,
        scenarioResolved: null,
        diffs: null,
      },
      isLoading: false,
      error: null,
      lastErrorTime: undefined,
    });
  },
}));

// ============================================================================
// Backward Compatibility: Export formStore as alias
// ============================================================================
// For components still using useFormStore, re-export from editorStore
export const useFormStore = useEditorStore;
