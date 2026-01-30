/**
 * Assembly color utilities for the DAG visualization.
 * Assigns consistent colors to assembly groupIds for the Component Journey view.
 */

// Color palette for assembly groups - distinct, accessible colors
export const GROUP_COLOR_PALETTE = [
  '#EF4444', // red - often protein
  '#F59E0B', // amber - often starch
  '#10B981', // green - often toppings
  '#3B82F6', // blue - often packaging/container
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#14B8A6', // teal
];

/**
 * Build a map of groupId -> color from the assemblies array.
 * Colors are assigned in alphabetical order of groupId for consistency.
 */
export function buildGroupColorMap(
  assemblies: Array<{ groupId?: string }>
): Map<string, string> {
  const uniqueGroups = Array.from(
    new Set(assemblies.map((a) => a.groupId).filter((g): g is string => Boolean(g)))
  ).sort();

  return new Map(
    uniqueGroups.map((g, i) => [g, GROUP_COLOR_PALETTE[i % GROUP_COLOR_PALETTE.length]])
  );
}

/**
 * Get the color for a specific groupId from the color map.
 * Returns neutral gray if groupId is not found or undefined.
 */
export function getGroupColor(
  groupId: string | undefined,
  colorMap: Map<string, string>
): string {
  if (!groupId) return '#6B7280'; // neutral gray
  return colorMap.get(groupId) || '#6B7280';
}

/**
 * Convert a hex color to a light tint for node backgrounds.
 * Returns a color with 15% opacity over white.
 */
export function getLightTint(hexColor: string): string {
  // Parse hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Mix with white at 15% opacity
  const mixR = Math.round(r * 0.15 + 255 * 0.85);
  const mixG = Math.round(g * 0.15 + 255 * 0.85);
  const mixB = Math.round(b * 0.15 + 255 * 0.85);
  
  return `rgb(${mixR}, ${mixG}, ${mixB})`;
}

/**
 * Get all unique groupIds from an assemblies array.
 */
export function getUniqueGroupIds(assemblies: Array<{ groupId?: string }>): string[] {
  return Array.from(
    new Set(assemblies.map((a) => a.groupId).filter((g): g is string => Boolean(g)))
  ).sort();
}
