/**
 * Dashboard Page (benchtop-x0c.11.1)
 * Lists all line builds with ability to create new ones
 */

'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 mb-8">
          Manage your line builds. Select a build to edit, or create a new one.
        </p>

        {/* Placeholder content - will be implemented in next iterations */}
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Line Builds
          </h2>
          <p className="text-gray-600 mb-6">
            No builds yet. Create a new line build to get started.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create New Build
          </button>
        </div>
      </div>
    </div>
  );
}
