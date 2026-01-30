const RECENT_BUILDS_KEY = "lineBuildViewer.recentBuilds";
const MAX_RECENT = 5;

export type RecentBuild = {
  buildId: string;
  name: string;
  visitedAt: string;
};

/**
 * Get recently viewed builds from localStorage
 */
export function getRecentBuilds(): RecentBuild[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_BUILDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a build to the recent builds list
 */
export function addRecentBuild(buildId: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentBuilds().filter((b) => b.buildId !== buildId);
    recent.unshift({ buildId, name, visitedAt: new Date().toISOString() });
    localStorage.setItem(RECENT_BUILDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}
