'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/lib/model/store/editorStore';

/**
 * Hook to automatically update complexity score whenever the build changes.
 * Call this in the editor container to ensure complexity is always in sync.
 */
export function useComplexityUpdater() {
  const currentBuild = useEditorStore((state) => state.currentBuild);
  const updateComplexity = useEditorStore((state) => state.updateComplexity);

  useEffect(() => {
    if (currentBuild && currentBuild.workUnits.length > 0) {
      updateComplexity();
    }
  }, [currentBuild?.workUnits.length, currentBuild?.id, updateComplexity]);
}
