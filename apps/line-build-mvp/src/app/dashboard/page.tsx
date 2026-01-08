/**
 * Dashboard Page (benchtop-x0c.9.1)
 * Lists all line builds with status and last updated timestamp
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPersistence } from '@/lib/model/data/persistence';
import { LineBuild } from '@/lib/model/types';
import { Plus, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
  const [builds, setBuilds] = useState<LineBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBuilds = async () => {
      try {
        setLoading(true);
        const persistence = getPersistence();
        const allBuilds = await persistence.loadAll();
        // Sort by metadata timestamp descending (most recent first)
        const sorted = allBuilds.sort((a, b) => {
          const aTime = a.metadata.sourceConversations?.[0] || '';
          const bTime = b.metadata.sourceConversations?.[0] || '';
          return bTime.localeCompare(aTime);
        });
        setBuilds(sorted);
        setError(null);
      } catch (err) {
        console.error('Failed to load builds:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load line builds'
        );
      } finally {
        setLoading(false);
      }
    };

    loadBuilds();
  }, []);

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Manage your line builds. Select a build to edit, or create a new one.
            </p>
          </div>
          <Link
            href="/editor?new=true"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create New Build
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Loading line builds...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-red-600">
              <p className="font-semibold mb-2">Error loading builds</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : builds.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              No Line Builds Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Create a new line build to get started.
            </p>
            <Link
              href="/editor?new=true"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create New Build
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Menu Item
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Build ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Author
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {builds.map((build) => (
                  <tr
                    key={build.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {build.menuItemName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Item ID: {build.menuItemId}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {build.id}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          build.metadata.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {build.metadata.status === 'active' ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      v{build.metadata.version}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {build.metadata.author}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/editor?id=${build.id}`}
                        className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                      >
                        Edit
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
