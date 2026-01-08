/**
 * CopilotKit Form Actions
 *
 * Defines useAction hooks for CopilotKit to call form operations
 * These are called from the chat interface to modify line build state
 *
 * Usage in a component:
 * ```tsx
 * const { addWorkUnit } = useCopilotFormActions(formStore);
 * // Pass to CopilotKit useAction hook for registration
 * ```
 */

import { useFormStore } from '../model/store/formStore';
import { FormActionExecutor } from '../model/data/formActionExecutor';
import { FormActionInput, ActionResult } from '../model/data/formActionsContract';
import { getPersistence } from '../model/data/persistence';

/**
 * Hook to register all form actions with CopilotKit
 * Returns actions that can be used in useAction hooks
 */
export function useCopilotFormActions(store = useFormStore) {
  const currentBuild = store((s) => s.currentBuild);
  const setBuild = store((s) => s.setBuild);
  const setLoading = store((s) => s.setLoading);

  /**
   * Execute action through executor, update store, persist
   */
  const executeAndPersist = async (action: FormActionInput): Promise<ActionResult> => {
    if (!currentBuild) {
      return {
        status: 'error',
        message: 'No build loaded',
        reason: 'Load a build first',
      };
    }

    // Execute action
    const result = FormActionExecutor.execute(action, currentBuild);

    if (result.status === 'success' && result.updatedBuild) {
      // Update store
      setBuild(result.updatedBuild);

      // Persist to storage
      try {
        const persistence = getPersistence();
        await persistence.save(result.updatedBuild);
      } catch (error) {
        console.error('Failed to persist build:', error);
        // Continue anyway - state updated in memory
      }
    }

    return result;
  };

  return {
    /**
     * CopilotKit action: add new WorkUnit
     * Can be registered with: useCopilotAction({ name: "addWorkUnit", ... })
     */
    addWorkUnit: async (input: any) => {
      setLoading(true);
      try {
        return await executeAndPersist({
          ...input,
          type: 'addWorkUnit',
        } as FormActionInput);
      } finally {
        setLoading(false);
      }
    },

    /**
     * CopilotKit action: edit existing WorkUnit
     */
    editWorkUnit: async (input: any) => {
      setLoading(true);
      try {
        return await executeAndPersist({
          ...input,
          type: 'editWorkUnit',
        } as FormActionInput);
      } finally {
        setLoading(false);
      }
    },

    /**
     * CopilotKit action: remove WorkUnit
     */
    removeWorkUnit: async (input: any) => {
      setLoading(true);
      try {
        return await executeAndPersist({
          ...input,
          type: 'removeWorkUnit',
        } as FormActionInput);
      } finally {
        setLoading(false);
      }
    },

    /**
     * CopilotKit action: set dependencies
     */
    setDependencies: async (input: any) => {
      setLoading(true);
      try {
        return await executeAndPersist({
          ...input,
          type: 'setDependencies',
        } as FormActionInput);
      } finally {
        setLoading(false);
      }
    },

    /**
     * CopilotKit action: change BOM
     */
    changeBOM: async (input: any) => {
      setLoading(true);
      try {
        return await executeAndPersist({
          ...input,
          type: 'changeBOM',
        } as FormActionInput);
      } finally {
        setLoading(false);
      }
    },
  };
}
