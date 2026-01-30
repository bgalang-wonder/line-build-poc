'use client';

import { useMemo, useCallback } from 'react';
import { useEditorStore } from '@/lib/model/store/editorStore';
import { ScenarioContext, ResolvedWorkUnit } from '@/lib/model/types';

/**
 * Hook for managing scenario resolution and comparison
 * Provides memoized access to resolved scenarios and diffs
 */
export function useScenarioResolver() {
  const store = useEditorStore();
  const { currentBuild, resolverState } = store;
  const { context, baseResolved, scenarioResolved, diffs } = resolverState;

  // Resolve for a new scenario context
  const resolve = useCallback(
    (newContext: ScenarioContext) => {
      store.resolveForScenario(newContext);
    },
    [store]
  );

  // Clear resolver state
  const clear = useCallback(() => {
    store.clearResolverState();
  }, [store]);

  // Memoized check for whether resolver is active
  const isActive = useMemo(() => {
    return context !== null && baseResolved !== null && scenarioResolved !== null;
  }, [context, baseResolved, scenarioResolved]);

  // Memoized check for whether there are any diffs
  const hasDiffs = useMemo(() => {
    if (!diffs) return false;
    return Object.keys(diffs).length > 0;
  }, [diffs]);

  // Get diffs per work unit
  const diffsByUnit = useMemo(() => {
    if (!diffs) return {};
    return diffs;
  }, [diffs]);

  // Get a specific unit's resolved values
  const getResolvedUnit = useCallback(
    (unitId: string): ResolvedWorkUnit | null => {
      if (!scenarioResolved) return null;
      return scenarioResolved.find((u) => u.id === unitId) || null;
    },
    [scenarioResolved]
  );

  // Get base resolved unit for comparison
  const getBaseResolvedUnit = useCallback(
    (unitId: string): ResolvedWorkUnit | null => {
      if (!baseResolved) return null;
      return baseResolved.find((u) => u.id === unitId) || null;
    },
    [baseResolved]
  );

  return {
    // State
    context,
    baseResolved,
    scenarioResolved,
    diffs: diffsByUnit,

    // Status
    isActive,
    hasDiffs,

    // Actions
    resolve,
    clear,

    // Helpers
    getResolvedUnit,
    getBaseResolvedUnit,
  };
}
