 import { GroupingId } from '@/types';
 
export type ColorBy = 'action' | 'station';

 export type ActionFamily = 'PREP' | 'HEAT' | 'TRANSFER' | 'COMBINE' | 'ASSEMBLE' | 'PORTION' | 'CHECK' | 'PACKAGING' | 'OTHER';
 
export const NODE_DIMENSIONS = {
  compact: { width: 160, height: 110 },
  expanded: { width: 300, height: 280 },
} as const;

export const TRANSFER_NODE_DIMENSIONS = {
  compact: { width: 100, height: 36 },
  expanded: { width: 140, height: 50 },
} as const;

export const VISIT_NODE_DIMENSIONS = {
  compact: { width: 200, height: 90 },
  expanded: { width: 340, height: 220 },
} as const;
 
 export const ASSEMBLY_NODE_DIMENSIONS = {
   compact: { width: 180, height: 50 },
   expanded: { width: 280, height: 180 },
 } as const;

// Backwards compatibility alias
export const ARTIFACT_NODE_DIMENSIONS = ASSEMBLY_NODE_DIMENSIONS;

 export const ACTION_COLORS: Record<ActionFamily, string> = {
   PREP: '#3B82F6', // blue
   HEAT: '#EF4444', // red
   TRANSFER: '#8B5CF6', // purple
   COMBINE: '#06B6D4', // cyan
   ASSEMBLE: '#10B981', // green
   PORTION: '#F59E0B', // amber
   CHECK: '#6366F1', // indigo
   PACKAGING: '#EC4899', // pink
   OTHER: '#6B7280', // neutral
 };
 
 export const PHASE_BG: Record<string, string> = {
   PRE_COOK: '#F0F9FF', // light blue
   COOK: '#FEF2F2', // light red
   POST_COOK: '#F0FDF4', // light green
   ASSEMBLY: '#FDF2F8', // light pink
   PASS: '#ECFDF5', // very light green
 };
 
 export const STATION_COLORS: Record<string, string> = {
   hot_side: '#EF4444',
   cold_side: '#3B82F6',
   prep: '#F59E0B',
   garnish: '#10B981',
   vending: '#8B5CF6',
   expo: '#EC4899',
   pass: '#06B6D4',
   other: '#6B7280',
 };
 
 export const SUBLOCATION_COLORS: Record<string, string> = {
   cold_storage: '#0EA5E9',   // sky blue - cold
   cold_rail: '#06B6D4',      // cyan - cold
   dry_rail: '#F59E0B',       // amber - dry goods
   freezer: '#3B82F6',        // blue - frozen
   ambient: '#84CC16',        // lime - room temp
   work_surface: '#A855F7',   // purple - work area
   equipment: '#F97316',      // orange - equipment
   packaging: '#EC4899',      // pink - packaging
   kit_storage: '#14B8A6',    // teal - kits
   window_shelf: '#EAB308',   // yellow - pass window
   hot_hold_well: '#EF4444',  // red - hot holding
   other: '#6B7280',          // gray - fallback
 };
 
 export type KitchenGrouping = { id: GroupingId; label: string; color: string };
 
 export const KITCHEN_GROUPINGS: KitchenGrouping[] = [
   { id: 'hot_side', label: 'Hot Side', color: '#FEE2E2' },   // warm red
   { id: 'cold_side', label: 'Cold Side', color: '#DBEAFE' }, // cool blue
   { id: 'vending', label: 'Vending', color: '#F3E8FF' },     // purple
 ];
 
export const KITCHEN_GROUPING_BY_ID = new Map<GroupingId, KitchenGrouping>(
  KITCHEN_GROUPINGS.map(g => [g.id, g])
);

 export const STATION_SHORT_LABELS: Record<string, string> = {
   hot_side: 'HOT',
   cold_side: 'COLD',
   prep: 'PREP',
   garnish: 'GARN',
   vending: 'VEND',
   expo: 'EXPO',
   pass: 'PASS',
   other: '?',
 };
