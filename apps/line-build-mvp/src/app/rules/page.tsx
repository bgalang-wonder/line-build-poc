/**
 * Rules Management Page (benchtop-x0c.11.1)
 * Manage validation rules (structured and semantic)
 */

'use client';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Validation Rules
        </h1>
        <p className="text-gray-600 mb-8">
          Define and manage structured and semantic validation rules.
        </p>

        {/* Placeholder content - will be implemented in future iterations */}
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Rules Manager
          </h2>
          <p className="text-gray-600 mb-6">
            Create and manage validation rules here.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create New Rule
          </button>
        </div>
      </div>
    </div>
  );
}
