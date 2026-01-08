/**
 * Editor Page (benchtop-x0c.11.1)
 * Main editor with chat, DAG, form, and validation panels
 * Query param: ?id=[buildId] to load specific build
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function EditorContent() {
  const searchParams = useSearchParams();
  const buildId = searchParams.get('id');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Editor</h1>
        {buildId && (
          <p className="text-gray-600">
            Editing build: <code className="bg-gray-200 px-2 py-1 rounded">{buildId}</code>
          </p>
        )}
        {!buildId && (
          <p className="text-gray-600">
            No build selected. Use the dashboard to open a build.
          </p>
        )}

        {/* Placeholder content - will be implemented in benchtop-x0c.11.2 */}
        <div className="mt-8 bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Editor Layout
          </h2>
          <p className="text-gray-600 mb-6">
            3-column layout: Chat | DAG | Form + Validation
          </p>
          <p className="text-sm text-gray-500">
            This layout will be implemented in the next iteration (benchtop-x0c.11.2)
          </p>
        </div>
      </div>
    </div>
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
