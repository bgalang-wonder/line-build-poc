/**
 * Form Actions Contract for Chat Integration (benchtop-x0c.7ql)
 *
 * This document defines which form operations are exposed as CopilotKit actions.
 * Each action specifies: inputs, preconditions, outputs (state changes), and error cases.
 *
 * These actions inform the CopilotKit implementation in benchtop-x0c.5.4:
 * Chat will call these actions to modify the form state reactively.
 */

import { LineBuild, WorkUnit } from "../types";

// ============================================================================
// Action Types & Interfaces
// ============================================================================

/**
 * Action Status: Indicates whether an action succeeded or failed
 * Used by all actions to report back to CopilotKit
 */
export type ActionStatus = "success" | "error";

/**
 * Action Result: Standard response format for all form actions
 * Returned to CopilotKit for UI feedback and logging
 */
export interface ActionResult {
  status: ActionStatus;
  message: string; // Human-readable message for debugging/logging
  updatedBuild?: LineBuild; // Returned on success for state refresh
  reason?: string; // Error reason if status === "error"
}

// ============================================================================
// ACTION 1: addWorkUnit
// ============================================================================

/**
 * Adds a new WorkUnit (step) to the line build
 *
 * Preconditions:
 * - Build must exist and be in "draft" status (promotions cannot add steps)
 * - At least one BOM item must exist (for target reference)
 * - Input must include required fields: action, targetItemName
 *
 * Inputs:
 * - action: ActionType (PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PLATE, FINISH, QUALITY_CHECK)
 * - targetItemName: string (name of the item being operated on)
 * - bomId?: string (optional: the consumable item ID from the BOM, if known)
 * - equipment?: string (optional: equipment needed for this action)
 * - time?: { value: number; unit: "sec" | "min"; type: "active" | "passive" }
 * - phase?: Phase (PRE_COOK, COOK, POST_COOK, ASSEMBLY, PASS)
 * - station?: string (optional: work station)
 * - tags?: Partial<WorkUnit["tags"]> (any additional metadata tags)
 * - dependsOn?: string[] (optional: array of workUnitIds this step depends on)
 *
 * State Changes:
 * - Creates new WorkUnit with unique ID
 * - Appends to lineBuild.workUnits array
 * - Increments version
 * - Updates metadata.updatedAt timestamp
 * - Clears any cached validation results (triggers revalidation on next check)
 *
 * Outputs:
 * - ActionResult with success status and updated LineBuild
 * - New WorkUnit visible in form step list
 * - Position: appended to end of workUnits array
 *
 * Error Cases:
 * - Build not in draft status → "Cannot add step to active build (demote first)"
 * - Missing required action field → "action is required"
 * - Missing targetItemName → "targetItemName is required"
 * - Build doesn't exist → "Build not found"
 */
export interface AddWorkUnitInput {
  action: string; // ActionType enum value
  targetItemName: string;
  bomId?: string;
  equipment?: string;
  time?: {
    value: number;
    unit: "sec" | "min";
    type: "active" | "passive";
  };
  phase?: string; // Phase enum value
  station?: string;
  timingMode?: string;
  requiresOrder?: boolean;
  prepType?: string;
  storageLocation?: string;
  bulkPrep?: boolean;
  dependsOn?: string[];
}

// ============================================================================
// ACTION 2: editWorkUnit
// ============================================================================

/**
 * Modifies an existing WorkUnit (step) in the line build
 *
 * Preconditions:
 * - Build must exist and be in "draft" status
 * - WorkUnit with given ID must exist in build
 * - Cannot modify steps in active builds (must demote first)
 *
 * Inputs:
 * - workUnitId: string (ID of the step to modify)
 * - updates: Partial of WorkUnit properties (any field that can be modified)
 *   - Can include: tags.action, tags.target, tags.equipment, tags.time, tags.phase,
 *     tags.station, tags.timingMode, tags.requiresOrder, tags.prepType,
 *     tags.storageLocation, tags.bulkPrep, dependsOn
 *   - Cannot include: id (immutable)
 *
 * State Changes:
 * - Updates specified fields in the WorkUnit
 * - Leaves unspecified fields unchanged (shallow merge)
 * - Increments version
 * - Updates metadata.updatedAt timestamp
 * - Clears cached validation results
 *
 * Outputs:
 * - ActionResult with success status and updated LineBuild
 * - Modified WorkUnit visible in form step list
 * - Step maintains its position in array
 *
 * Error Cases:
 * - Build not in draft status → "Cannot edit step in active build (demote first)"
 * - WorkUnit not found → "Step not found"
 * - Build doesn't exist → "Build not found"
 * - Attempting to modify id field → "Cannot modify step ID"
 * - Invalid field values → "Invalid value for [fieldName]"
 */
export interface EditWorkUnitInput {
  workUnitId: string;
  updates: {
    action?: string;
    targetItemName?: string;
    bomId?: string;
    equipment?: string;
    time?: {
      value: number;
      unit: "sec" | "min";
      type: "active" | "passive";
    } | null;
    phase?: string | null;
    station?: string | null;
    timingMode?: string | null;
    requiresOrder?: boolean;
    prepType?: string | null;
    storageLocation?: string | null;
    bulkPrep?: boolean;
    dependsOn?: string[];
  };
}

// ============================================================================
// ACTION 3: removeWorkUnit
// ============================================================================

/**
 * Deletes a WorkUnit (step) from the line build
 *
 * Preconditions:
 * - Build must exist and be in "draft" status
 * - WorkUnit with given ID must exist in build
 * - Cascade: Any steps that depend on this step must have their dependsOn arrays updated
 *
 * Inputs:
 * - workUnitId: string (ID of the step to remove)
 *
 * State Changes:
 * - Removes WorkUnit from workUnits array
 * - Updates any steps that had this step in their dependsOn array (removes the dependency)
 * - Increments version
 * - Updates metadata.updatedAt timestamp
 * - Clears cached validation results
 *
 * Outputs:
 * - ActionResult with success status and updated LineBuild
 * - Step removed from form step list
 * - Dependent steps' dependency arrays automatically cleaned up
 *
 * Error Cases:
 * - Build not in draft status → "Cannot remove step from active build (demote first)"
 * - WorkUnit not found → "Step not found"
 * - Build doesn't exist → "Build not found"
 */
export interface RemoveWorkUnitInput {
  workUnitId: string;
}

// ============================================================================
// ACTION 4: setDependencies
// ============================================================================

/**
 * Updates the dependency graph for a WorkUnit
 *
 * Preconditions:
 * - Build must exist and be in "draft" status
 * - WorkUnit with given ID must exist in build
 * - All referenced dependency IDs must exist in the build
 * - No circular dependencies allowed (A→B→C→A is invalid)
 *
 * Inputs:
 * - workUnitId: string (ID of the step being modified)
 * - dependsOn: string[] (array of workUnitIds this step depends on)
 *   - Can be empty array [] to remove all dependencies
 *   - Order doesn't matter (dependencies are a set, not a sequence)
 *
 * State Changes:
 * - Replaces the dependsOn array for the WorkUnit
 * - All specified dependency IDs must exist (validation)
 * - Detects circular dependencies and rejects
 * - Increments version
 * - Updates metadata.updatedAt timestamp
 * - Clears cached validation results
 *
 * Outputs:
 * - ActionResult with success status and updated LineBuild
 * - Step's dependency badges updated in form step list
 * - DAG panel (if implemented) shows updated graph structure
 *
 * Error Cases:
 * - Build not in draft status → "Cannot modify dependencies in active build (demote first)"
 * - WorkUnit not found → "Step not found"
 * - Dependency ID not found → "Dependency [id] not found"
 * - Circular dependency detected → "Circular dependency detected: [path]"
 * - Step cannot depend on itself → "A step cannot depend on itself"
 */
export interface SetDependenciesInput {
  workUnitId: string;
  dependsOn: string[];
}

// ============================================================================
// ACTION 5: changeBOM
// ============================================================================

/**
 * Changes the BOM (menu item) for the entire line build
 *
 * Preconditions:
 * - Build must exist and be in "draft" status (cannot change BOM of active builds)
 * - Menu item must exist in mock BOM catalog
 * - Menu item must have a valid BOM recipe (steps become invalid if BOM changes)
 *
 * Inputs:
 * - menuItemId: string (new menu item ID, must be 80* format)
 *
 * State Changes:
 * - Updates lineBuild.menuItemId and lineBuild.menuItemName
 * - CLEARS all workUnits (new BOM requires new steps)
 * - Increments version
 * - Updates metadata.updatedAt timestamp
 * - Resets status to "draft"
 * - Clears all validation results
 *
 * Outputs:
 * - ActionResult with success status and updated LineBuild
 * - Form step list becomes empty
 * - Menu item name updated in form header
 * - Chat should prompt user to add new steps for the new menu item
 *
 * Error Cases:
 * - Build not in draft status → "Cannot change BOM of active build (demote first)"
 * - Menu item not found → "Menu item [id] not found"
 * - Build doesn't exist → "Build not found"
 * - Menu item has no BOM recipe → "No BOM recipe available for [menuItemName]"
 */
export interface ChangeBOMInput {
  menuItemId: string;
}

// ============================================================================
// Unified Action Input Type
// ============================================================================

export type FormActionInput =
  | ({ type: "addWorkUnit" } & AddWorkUnitInput)
  | ({ type: "editWorkUnit" } & EditWorkUnitInput)
  | ({ type: "removeWorkUnit" } & RemoveWorkUnitInput)
  | ({ type: "setDependencies" } & SetDependenciesInput)
  | ({ type: "changeBOM" } & ChangeBOMInput);

// ============================================================================
// Action Executor Interface
// ============================================================================

/**
 * FormActionExecutor: Describes how actions are executed
 * Used by CopilotKit to call form operations from the chat interface
 *
 * Implementation Note (for benchtop-x0c.5.4):
 * - Each action is a CopilotKit useAction hook
 * - Actions call form state update functions (from zustand store or React Context)
 * - Updates should be immediate (not async) for responsive UI
 * - After update, form validation should be cleared (triggering re-run on next check)
 */
export interface FormActionExecutor {
  /**
   * Execute a form action and return the result
   * @param action The action to execute (includes type discriminator)
   * @param currentBuild The current line build state
   * @returns ActionResult with updated build on success
   */
  execute(action: FormActionInput, currentBuild: LineBuild): ActionResult;

  /**
   * Validate an action's inputs without executing it
   * Used for pre-flight checks before running action
   * @param action The action to validate
   * @param currentBuild The current line build state
   * @returns true if action is valid, false otherwise
   */
  validate(action: FormActionInput, currentBuild: LineBuild): boolean;
}

// ============================================================================
// Integration Points with Other Systems
// ============================================================================

/**
 * State Refresh Requirements:
 * After any action, the form must refresh to show updates:
 * - Step list updates (add, remove, edit)
 * - Dependency badges update
 * - Menu item header updates (on changeBOM)
 * - Validation status resets (requires re-running validation)
 *
 * Data Persistence:
 * Each action should:
 * 1. Update in-memory form state (via state hook)
 * 2. Trigger automatic save to LineBuildPersistence
 * 3. Increment version for conflict detection
 *
 * Validation Integration:
 * Each action clears cached validation results.
 * User can run "check-my-work" to re-validate after changes.
 * Draft→Active transition requires validation to pass.
 *
 * Error Handling:
 * All actions return ActionResult with status and message.
 * CopilotKit should:
 * - Show error messages to user
 * - Log failures for debugging
 * - Keep form state unchanged on error (no partial updates)
 *
 * Undo/Redo (Future Enhancement):
 * Not required for MVP, but should be supported by:
 * - Storing version numbers for conflict detection
 * - Keeping action history in metadata (optional)
 * - Using immutable update pattern (already designed in types)
 */
