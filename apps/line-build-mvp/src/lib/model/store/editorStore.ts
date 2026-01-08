'use client';

import { create } from 'zustand';
import { LineBuild, WorkUnit, BuildValidationStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { stateSnapshotManager } from '@/lib/error/errorRecovery';
import { scoreLineBuild } from '@/lib/scoring/complexityEngine';

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

  // ========== UI STATE ==========
  isLoading: boolean;
  error: string | null;
  lastErrorTime?: string; // Track when error occurred for recovery UI

  // ========== FORM ACTIONS ==========
  setBuild: (build: LineBuild) => void;
  setSelectedStepId: (id: string | null) => void;

  // Form mutations
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
  }) => WorkUnit | null;

  editWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>) => WorkUnit | null;
  removeWorkUnit: (workUnitId: string) => boolean;
  setDependencies: (workUnitId: string, dependsOn: string[]) => boolean;
  changeBOM: (menuItemId: string, menuItemName: string) => boolean;

  // ========== CHAT ACTIONS ==========
  addChatMessage: (role: 'user' | 'assistant' | 'system', content: string) => ChatMessage;
  clearChatHistory: () => void;

  // ========== VALIDATION ACTIONS ==========
  setValidationStatus: (status: BuildValidationStatus) => void;
  setValidationRunning: (running: boolean) => void;
  clearValidationResults: () => void;

  // ========== COMPLEXITY SCORING ==========
  updateComplexity: () => void; // Recompute and update complexity score

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
  isLoading: false,
  error: null,

  // ========== FORM ACTIONS ==========

  setBuild: (build: LineBuild) => {
    set({ currentBuild: build, error: null });
  },

  setSelectedStepId: (id: string | null) => {
    set({ selectedStepId: id });
  },

  addWorkUnit: (input) => {
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

    // Update state
    const updated: LineBuild = {
      ...currentBuild,
      workUnits: [...currentBuild.workUnits, newStep],
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation (user must re-validate)
    get().clearValidationResults();
    return newStep;
  },

  editWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>) => {
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

    // Merge updates
    const updatedStep: WorkUnit = {
      ...currentBuild.workUnits[stepIndex],
      ...updates,
      tags: {
        ...currentBuild.workUnits[stepIndex].tags,
        ...(updates.tags || {}),
      },
    };

    // Update state
    const newWorkUnits = [...currentBuild.workUnits];
    newWorkUnits[stepIndex] = updatedStep;

    const updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return updatedStep;
  },

  removeWorkUnit: (workUnitId: string) => {
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

    // Check exists
    if (!currentBuild.workUnits.find((s) => s.id === workUnitId)) {
      set({ error: 'Step not found' });
      return false;
    }

    // Remove and clean up dependencies
    const newWorkUnits = currentBuild.workUnits
      .filter((s) => s.id !== workUnitId)
      .map((s) => ({
        ...s,
        dependsOn: s.dependsOn.filter((dep) => dep !== workUnitId),
      }));

    const updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };

    set({ currentBuild: updated, selectedStepId: null, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return true;
  },

  setDependencies: (workUnitId: string, dependsOn: string[]) => {
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

    // Update step
    const stepIndex = currentBuild.workUnits.findIndex((s) => s.id === workUnitId);
    const newWorkUnits = [...currentBuild.workUnits];
    newWorkUnits[stepIndex] = {
      ...newWorkUnits[stepIndex],
      dependsOn,
    };

    const updated: LineBuild = {
      ...currentBuild,
      workUnits: newWorkUnits,
      metadata: {
        ...currentBuild.metadata,
        version: (currentBuild.metadata?.version || 0) + 1,
      },
    };

    set({ currentBuild: updated, error: null });
    // Clear validation results on mutation
    get().clearValidationResults();
    return true;
  },

  changeBOM: (menuItemId: string, menuItemName: string) => {
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

    // Update state: new BOM, clear steps, reset to draft
    const updated: LineBuild = {
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
