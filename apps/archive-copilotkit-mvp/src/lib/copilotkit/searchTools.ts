/**
 * CopilotKit Agent Tools for Line Build Search (benchtop-x0c.9.3)
 * Provides tools for the agent to search line builds by various criteria
 */

import { LineBuild, ActionType, Phase } from '../model/types';
import { getPersistence } from '../model/data/persistence';

/**
 * Search result type returned to agent
 */
export interface LineBuildsSearchResult {
  builds: Array<{
    id: string;
    menuItemName: string;
    menuItemId: string;
    status: 'draft' | 'active';
    version: number;
    author: string;
    workUnitCount: number;
    actions: ActionType[];
    phases: Phase[];
  }>;
  total: number;
  query: string;
}

/**
 * Search line builds by menu item name or ID
 * Supports partial matches and case-insensitive search
 */
export async function searchLineBuilds(
  query: string
): Promise<LineBuildsSearchResult> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const lowerQuery = query.toLowerCase();
    const filtered = allBuilds.filter(
      (build) =>
        build.menuItemName.toLowerCase().includes(lowerQuery) ||
        build.menuItemId.includes(query) ||
        build.id.includes(query)
    );

    return {
      builds: filtered.map((build) => ({
        id: build.id,
        menuItemName: build.menuItemName,
        menuItemId: build.menuItemId,
        status: build.metadata.status,
        version: build.metadata.version,
        author: build.metadata.author,
        workUnitCount: build.workUnits.length,
        actions: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.action))
        ),
        phases: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.phase).filter(Boolean))
        ) as Phase[],
      })),
      total: filtered.length,
      query,
    };
  } catch (error) {
    console.error('Search failed:', error);
    throw new Error(`Failed to search line builds: ${String(error)}`);
  }
}

/**
 * Filter line builds by status (draft or active)
 */
export async function filterLineBuildsByStatus(
  status: 'draft' | 'active'
): Promise<LineBuildsSearchResult> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const filtered = allBuilds.filter(
      (build) => build.metadata.status === status
    );

    return {
      builds: filtered.map((build) => ({
        id: build.id,
        menuItemName: build.menuItemName,
        menuItemId: build.menuItemId,
        status: build.metadata.status,
        version: build.metadata.version,
        author: build.metadata.author,
        workUnitCount: build.workUnits.length,
        actions: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.action))
        ),
        phases: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.phase).filter(Boolean))
        ) as Phase[],
      })),
      total: filtered.length,
      query: `status:${status}`,
    };
  } catch (error) {
    console.error('Filter by status failed:', error);
    throw new Error(`Failed to filter line builds by status: ${String(error)}`);
  }
}

/**
 * Filter line builds by action type (e.g., "HEAT", "PREP")
 */
export async function filterLineBuildsbyAction(
  actionType: ActionType
): Promise<LineBuildsSearchResult> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const filtered = allBuilds.filter((build) =>
      build.workUnits.some((wu) => wu.tags.action === actionType)
    );

    return {
      builds: filtered.map((build) => ({
        id: build.id,
        menuItemName: build.menuItemName,
        menuItemId: build.menuItemId,
        status: build.metadata.status,
        version: build.metadata.version,
        author: build.metadata.author,
        workUnitCount: build.workUnits.length,
        actions: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.action))
        ),
        phases: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.phase).filter(Boolean))
        ) as Phase[],
      })),
      total: filtered.length,
      query: `action:${actionType}`,
    };
  } catch (error) {
    console.error('Filter by action failed:', error);
    throw new Error(`Failed to filter line builds by action: ${String(error)}`);
  }
}

/**
 * Filter line builds by cooking phase
 */
export async function filterLineBuildsbyPhase(
  phase: Phase
): Promise<LineBuildsSearchResult> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const filtered = allBuilds.filter((build) =>
      build.workUnits.some((wu) => wu.tags.phase === phase)
    );

    return {
      builds: filtered.map((build) => ({
        id: build.id,
        menuItemName: build.menuItemName,
        menuItemId: build.menuItemId,
        status: build.metadata.status,
        version: build.metadata.version,
        author: build.metadata.author,
        workUnitCount: build.workUnits.length,
        actions: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.action))
        ),
        phases: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.phase).filter(Boolean))
        ) as Phase[],
      })),
      total: filtered.length,
      query: `phase:${phase}`,
    };
  } catch (error) {
    console.error('Filter by phase failed:', error);
    throw new Error(`Failed to filter line builds by phase: ${String(error)}`);
  }
}

/**
 * Filter line builds by author
 */
export async function filterLineBuildsbyAuthor(
  author: string
): Promise<LineBuildsSearchResult> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const lowerAuthor = author.toLowerCase();
    const filtered = allBuilds.filter((build) =>
      build.metadata.author.toLowerCase().includes(lowerAuthor)
    );

    return {
      builds: filtered.map((build) => ({
        id: build.id,
        menuItemName: build.menuItemName,
        menuItemId: build.menuItemId,
        status: build.metadata.status,
        version: build.metadata.version,
        author: build.metadata.author,
        workUnitCount: build.workUnits.length,
        actions: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.action))
        ),
        phases: Array.from(
          new Set(build.workUnits.map((wu) => wu.tags.phase).filter(Boolean))
        ) as Phase[],
      })),
      total: filtered.length,
      query: `author:${author}`,
    };
  } catch (error) {
    console.error('Filter by author failed:', error);
    throw new Error(`Failed to filter line builds by author: ${String(error)}`);
  }
}

/**
 * Get all available search filters/facets for the UI
 */
export async function getSearchFacets(): Promise<{
  statuses: Array<{ value: 'draft' | 'active'; count: number }>;
  actions: Array<{ value: ActionType; count: number }>;
  phases: Array<{ value: Phase; count: number }>;
  authors: Array<{ value: string; count: number }>;
}> {
  try {
    const persistence = getPersistence();
    const allBuilds = await persistence.loadAll();

    const statuses = new Map<'draft' | 'active', number>();
    const actions = new Map<ActionType, number>();
    const phases = new Map<Phase, number>();
    const authors = new Map<string, number>();

    allBuilds.forEach((build) => {
      // Count statuses
      statuses.set(
        build.metadata.status,
        (statuses.get(build.metadata.status) || 0) + 1
      );

      // Count authors
      authors.set(
        build.metadata.author,
        (authors.get(build.metadata.author) || 0) + 1
      );

      // Count actions and phases in work units
      build.workUnits.forEach((wu) => {
        actions.set(wu.tags.action, (actions.get(wu.tags.action) || 0) + 1);
        if (wu.tags.phase) {
          phases.set(wu.tags.phase, (phases.get(wu.tags.phase) || 0) + 1);
        }
      });
    });

    return {
      statuses: Array.from(statuses.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      actions: Array.from(actions.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      phases: Array.from(phases.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      authors: Array.from(authors.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error('Get facets failed:', error);
    throw new Error(`Failed to get search facets: ${String(error)}`);
  }
}
