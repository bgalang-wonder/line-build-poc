/**
 * Dashboard Page (benchtop-x0c.9.1 + benchtop-x0c.9.2 + benchtop-x0c.9.4)
 * Lists all line builds with status and last updated timestamp
 * Includes CopilotKit agent chat for agentic search with results display
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPersistence } from '@/lib/model/data/persistence';
import { LineBuild } from '@/lib/model/types';
import { Plus, ChevronRight, MessageCircle, X } from 'lucide-react';
import { useCopilotAction } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import {
  searchLineBuilds,
  filterLineBuildsByStatus,
  filterLineBuildsbyAction,
  filterLineBuildsbyPhase,
  filterLineBuildsbyAuthor,
  getSearchFacets,
  type LineBuildsSearchResult,
} from '@/lib/copilotkit/searchTools';
import { useBulkEditActions } from '@/lib/copilotkit/useBulkEditActions';
import type { ActionType, Phase } from '@/lib/model/types';
import { MenuItemSelector } from '@/components/MenuItemSelector';
import { BOMItem } from '@/lib/model/data/mockBom';

// Design system components
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';

export default function DashboardPage() {
  const [builds, setBuilds] = useState<LineBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [searchResults, setSearchResults] = useState<LineBuildsSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMenuItemSelector, setShowMenuItemSelector] = useState(false);

  const router = useRouter();

  // Register bulk edit actions with CopilotKit (enables find/propose/apply workflow)
  useBulkEditActions();

  // CopilotKit Actions for search functionality
  useCopilotAction({
    name: "searchLineBuilds",
    description: "Search line builds by menu item name, menu item ID, or build ID. Use this for general text searches like 'find chicken' or 'search for burger'.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The search query - can be a menu item name, menu item ID, or build ID",
        required: true,
      },
    ],
    handler: async ({ query }) => {
      const results = await searchLineBuilds(query);
      setSearchResults(results);
      setSearchQuery(query);
      return `Found ${results.total} line build${results.total !== 1 ? 's' : ''} matching "${query}"`;
    },
  });

  useCopilotAction({
    name: "filterByStatus",
    description: "Filter line builds by their status - either 'draft' (work in progress) or 'active' (finalized and ready for use). Use this when user asks for 'all draft builds' or 'active builds'.",
    parameters: [
      {
        name: "status",
        type: "string",
        description: "The status to filter by: 'draft' or 'active'",
        required: true,
        enum: ["draft", "active"],
      },
    ],
    handler: async ({ status }) => {
      const results = await filterLineBuildsByStatus(status as 'draft' | 'active');
      setSearchResults(results);
      setSearchQuery(`status:${status}`);
      return `Found ${results.total} ${status} line build${results.total !== 1 ? 's' : ''}`;
    },
  });

  useCopilotAction({
    name: "filterByAction",
    description: "Filter line builds that contain work units with a specific action type. Action types are: PREP (preparation), HEAT (cooking/heating), TRANSFER (moving items), ASSEMBLE (putting together), PORTION (dividing/measuring), PLATE (final presentation), FINISH (final touches), QUALITY_CHECK (verification).",
    parameters: [
      {
        name: "actionType",
        type: "string",
        description: "The action type to filter by",
        required: true,
        enum: ["PREP", "HEAT", "TRANSFER", "ASSEMBLE", "PORTION", "PLATE", "FINISH", "QUALITY_CHECK"],
      },
    ],
    handler: async ({ actionType }) => {
      const results = await filterLineBuildsbyAction(actionType as ActionType);
      setSearchResults(results);
      setSearchQuery(`action:${actionType}`);
      return `Found ${results.total} line build${results.total !== 1 ? 's' : ''} with ${actionType} steps`;
    },
  });

  useCopilotAction({
    name: "filterByPhase",
    description: "Filter line builds that contain work units in a specific cooking phase. Phases are: PRE_COOK (before cooking starts), COOK (active cooking), POST_COOK (after cooking), ASSEMBLY (putting components together), PASS (final handoff/expediting).",
    parameters: [
      {
        name: "phase",
        type: "string",
        description: "The cooking phase to filter by",
        required: true,
        enum: ["PRE_COOK", "COOK", "POST_COOK", "ASSEMBLY", "PASS"],
      },
    ],
    handler: async ({ phase }) => {
      const results = await filterLineBuildsbyPhase(phase as Phase);
      setSearchResults(results);
      setSearchQuery(`phase:${phase}`);
      return `Found ${results.total} line build${results.total !== 1 ? 's' : ''} with ${phase} steps`;
    },
  });

  useCopilotAction({
    name: "filterByAuthor",
    description: "Filter line builds by the author who created them. Supports partial name matching (case-insensitive).",
    parameters: [
      {
        name: "author",
        type: "string",
        description: "The author name to filter by (partial match supported)",
        required: true,
      },
    ],
    handler: async ({ author }) => {
      const results = await filterLineBuildsbyAuthor(author);
      setSearchResults(results);
      setSearchQuery(`author:${author}`);
      return `Found ${results.total} line build${results.total !== 1 ? 's' : ''} by "${author}"`;
    },
  });

  useCopilotAction({
    name: "getAvailableFilters",
    description: "Get all available filter options (facets) for searching line builds. Returns counts of builds by status, action types, phases, and authors. Use this to help users understand what filters are available or to suggest filter options.",
    parameters: [],
    handler: async () => {
      const facets = await getSearchFacets();
      const summary = [
        `Statuses: ${facets.statuses.map(s => `${s.value} (${s.count})`).join(', ')}`,
        `Actions: ${facets.actions.map(a => `${a.value} (${a.count})`).join(', ')}`,
        `Phases: ${facets.phases.map(p => `${p.value} (${p.count})`).join(', ')}`,
        `Authors: ${facets.authors.map(a => `${a.value} (${a.count})`).join(', ')}`,
      ].join('\n');
      return `Available filters:\n${summary}`;
    },
  });

  useCopilotAction({
    name: "clearSearch",
    description: "Clear the current search results and show all line builds again. Use this when user wants to reset the view or see all builds.",
    parameters: [],
    handler: async () => {
      setSearchResults(null);
      setSearchQuery('');
      return "Search cleared. Now showing all line builds.";
    },
  });

  // Handler for menu item selection - creates new LineBuild and navigates to editor
  const handleMenuItemSelect = async (menuItem: BOMItem) => {
    // Generate unique ID
    const generateId = () => `lb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new LineBuild
    const newBuild: LineBuild = {
      id: generateId(),
      menuItemId: menuItem.itemId,
      menuItemName: menuItem.name,
      workUnits: [],
      metadata: {
        author: 'User', // Could be from auth later
        version: 1,
        status: 'draft',
        sourceConversations: [],
        changelog: [],
      },
    };

    // Save to persistence
    const persistence = getPersistence();
    await persistence.save(newBuild);

    // Close modal and navigate to editor
    setShowMenuItemSelector(false);
    router.push(`/editor?id=${newBuild.id}`);
  };

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
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-12 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
                <p className="text-neutral-600 mt-2">
                  {isShowingSearch
                    ? `Search results for: ${searchResults.query}`
                    : 'Manage your line builds. Use the chat panel to search, or select a build to edit.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowChat(!showChat)}
                  leftIcon={<MessageCircle className="w-4 h-4" />}
                >
                  {showChat ? 'Hide' : 'Show'} Chat
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowMenuItemSelector(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Create New Build
                </Button>
              </div>
            </div>

            {isShowingSearch && (
              <Card variant="bordered" padding="md" className="mb-6 flex items-center justify-between bg-primary-50 border-primary-200">
                <div>
                  <p className="text-sm font-medium text-primary-900">
                    Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-primary-700 mt-1">Query: {searchResults.query}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="w-4 h-4" />}
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                >
                  Clear Search
                </Button>
              </Card>
            )}

            {loading ? (
              <Card variant="default" padding="lg" className="text-center">
                <p className="text-neutral-600">Loading line builds...</p>
              </Card>
            ) : error ? (
              <Card variant="default" padding="lg">
                <div className="text-danger-600">
                  <p className="font-semibold mb-2">Error loading builds</p>
                  <p className="text-sm">{error}</p>
                </div>
              </Card>
            ) : displayedBuilds.length === 0 ? (
              <Card variant="default" padding="lg" className="text-center">
                <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                  {isShowingSearch ? 'No results found' : 'No Line Builds Yet'}
                </h2>
                <p className="text-neutral-600 mb-6">
                  {isShowingSearch
                    ? 'Try a different search query.'
                    : 'Create a new line build to get started.'}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setShowMenuItemSelector(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Create New Build
                </Button>
              </Card>
            ) : (
              <Card variant="default" padding="none" className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow noHover>
                      <TableHead>Menu Item</TableHead>
                      <TableHead>Build ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead className="w-20">Steps</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
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
                        <TableRow key={id}>
                          <TableCell>
                            <div className="font-medium text-neutral-900">
                              {menuItemName}
                            </div>
                            <div className="text-sm text-neutral-500">
                              Item ID: {menuItemId}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-neutral-600">
                            {id}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status === 'active' ? 'success' : 'warning'} size="sm">
                              {status === 'active' ? 'Active' : 'Draft'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-neutral-600">
                            v{version}
                          </TableCell>
                          <TableCell className="text-neutral-600">
                            {author}
                          </TableCell>
                          <TableCell className="text-center text-neutral-600">
                            {workUnitCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/editor?id=${id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                rightIcon={<ChevronRight className="w-4 h-4" />}
                              >
                                Edit
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* CopilotKit Agent Chat Sidebar */}
      {showChat && (
        <CopilotSidebar
          className="w-96 border-l border-neutral-200"
          defaultOpen={true}
        />
      )}

      {/* Menu Item Selector Modal */}
      <MenuItemSelector
        isOpen={showMenuItemSelector}
        onClose={() => setShowMenuItemSelector(false)}
        onSelect={handleMenuItemSelect}
      />
    </div>
  );
}
