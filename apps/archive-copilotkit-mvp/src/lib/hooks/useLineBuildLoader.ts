/**
 * useLineBuildLoader Hook (benchtop-x0c.11.3)
 *
 * Manages loading and saving line builds from storage.
 * Integrates with LineBuildPersistence for JSON file operations.
 * Handles error states and loading indicators.
 */

import { useState, useCallback, useEffect } from 'react';
import { LineBuild } from '@/lib/model/types';
import { LineBuildPersistence } from '@/lib/model/data/persistence';

// ============================================================================
// Types
// ============================================================================

export interface LoaderState {
  build: LineBuild | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseLineBuildLoaderResult extends LoaderState {
  loadBuild: (buildId: string) => Promise<void>;
  saveBuild: (build: LineBuild) => Promise<void>;
  createNewBuild: (menuItemId: string, menuItemName: string) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useLineBuildLoader(): UseLineBuildLoaderResult {
  const [state, setState] = useState<LoaderState>({
    build: null,
    isLoading: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const loadBuild = useCallback(async (buildId: string) => {
    setState({ build: null, isLoading: true, error: null });

    try {
      const persistence = new LineBuildPersistence();
      const exists = await persistence.exists(buildId);

      if (!exists) {
        setState({
          build: null,
          isLoading: false,
          error: `Build "${buildId}" not found`,
        });
        return;
      }

      const build = await persistence.load(buildId);

      setState({
        build: build.build,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load build';
      setState({
        build: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  }, []);

  const saveBuild = useCallback(async (build: LineBuild) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const persistence = new LineBuildPersistence();
      await persistence.save(build);

      setState((prev) => ({
        ...prev,
        build,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save build';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw err;
    }
  }, []);

  const createNewBuild = useCallback(
    async (menuItemId: string, menuItemName: string) => {
      setState({ build: null, isLoading: true, error: null });

      try {
        // Generate a unique ID (simple UUID-like format)
        const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newBuild: LineBuild = {
          id: buildId,
          menuItemId,
          menuItemName,
          workUnits: [],
          metadata: {
            author: 'user', // TODO: Get from auth
            version: 1,
            status: 'draft',
            sourceConversations: [],
            changelog: [], // Initialize empty audit trail
          },
        };

        const persistence = new LineBuildPersistence();
        await persistence.save(newBuild);

        setState({
          build: newBuild,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create build';
        setState({
          build: null,
          isLoading: false,
          error: errorMessage,
        });
        throw err;
      }
    },
    []
  );

  return {
    ...state,
    loadBuild,
    saveBuild,
    createNewBuild,
    clearError,
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Auto-load a build from query parameter
 */
export function useLoadBuildFromQuery(buildId: string | null) {
  const { loadBuild, build, isLoading, error } = useLineBuildLoader();

  useEffect(() => {
    if (buildId) {
      loadBuild(buildId);
    }
  }, [buildId, loadBuild]);

  return { build, isLoading, error };
}

/**
 * Auto-save a build on changes with debouncing
 */
export function useAutoSaveBuild(build: LineBuild | null, debounceMs = 2000) {
  const { saveBuild, isLoading, error } = useLineBuildLoader();
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);

  const triggerSave = useCallback(async () => {
    if (!build) return;

    const now = Date.now();
    if (now - lastSaveTime < debounceMs) {
      return;
    }

    try {
      await saveBuild(build);
      setLastSaveTime(now);
    } catch {
      // Error is already in state, component can display it
    }
  }, [build, saveBuild, lastSaveTime, debounceMs]);

  return { triggerSave, isLoading, error };
}
