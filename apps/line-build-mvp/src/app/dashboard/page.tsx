/**
 * Dashboard Page (benchtop-x0c.9.1 + benchtop-x0c.9.2 + benchtop-x0c.9.4)
 * Lists all line builds with status and last updated timestamp
 * Includes CopilotKit agent chat for agentic search with results display
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPersistence } from '@/lib/model/data/persistence';
import { LineBuild } from '@/lib/model/types';
import { Plus, ChevronRight, MessageCircle, X } from 'lucide-react';
import { useCopilotAction } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import type { LineBuildsSearchResult } from '@/lib/copilotkit/searchTools';

export default function DashboardPage() {
  const [builds, setBuilds] = useState<LineBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [searchResults, setSearchResults] = useState<LineBuildsSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const displayedBuilds = searchResults ? searchResults.builds : builds;
  const isShowingSearch = searchResults !== null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-2">
                  {isShowingSearch
                    ? `Search results for: ${searchResults.query}`
                    : 'Manage your line builds. Use the chat panel to search, or select a build to edit.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  title="Toggle agent search chat"
                >
                  <MessageCircle className="w-4 h-4" />
                  {showChat ? 'Hide' : 'Show'} Chat
                </button>
                <Link
                  href="/editor?new=true"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create New Build
                </Link>
              </div>
            </div>

            {isShowingSearch && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Query: {searchResults.query}</p>
                </div>
                <button
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Search
                </button>
              </div>
            )}

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
            ) : displayedBuilds.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {isShowingSearch ? 'No results found' : 'No Line Builds Yet'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {isShowingSearch
                    ? 'Try a different search query.'
                    : 'Create a new line build to get started.'}
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
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 w-20">
                        Steps
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayedBuilds.map((item) => {
                      // Handle both LineBuild objects and search result objects
                      const isLineBuild = 'workUnits' in item;
                      const id = item.id;
                      const menuItemName = item.menuItemName;
                      const menuItemId = item.menuItemId;
                      const status = isLineBuild ? item.metadata.status : item.status;
                      const version = isLineBuild ? item.metadata.version : item.version;
                      const author = isLineBuild ? item.metadata.author : item.author;
                      const workUnitCount = isLineBuild ? item.workUnits.length : item.workUnitCount;

                      return (
                        <tr
                          key={id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {menuItemName}
                            </div>
                            <div className="text-sm text-gray-500">
                              Item ID: {menuItemId}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                            {id}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {status === 'active' ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            v{version}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {author}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 text-center">
                            {workUnitCount}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/editor?id=${id}`}
                              className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                            >
                              Edit
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CopilotKit Agent Chat Sidebar */}
      {showChat && (
        <CopilotSidebar
          className="w-96 border-l border-gray-200"
          defaultOpen={true}
        />
      )}
    </div>
  );
}
