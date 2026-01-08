/**
 * Editor Page (benchtop-x0c.11.1)
 * Main editor with chat, DAG, form, and validation panels
 * Query param: ?id=[buildId] to load specific build
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EditorLayout, ChatPanelPlaceholder, DAGPanelPlaceholder, FormPanelPlaceholder, ValidationPanelPlaceholder } from '@/components/editor/EditorLayout';

function EditorContent() {
  const searchParams = useSearchParams();
  const buildId = searchParams.get('id');

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
