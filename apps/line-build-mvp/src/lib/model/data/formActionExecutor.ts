import {
  FormActionInput,
  ActionResult,
  AddWorkUnitInput,
  EditWorkUnitInput,
  RemoveWorkUnitInput,
  SetDependenciesInput,
  ChangeBOMInput,
} from './formActionsContract';
import { LineBuild, WorkUnit } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { MOCK_BOM_CATALOG, findBOMItem } from './mockBom';

// ============================================================================
// Form Action Executor
// ============================================================================

/**
 * FormActionExecutor: Executes form actions according to the contract
 * Handles validation, state mutations, and error reporting
 *
 * Used by CopilotKit actions to safely update form state
 * All methods are pure (don't modify original build, return new build)
 */
export class FormActionExecutor {
  /**
   * Check if build is draft (editable)
   */
  private static isDraft(build: LineBuild | null): boolean {
    return build?.metadata?.status === 'draft';
  }

  /**
   * Detect circular dependencies using graph traversal
   */
  private static hasDependencyPath(
    build: LineBuild,
    from: string,
    to: string,
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(from)) return false;
    visited.add(from);

    const step = build.workUnits.find((s) => s.id === from);
    if (!step) return false;

    if (step.dependsOn.includes(to)) return true;

    for (const depId of step.dependsOn) {
      if (this.hasDependencyPath(build, depId, to, visited)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Execute a form action and return result
   */
  static execute(action: FormActionInput, currentBuild: LineBuild): ActionResult {
    try {
      switch (action.type) {
        case 'addWorkUnit':
          return this.executeAddWorkUnit(action, currentBuild);
        case 'editWorkUnit':
          return this.executeEditWorkUnit(action, currentBuild);
        case 'removeWorkUnit':
          return this.executeRemoveWorkUnit(action, currentBuild);
        case 'setDependencies':
          return this.executeSetDependencies(action, currentBuild);
        case 'changeBOM':
          return this.executeChangeBOM(action, currentBuild);
        default:
          return {
            status: 'error',
            message: 'Unknown action type',
            reason: `Action type not recognized`,
          };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        status: 'error',
        message: 'Action execution failed',
        reason: errorMsg,
      };
    }
  }

  // ========================================================================
  // ACTION 1: addWorkUnit
  // ========================================================================

  private static executeAddWorkUnit(input: FormActionInput & AddWorkUnitInput, build: LineBuild): ActionResult {
    // Precondition: draft status
    if (!this.isDraft(build)) {
      return {
        status: 'error',
        message: 'Cannot add step to active build (demote first)',
        reason: 'Build must be in draft status',
      };
    }

    // Precondition: required fields
    if (!input.action || !input.targetItemName) {
      return {
        status: 'error',
        message: 'Missing required fields',
        reason: 'action and targetItemName are required',
      };
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

    // Create updated build
    const updatedBuild: LineBuild = {
      ...build,
      workUnits: [...build.workUnits, newStep],
      metadata: {
        ...build.metadata,
        version: (build.metadata?.version || 0) + 1,
      },
    };

    return {
      status: 'success',
      message: `Added new step: ${input.action} on ${input.targetItemName}`,
      updatedBuild,
    };
  }

  // ========================================================================
  // ACTION 2: editWorkUnit
  // ========================================================================

  private static executeEditWorkUnit(input: FormActionInput & EditWorkUnitInput, build: LineBuild): ActionResult {
    // Precondition: draft status
    if (!this.isDraft(build)) {
      return {
        status: 'error',
        message: 'Cannot edit step in active build (demote first)',
        reason: 'Build must be in draft status',
      };
    }

    // Find step
    const stepIndex = build.workUnits.findIndex((s) => s.id === input.workUnitId);
    if (stepIndex === -1) {
      return {
        status: 'error',
        message: 'Step not found',
        reason: `WorkUnit ${input.workUnitId} does not exist`,
      };
    }

    // Prevent ID modification
    if ('id' in input.updates) {
      return {
        status: 'error',
        message: 'Cannot modify step ID',
        reason: 'ID field is immutable',
      };
    }

    // Merge updates with existing step
    const currentStep = build.workUnits[stepIndex];
    const updatedStep: WorkUnit = {
      id: currentStep.id,
      dependsOn: input.updates.dependsOn ?? currentStep.dependsOn,
      tags: {
        action: (input.updates.action ?? currentStep.tags.action) as any,
        target: {
          bomId: input.updates.bomId ?? currentStep.tags.target.bomId,
          name: input.updates.targetItemName ?? currentStep.tags.target.name,
        },
        equipment: input.updates.equipment ?? currentStep.tags.equipment,
        time: input.updates.time ?? currentStep.tags.time,
        phase: (input.updates.phase ?? currentStep.tags.phase) as any,
        station: input.updates.station ?? currentStep.tags.station,
        timingMode: (input.updates.timingMode ?? currentStep.tags.timingMode) as any,
        requiresOrder: input.updates.requiresOrder ?? currentStep.tags.requiresOrder,
        prepType: (input.updates.prepType ?? currentStep.tags.prepType) as any,
        storageLocation: input.updates.storageLocation ?? currentStep.tags.storageLocation,
        bulkPrep: input.updates.bulkPrep ?? currentStep.tags.bulkPrep,
      },
    };

    // Create new workUnits array
    const newWorkUnits = [...build.workUnits];
    newWorkUnits[stepIndex] = updatedStep;

    // Create updated build
    const updatedBuild: LineBuild = {
      ...build,
      workUnits: newWorkUnits,
      metadata: {
        ...build.metadata,
        version: (build.metadata?.version || 0) + 1,
      },
    };

    return {
      status: 'success',
      message: `Updated step ${input.workUnitId}`,
      updatedBuild,
    };
  }

  // ========================================================================
  // ACTION 3: removeWorkUnit
  // ========================================================================

  private static executeRemoveWorkUnit(input: FormActionInput & RemoveWorkUnitInput, build: LineBuild): ActionResult {
    // Precondition: draft status
    if (!this.isDraft(build)) {
      return {
        status: 'error',
        message: 'Cannot remove step from active build (demote first)',
        reason: 'Build must be in draft status',
      };
    }

    // Check exists
    if (!build.workUnits.find((s) => s.id === input.workUnitId)) {
      return {
        status: 'error',
        message: 'Step not found',
        reason: `WorkUnit ${input.workUnitId} does not exist`,
      };
    }

    // Remove and clean up dependencies
    const newWorkUnits = build.workUnits
      .filter((s) => s.id !== input.workUnitId)
      .map((s) => ({
        ...s,
        dependsOn: s.dependsOn.filter((dep) => dep !== input.workUnitId),
      }));

    // Create updated build
    const updatedBuild: LineBuild = {
      ...build,
      workUnits: newWorkUnits,
      metadata: {
        ...build.metadata,
        version: (build.metadata?.version || 0) + 1,
      },
    };

    return {
      status: 'success',
      message: `Removed step ${input.workUnitId}`,
      updatedBuild,
    };
  }

  // ========================================================================
  // ACTION 4: setDependencies
  // ========================================================================

  private static executeSetDependencies(input: FormActionInput & SetDependenciesInput, build: LineBuild): ActionResult {
    // Precondition: draft status
    if (!this.isDraft(build)) {
      return {
        status: 'error',
        message: 'Cannot modify dependencies in active build (demote first)',
        reason: 'Build must be in draft status',
      };
    }

    // Check step exists
    const step = build.workUnits.find((s) => s.id === input.workUnitId);
    if (!step) {
      return {
        status: 'error',
        message: 'Step not found',
        reason: `WorkUnit ${input.workUnitId} does not exist`,
      };
    }

    // Check all dependencies exist
    for (const depId of input.dependsOn) {
      if (!build.workUnits.find((s) => s.id === depId)) {
        return {
          status: 'error',
          message: `Dependency ${depId} not found`,
          reason: `WorkUnit ${depId} does not exist in build`,
        };
      }
    }

    // Check self-reference
    if (input.dependsOn.includes(input.workUnitId)) {
      return {
        status: 'error',
        message: 'A step cannot depend on itself',
        reason: 'Self-referential dependency detected',
      };
    }

    // Check circular dependencies
    for (const depId of input.dependsOn) {
      if (this.hasDependencyPath(build, depId, input.workUnitId)) {
        return {
          status: 'error',
          message: 'Circular dependency detected',
          reason: `Adding this dependency would create a cycle`,
        };
      }
    }

    // Update step
    const stepIndex = build.workUnits.findIndex((s) => s.id === input.workUnitId);
    const newWorkUnits = [...build.workUnits];
    newWorkUnits[stepIndex] = {
      ...newWorkUnits[stepIndex],
      dependsOn: input.dependsOn,
    };

    // Create updated build
    const updatedBuild: LineBuild = {
      ...build,
      workUnits: newWorkUnits,
      metadata: {
        ...build.metadata,
        version: (build.metadata?.version || 0) + 1,
      },
    };

    return {
      status: 'success',
      message: `Updated dependencies for step ${input.workUnitId}`,
      updatedBuild,
    };
  }

  // ========================================================================
  // ACTION 5: changeBOM
  // ========================================================================

  private static executeChangeBOM(input: FormActionInput & ChangeBOMInput, build: LineBuild): ActionResult {
    // Precondition: draft status
    if (!this.isDraft(build)) {
      return {
        status: 'error',
        message: 'Cannot change BOM of active build (demote first)',
        reason: 'Build must be in draft status',
      };
    }

    // Check menu item exists in catalog
    const menuItem = findBOMItem(input.menuItemId);
    if (!menuItem || !menuItem.itemId.startsWith('80')) {
      return {
        status: 'error',
        message: `Menu item ${input.menuItemId} not found`,
        reason: 'Menu item must exist and be 80* format',
      };
    }

    // Create updated build with new BOM, clear steps
    const updatedBuild: LineBuild = {
      ...build,
      menuItemId: input.menuItemId,
      menuItemName: menuItem.name,
      workUnits: [], // Clear all steps
      metadata: {
        ...build.metadata,
        status: 'draft',
        version: (build.metadata?.version || 0) + 1,
      },
    };

    return {
      status: 'success',
      message: `Changed BOM to ${menuItem.name}. All steps cleared. Ready for new steps.`,
      updatedBuild,
    };
  }
}
