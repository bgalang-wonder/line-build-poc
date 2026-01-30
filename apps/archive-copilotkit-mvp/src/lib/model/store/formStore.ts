import { create } from 'zustand';
import { LineBuild, WorkUnit } from '../types';
import { LineBuildPersistence } from '../data/persistence';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Zustand Store for Form State
// ============================================================================

interface FormStore {
  // State
  currentBuild: LineBuild | null;
  isLoading: boolean;
  selectedStepId: string | null;

  // Actions
  setBuild: (build: LineBuild) => void;
  setLoading: (loading: boolean) => void;
  setSelectedStepId: (id: string | null) => void;

  // Form mutations (implement form actions contract)
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

  // Utility
  resetForm: () => void;
}

// Helper to check if build is draft
const isDraft = (build: LineBuild | null): boolean => {
  return build?.metadata?.status === 'draft';
};

// Helper to detect circular dependencies
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

export const useFormStore = create<FormStore>((set, get) => ({
  currentBuild: null,
  isLoading: false,
  selectedStepId: null,

  setBuild: (build: LineBuild) => {
    set({ currentBuild: build });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setSelectedStepId: (id: string | null) => {
    set({ selectedStepId: id });
  },

  addWorkUnit: (input) => {
    const { currentBuild } = get();
    if (!currentBuild) return null;

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      console.error('Cannot add step to active build (demote first)');
      return null;
    }

    // Precondition: required fields
    if (!input.action || !input.targetItemName) {
      console.error('Missing required fields: action, targetItemName');
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

    set({ currentBuild: updated });
    return newStep;
  },

  editWorkUnit: (workUnitId: string, updates: Partial<WorkUnit>) => {
    const { currentBuild } = get();
    if (!currentBuild) return null;

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      console.error('Cannot edit step in active build (demote first)');
      return null;
    }

    // Find step
    const stepIndex = currentBuild.workUnits.findIndex((s) => s.id === workUnitId);
    if (stepIndex === -1) {
      console.error('Step not found');
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

    set({ currentBuild: updated });
    return updatedStep;
  },

  removeWorkUnit: (workUnitId: string) => {
    const { currentBuild } = get();
    if (!currentBuild) return false;

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      console.error('Cannot remove step from active build (demote first)');
      return false;
    }

    // Check exists
    if (!currentBuild.workUnits.find((s) => s.id === workUnitId)) {
      console.error('Step not found');
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

    set({ currentBuild: updated });
    return true;
  },

  setDependencies: (workUnitId: string, dependsOn: string[]) => {
    const { currentBuild } = get();
    if (!currentBuild) return false;

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      console.error('Cannot modify dependencies in active build (demote first)');
      return false;
    }

    // Check step exists
    const step = currentBuild.workUnits.find((s) => s.id === workUnitId);
    if (!step) {
      console.error('Step not found');
      return false;
    }

    // Check all dependencies exist
    for (const depId of dependsOn) {
      if (!currentBuild.workUnits.find((s) => s.id === depId)) {
        console.error(`Dependency ${depId} not found`);
        return false;
      }
    }

    // Check self-reference
    if (dependsOn.includes(workUnitId)) {
      console.error('A step cannot depend on itself');
      return false;
    }

    // Check circular dependencies
    for (const depId of dependsOn) {
      if (hasDependencyPath(currentBuild, depId, workUnitId)) {
        console.error(`Circular dependency detected`);
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

    set({ currentBuild: updated });
    return true;
  },

  changeBOM: (menuItemId: string, menuItemName: string) => {
    const { currentBuild } = get();
    if (!currentBuild) return false;

    // Precondition: must be draft
    if (!isDraft(currentBuild)) {
      console.error('Cannot change BOM of active build (demote first)');
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

    set({ currentBuild: updated, selectedStepId: null });
    return true;
  },

  resetForm: () => {
    set({
      currentBuild: null,
      isLoading: false,
      selectedStepId: null,
    });
  },
}));
