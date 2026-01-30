/**
 * Editor Page (benchtop-x0c.11.1)
 * Main editor with chat, DAG, form, and validation panels
 * Query param: ?id=[buildId] to load specific build
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EditorContainer from '@/components/editor/EditorContainer';

function EditorContent() {
  const searchParams = useSearchParams();
  const buildId = searchParams.get('id') || undefined;

  return (
    <EditorContainer
      buildId={buildId}
      onError={(error) => console.error('Editor error:', error)}
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
