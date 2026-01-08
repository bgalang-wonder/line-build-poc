/**
 * Editor Page (benchtop-x0c.11.1)
 * Main editor with chat, DAG, form, and validation panels
 * Query param: ?id=[buildId] to load specific build
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLoadBuildFromQuery } from '@/lib/hooks/useLineBuildLoader';
import { EditorLayout, ChatPanelPlaceholder, DAGPanelPlaceholder, FormPanelPlaceholder, ValidationPanelPlaceholder } from '@/components/editor/EditorLayout';

function EditorContent() {
  const searchParams = useSearchParams();
  const buildId = searchParams.get('id');
  const { build, isLoading, error } = useLoadBuildFromQuery(buildId);

  if (!buildId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Editor</h1>
          <p className="text-gray-600">
            No build selected. Use the dashboard to open a build.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading build...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-md bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="font-semibold text-red-900 mb-2">Failed to load build</h2>
            <p className="text-red-700 text-sm mb-4">{error}</p>
            <a
              href="/dashboard"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Return to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <div className="max-w-md bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="font-semibold text-amber-900 mb-2">Build not found</h2>
            <p className="text-amber-700 text-sm mb-4">
              The build you're trying to open doesn't exist.
            </p>
            <a
              href="/dashboard"
              className="text-amber-600 hover:text-amber-700 text-sm font-medium"
            >
              Return to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EditorLayout
      chatPanel={<ChatPanelPlaceholder />}
      dagPanel={<DAGPanelPlaceholder />}
      formPanel={<FormPanelPlaceholder />}
      validationPanel={<ValidationPanelPlaceholder />}
    />
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
