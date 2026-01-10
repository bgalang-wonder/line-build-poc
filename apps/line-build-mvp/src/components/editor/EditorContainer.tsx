'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/lib/model/store/editorStore';
import { useLineBuildLoader, useAutoSaveBuild } from '@/lib/hooks/useLineBuildLoader';
import { useComplexityUpdater } from '@/lib/hooks/useComplexityUpdater';
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
import { Button } from '../ui/Button';
import {
  DAGVisualization,
  type ActionFamily,
  type BenchTopLineBuild,
} from '../visualization/DAGVisualization';
import { ScenarioPanel } from '../resolver/ScenarioPanel';
import { ComplexityScoreDisplay } from '../scoring/ComplexityScoreDisplay';
import { LineBuild, WorkUnit, BuildValidationStatus } from '@/lib/model/types';

function legacyLineBuildToBenchTop(build: LineBuild): BenchTopLineBuild {
  const now = new Date().toISOString();

  const mapAction = (a: string): ActionFamily => {
    if (
      a === 'PREP' ||
      a === 'HEAT' ||
      a === 'TRANSFER' ||
      a === 'COMBINE' ||
      a === 'ASSEMBLE' ||
      a === 'PORTION' ||
      a === 'CHECK' ||
      a === 'VEND' ||
      a === 'OTHER'
    ) {
      return a;
    }

    // Legacy MVP vocab
    if (a === 'QUALITY_CHECK') return 'CHECK';
    if (a === 'PLATE') return 'VEND';
    if (a === 'FINISH') return 'ASSEMBLE';
    return 'OTHER';
  };

  return {
    id: build.id,
    itemId: build.menuItemId,
    version: build.metadata?.version ?? 0,
    status: build.metadata?.status === 'active' ? 'published' : 'draft',
    createdAt: now,
    updatedAt: now,
    menuItemId: build.menuItemId,
    steps: build.workUnits.map((wu, idx) => {
      const durationSeconds =
        wu.tags.time?.unit === 'min'
          ? wu.tags.time.value * 60
          : wu.tags.time?.unit === 'sec'
            ? wu.tags.time.value
            : undefined;

      return {
        id: wu.id,
        orderIndex: idx,
        action: { family: mapAction(wu.tags.action) },
        target: {
          type: wu.tags.target.bomId ? 'bom_component' : 'free_text',
          bomComponentId: wu.tags.target.bomId,
          name: wu.tags.target.name,
        },
        equipment: wu.tags.equipment ? { applianceId: wu.tags.equipment } : undefined,
        time:
          wu.tags.time && typeof durationSeconds === 'number'
            ? { durationSeconds, isActive: wu.tags.time.type === 'active' }
            : undefined,
        cookingPhase: wu.tags.phase,
        dependsOn: wu.dependsOn,
      };
    }),
  };
}

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

  // ========== SCENARIO PANEL STATE (P1.6) ==========
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);

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
    reorderWorkUnits,
    setDependencies,
    changeBOM,
    addChatMessage,
    addWorkUnit,
  } = store;

  // ========== PERSISTENCE HOOKS ==========
  const { loadBuild, saveBuild } = useLineBuildLoader();
  const { triggerSave } = useAutoSaveBuild(currentBuild);

  // ========== AUTO-UPDATE COMPLEXITY SCORE ==========
  useComplexityUpdater();

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

  // Form handlers pass agentAssisted=false (direct human edits via UI)
  const handleStepEdit = useCallback(
    (updates: Partial<WorkUnit>) => {
      if (!selectedStepId) return;
      const success = editWorkUnit(selectedStepId, updates, false); // Direct human edit
      if (!success) {
        store.setError('Failed to edit step');
      }
    },
    [selectedStepId, editWorkUnit, store]
  );

  const handleStepRemove = useCallback(
    (stepId: string) => {
      const success = removeWorkUnit(stepId, false); // Direct human edit
      if (!success) {
        store.setError('Failed to remove step');
      }
    },
    [removeWorkUnit, store]
  );

  const handleSetDependencies = useCallback(
    (stepId: string, deps: string[]) => {
      const success = setDependencies(stepId, deps, false); // Direct human edit
      if (!success) {
        store.setError('Failed to update dependencies');
      }
    },
    [setDependencies, store]
  );

  const handleChangeBOM = useCallback(
    (menuItemId: string, menuItemName: string) => {
      const success = changeBOM(menuItemId, menuItemName, false); // Direct human edit
      if (!success) {
        store.setError('Failed to change BOM');
      }
    },
    [changeBOM, store]
  );

  const handleAddStep = useCallback(
    (input: any) => {
      const step = addWorkUnit(input, false); // Direct human edit
      if (!step) {
        store.setError('Failed to add step');
      }
    },
    [addWorkUnit, store]
  );

  const handleReorderSteps = useCallback(
    (fromIndex: number, toIndex: number) => {
      const success = reorderWorkUnits(fromIndex, toIndex, false); // Direct human edit
      if (!success) {
        store.setError('Failed to reorder steps');
      }
    },
    [reorderWorkUnits, store]
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
        // These are agent-assisted changes (agentAssisted=true for changelog)
        if (interpretation.suggestedActions.length > 0 && interpretation.confidence !== 'low') {
          let buildAfterSuggestions = updatedBuild;
          let appliedCount = 0;

          // Apply each suggestion in order (all marked as agent-assisted)
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
                const newUnit = addWorkUnit(input, true); // Agent-assisted
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
                const success = editWorkUnit(suggestion.unitIdToModify, suggestion.workUnit, true); // Agent-assisted
                if (success) appliedCount++;
              } else if (suggestion.action === 'remove' && suggestion.unitIdToModify) {
                const success = removeWorkUnit(suggestion.unitIdToModify, true); // Agent-assisted
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
      <div className="flex items-center justify-center h-full bg-danger-50 p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-danger-900 mb-2">Something went wrong</h2>
          <p className="text-danger-700 mb-6 text-sm">{error}</p>
          <Button
            variant="secondary"
            onClick={() => store.setError(null)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  // ========== LOADING STATE ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-neutral-200 border-t-primary-600 mb-4" />
          <p className="text-neutral-600 font-medium">Loading build...</p>
        </div>
      </div>
    );
  }

  // ========== NO BUILD LOADED ==========
  if (!currentBuild) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-50 p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-neutral-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">No Build Loaded</h2>
          <p className="text-neutral-500 text-sm">
            Select or create a build to start editing
          </p>
        </div>
      </div>
    );
  }

  // ========== RENDER EDITOR LAYOUT ==========
  const buildForDag = legacyLineBuildToBenchTop(currentBuild);

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
            build={buildForDag}
            selectedStepId={selectedStepId || undefined}
            onSelectStep={handleStepSelect}
          />
        }
        formPanel={
          <div className="h-full flex flex-col overflow-hidden">
            {/* Top section: BOM, Scenario button, Step List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-neutral-200">
              {/* BOM Selector */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Menu Item
                </label>
                <div className="text-sm text-neutral-600 px-3 py-2 bg-neutral-100 rounded-lg border border-neutral-200">
                  {currentBuild.menuItemName}
                </div>
              </div>

              {/* Complexity Score Display */}
              <ComplexityScoreDisplay complexity={currentBuild.complexity} />

              {/* What-If Scenario Button (P1.6) */}
              <div>
                <Button
                  onClick={() => setScenarioPanelOpen(true)}
                  className="w-full"
                >
                  What-If Scenario
                </Button>
              </div>

              {/* Step List */}
              <div>
                <StepList
                  build={currentBuild}
                  selectedStepId={selectedStepId || undefined}
                  onStepSelect={handleStepSelect}
                  onReorder={handleReorderSteps}
                />
              </div>
            </div>

            {/* Bottom section: Step Editor */}
            <div className="flex-1 overflow-hidden border-t border-neutral-200">
              <StepEditor
                step={selectedStepId ? currentBuild.workUnits.find((wu) => wu.id === selectedStepId) || null : null}
                isLoading={false}
                onChange={handleStepEdit}
                allSteps={currentBuild.workUnits}
                onSetDependencies={handleSetDependencies}
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
            <div className="border-t border-neutral-200 p-4 bg-neutral-50 space-y-3">
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

      {/* Scenario Panel Modal (P1.6) */}
      {scenarioPanelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-end">
          <div className="bg-white w-full sm:w-96 h-full sm:h-auto sm:rounded-lg shadow-2xl sm:max-h-[90vh] flex flex-col">
            <ScenarioPanel
              isOpen={true}
              onClose={() => setScenarioPanelOpen(false)}
            />
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </>
  );
}
