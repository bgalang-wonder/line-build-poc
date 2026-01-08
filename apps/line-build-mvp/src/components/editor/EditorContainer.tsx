'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/lib/model/store/editorStore';
import { useLineBuildLoader, useAutoSaveBuild } from '@/lib/hooks/useLineBuildLoader';
import { EditorLayout } from './EditorLayout';
import ChatPanel from '../chat/ChatPanel';
import StepList from '../form/StepList';
import StepEditor from '../form/StepEditor';
import DependenciesMultiSelect from '../form/DependenciesMultiSelect';
import BOMAutocomplete from '../form/BOMAutocomplete';
import { ValidationChecklistPanel } from '../validation/ValidationChecklistPanel';
import { PublishButton } from '../validation/PublishButton';
import { CheckMyWorkButton } from '../validation/CheckMyWorkButton';
import { ToastContainer } from '../ui/Toast';
import { DAGVisualization } from '../visualization/DAGVisualization';
import { LineBuild, WorkUnit, BuildValidationStatus } from '@/lib/model/types';

interface EditorContainerProps {
  buildId?: string;
  onBuildLoaded?: (build: LineBuild) => void;
  onError?: (error: string) => void;
}

/**
 * EditorContainer Component
 *
 * Coordinates state synchronization across all 3 editor panels:
 * - Form Panel (StepList + StepEditor + Dependencies)
 * - Chat Panel (with CopilotKit integration ready)
 * - Validation Panel (status display + publish gating)
 *
 * Responsibilities:
 * 1. Loads build from persistence (via useLineBuildLoader)
 * 2. Syncs build state to EditorStore on load
 * 3. Handles form mutations and auto-saves to persistence
 * 4. Coordinates form → validation flow
 * 5. Manages chat message state
 * 6. Renders EditorLayout with all integrated panels
 *
 * Data Flow:
 * useLineBuildLoader → setBuild(store) → form mutations → clearValidation()
 *                                      → auto-save via useAutoSaveBuild
 *
 * Component Communication:
 * - Form changes: StepEditor → store.editWorkUnit → auto-save
 * - Step selection: StepList → store.setSelectedStepId
 * - Chat messages: ChatPanel → store.addChatMessage
 * - Validation: store.setValidationStatus (from orchestrator)
 */
export default function EditorContainer({
  buildId,
  onBuildLoaded,
  onError,
}: EditorContainerProps) {
  // ========== TOAST STATE ==========
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>>([]);

  // ========== STORE ACCESS ==========
  const store = useEditorStore();
  const {
    currentBuild,
    selectedStepId,
    chatMessages,
    validationSnapshot,
    isLoading,
    error,
    setBuild,
    setSelectedStepId,
    editWorkUnit,
    removeWorkUnit,
    setDependencies,
    changeBOM,
    addChatMessage,
    addWorkUnit,
  } = store;

  // ========== PERSISTENCE HOOKS ==========
  const { loadBuild, saveBuild } = useLineBuildLoader();
  const { triggerSave } = useAutoSaveBuild(currentBuild);

  // ========== LOAD BUILD FROM PERSISTENCE ==========
  useEffect(() => {
    if (!buildId) return;

    const loadBuildFromId = async () => {
      try {
        store.setLoading(true);
        await loadBuild(buildId);
        // loadBuild updates state internally; we rely on callbacks to know it succeeded
        // TODO: Better to integrate useLineBuildLoader with EditorStore directly
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load build';
        store.setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        store.setLoading(false);
      }
    };

    loadBuildFromId();
  }, [buildId, loadBuild, onError, store]);

  // ========== AUTO-SAVE ON CHANGES ==========
  // Debounced save to persistence whenever build changes
  useEffect(() => {
    if (!currentBuild) return;

    const timeoutId = setTimeout(async () => {
      try {
        await triggerSave();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Auto-save failed';
        store.setError(errorMsg);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [currentBuild, triggerSave, store]);

  // ========== FORM PANEL HANDLERS ==========

  const handleStepSelect = useCallback(
    (stepId: string | null) => {
      setSelectedStepId(stepId);
    },
    [setSelectedStepId]
  );

  const handleStepEdit = useCallback(
    (updates: Partial<WorkUnit>) => {
      if (!selectedStepId) return;
      const success = editWorkUnit(selectedStepId, updates);
      if (!success) {
        store.setError('Failed to edit step');
      }
    },
    [selectedStepId, editWorkUnit, store]
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      const success = removeWorkUnit(stepId);
      if (!success) {
        store.setError('Failed to remove step');
      }
    },
    [removeWorkUnit, store]
  );

  const handleSetDependencies = useCallback(
    (stepId: string, deps: string[]) => {
      const success = setDependencies(stepId, deps);
      if (!success) {
        store.setError('Failed to update dependencies');
      }
    },
    [setDependencies, store]
  );

  const handleChangeBOM = useCallback(
    (menuItemId: string, menuItemName: string) => {
      const success = changeBOM(menuItemId, menuItemName);
      if (!success) {
        store.setError('Failed to change BOM');
      }
    },
    [changeBOM, store]
  );

  const handleAddStep = useCallback(
    (input: any) => {
      const step = addWorkUnit(input);
      if (!step) {
        store.setError('Failed to add step');
      }
    },
    [addWorkUnit, store]
  );

  // ========== CHAT PANEL HANDLERS ==========

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message to store
      addChatMessage('user', content);

      // Process message with chat integration service
      try {
        const { getChatIntegrationService } = await import('@/lib/copilotkit/chatIntegrationService');
        const chatService = getChatIntegrationService();

        // Set context for the service
        if (currentBuild) {
          chatService.setContext(currentBuild);
        }

        // Interpret the message
        const interpretation = await chatService.interpretMessage(content);

        // Generate and display assistant response
        const assistantResponse = chatService.generateAssistantMessage(interpretation);
        addChatMessage('assistant', assistantResponse);

        // Preserve conversation in sourceConversations
        let updatedBuild = currentBuild;
        if (currentBuild) {
          updatedBuild = {
            ...currentBuild,
            metadata: {
              ...currentBuild.metadata,
              sourceConversations: [
                ...(currentBuild.metadata.sourceConversations || []),
                `[USER] ${content}`,
                `[ASSISTANT] ${assistantResponse}`,
              ],
            },
          };
          setBuild(updatedBuild);
        }

        // Apply suggested work units automatically if confidence is high or medium
        if (interpretation.suggestedActions.length > 0 && interpretation.confidence !== 'low') {
          let buildAfterSuggestions = updatedBuild;
          let appliedCount = 0;

          // Apply each suggestion in order
          for (const suggestion of interpretation.suggestedActions) {
            try {
              if (suggestion.action === 'add' && suggestion.workUnit) {
                // Convert WorkUnit suggestion to addWorkUnit input format
                const input = {
                  action: suggestion.workUnit.tags?.action || 'PREP',
                  targetItemName: suggestion.workUnit.tags?.target?.name || '',
                  bomId: suggestion.workUnit.tags?.target?.bomId,
                  equipment: suggestion.workUnit.tags?.equipment,
                  time: suggestion.workUnit.tags?.time,
                  phase: suggestion.workUnit.tags?.phase,
                  station: suggestion.workUnit.tags?.station,
                  timingMode: suggestion.workUnit.tags?.timingMode,
                  requiresOrder: suggestion.workUnit.tags?.requiresOrder,
                  prepType: suggestion.workUnit.tags?.prepType,
                  storageLocation: suggestion.workUnit.tags?.storageLocation,
                  bulkPrep: suggestion.workUnit.tags?.bulkPrep,
                  dependsOn: suggestion.workUnit.dependsOn || [],
                };
                const newUnit = addWorkUnit(input);
                if (newUnit) {
                  appliedCount++;
                  // Update build reference for next iteration
                  if (buildAfterSuggestions) {
                    buildAfterSuggestions = {
                      ...buildAfterSuggestions,
                      workUnits: [...buildAfterSuggestions.workUnits, newUnit],
                    };
                  }
                }
              } else if (suggestion.action === 'edit' && suggestion.unitIdToModify && suggestion.workUnit) {
                const success = editWorkUnit(suggestion.unitIdToModify, suggestion.workUnit);
                if (success) appliedCount++;
              } else if (suggestion.action === 'remove' && suggestion.unitIdToModify) {
                const success = removeWorkUnit(suggestion.unitIdToModify);
                if (success) appliedCount++;
              }
            } catch (err) {
              console.warn(`[EditorContainer] Failed to apply suggestion ${suggestion.index}:`, err);
              // Continue with other suggestions
            }
          }

          // Provide feedback about applied suggestions
          if (appliedCount > 0) {
            const feedbackMsg = appliedCount === 1
              ? `✓ Applied 1 suggestion to your workflow.`
              : `✓ Applied ${appliedCount} of ${interpretation.suggestedActions.length} suggestions.`;
            addChatMessage('system', feedbackMsg);
          }

          if (appliedCount < interpretation.suggestedActions.length && interpretation.confidence === 'medium') {
            const skippedCount = interpretation.suggestedActions.length - appliedCount;
            const clarifyMsg = skippedCount === 1
              ? `⚠️ 1 suggestion needs clarification. Check the form.`
              : `⚠️ ${skippedCount} suggestions need clarification. Check the form.`;
            addChatMessage('system', clarifyMsg);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to process message';
        console.error('[EditorContainer] Chat processing error:', errorMsg);
        addChatMessage('system', `Error: ${errorMsg}`);
      }
    },
    [addChatMessage, currentBuild, setBuild, addWorkUnit, editWorkUnit, removeWorkUnit]
  );

  const handleClearChatHistory = useCallback(() => {
    store.clearChatHistory();
  }, [store]);

  // ========== VALIDATION PANEL HANDLERS ==========

  const handleValidationComplete = useCallback(
    (status: BuildValidationStatus) => {
      // Validation results are already in store via useValidationRunner
      // This callback allows CheckMyWorkButton to notify parent of completion
    },
    []
  );

  const handleAddToast = useCallback(
    (toast: {
      id: string;
      type: 'success' | 'error' | 'info';
      title: string;
      message: string;
    }) => {
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handlePublish = useCallback(
    async (buildWithNewStatus: LineBuild) => {
      try {
        store.setLoading(true);

        // Update store
        setBuild(buildWithNewStatus);

        // Persist
        await saveBuild(buildWithNewStatus);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update status';
        store.setError(errorMsg);
      } finally {
        store.setLoading(false);
      }
    },
    [setBuild, saveBuild, store]
  );

  const handleDemote = useCallback(
    async () => {
      if (!currentBuild) return;

      const draftBuild = {
        ...currentBuild,
        metadata: {
          ...currentBuild.metadata,
          status: 'draft' as const,
        },
      };

      await handlePublish(draftBuild);
    },
    [currentBuild, handlePublish]
  );

  // ========== ERROR DISPLAY ==========
  if (error && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => store.setError(null)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ========== LOADING STATE ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading build...</p>
        </div>
      </div>
    );
  }

  // ========== NO BUILD LOADED ==========
  if (!currentBuild) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 p-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Build Loaded</h2>
          <p className="text-gray-600">
            Select or create a build to start editing
          </p>
        </div>
      </div>
    );
  }

  // ========== RENDER EDITOR LAYOUT ==========
  return (
    <>
      <EditorLayout
        chatPanel={
          <ChatPanel
            messages={chatMessages}
            isLoading={validationSnapshot.isRunning}
            onSendMessage={handleSendMessage}
            onClearHistory={handleClearChatHistory}
          />
        }
        dagPanel={
          <DAGVisualization
            build={currentBuild}
            selectedStepId={selectedStepId || undefined}
            onSelectStep={handleStepSelect}
          />
        }
        formPanel={
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            {/* BOM Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Menu Item
              </label>
              <div className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded border border-gray-200">
                {currentBuild.menuItemName}
              </div>
            </div>

            {/* Step List */}
            <div className="border-t pt-4">
              <StepList
                build={currentBuild}
                selectedStepId={selectedStepId || undefined}
                onStepSelect={handleStepSelect}
              />
            </div>
          </div>
        }
        validationPanel={
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <ValidationChecklistPanel
                validationStatus={validationSnapshot.status || undefined}
                isLoading={validationSnapshot.isRunning}
              />
            </div>
            <div className="border-t p-4 bg-gray-50 space-y-3">
              <CheckMyWorkButton
                build={currentBuild}
                isRunning={validationSnapshot.isRunning}
                onValidationComplete={handleValidationComplete}
                onToast={handleAddToast}
              />
              <PublishButton
                build={currentBuild}
                validationStatus={validationSnapshot.status}
                onPublish={handlePublish}
                onDemote={handleDemote}
              />
            </div>
          </div>
        }
      />
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </>
  );
}
