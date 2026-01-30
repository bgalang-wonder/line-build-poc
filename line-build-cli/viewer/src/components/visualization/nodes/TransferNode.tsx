import React from 'react';
import type { TransferType, DerivedTransferStep } from '@/types';
import { TRANSFER_NODE_DIMENSIONS } from '../constants';

/**
 * Transfer node colors by type.
 * Uses a cool spectrum (slate → blue → violet) to convey passive/infrastructure.
 */
export const TRANSFER_COLORS: Record<TransferType, string> = {
  intra_station: '#94A3B8', // slate-400
  inter_station: '#3B82F6', // blue-500
  inter_pod: '#7C3AED',     // violet-600
};

/**
 * Human-readable labels for transfer types.
 */
export const TRANSFER_LABELS: Record<TransferType, string> = {
  intra_station: 'Same Station',
  inter_station: 'Station Transfer',
  inter_pod: 'Pod Transfer',
};

/**
 * Get a short label for the transfer badge.
 */
export function getTransferBadgeLabel(transferType: TransferType): string {
  switch (transferType) {
    case 'intra_station': return 'same';
    case 'inter_station': return 'station';
    case 'inter_pod': return 'pod';
  }
}

/**
 * Render the label for a transfer node.
 * Uses a chevron-inspired design with an arrow icon.
 */
export function renderTransferLabel(
  transfer: DerivedTransferStep,
  viewMode: 'compact' | 'expanded'
): React.ReactNode {
  const color = TRANSFER_COLORS[transfer.transferType];
  const label = TRANSFER_LABELS[transfer.transferType];

  return (
    <div
      className={`flex items-center gap-1.5 w-full ${viewMode === 'compact' ? 'justify-center' : ''}`}
      style={{ color: '#FFFFFF' }}
    >
      {/* Arrow icon to convey movement */}
      <span className="text-white/90 text-xs">→</span>
      <div className={viewMode === 'compact' ? 'text-center' : ''}>
        <div className={`font-semibold leading-tight ${viewMode === 'compact' ? 'text-[10px]' : 'text-xs'}`}>
          {label}
        </div>
        {viewMode === 'expanded' && (
          <div className="text-[9px] text-white/70 mt-0.5">
            {transfer.assemblyId}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Build node style for a transfer node.
 * Uses chevron/pentagon shape via clip-path.
 */
export function getTransferNodeStyle(
  transfer: DerivedTransferStep,
  viewMode: 'compact' | 'expanded',
  isSelected: boolean
): React.CSSProperties {
  const color = TRANSFER_COLORS[transfer.transferType];
  const dims = TRANSFER_NODE_DIMENSIONS[viewMode];

  return {
    background: color,
    border: isSelected ? '3px solid #000' : '2px solid transparent',
    borderRadius: '4px',
    // Chevron shape: pentagon pointing right
    clipPath: 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%)',
    padding: '6px 16px 6px 8px',
    width: `${dims.width}px`,
    height: `${dims.height}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: isSelected ? '0 0 0 4px rgba(0, 0, 0, 0.15)' : 'none',
  };
}

/**
 * Render a transfer badge for use in tables/lists.
 */
export function TransferBadge({ transferType }: { transferType: TransferType }) {
  const color = TRANSFER_COLORS[transferType];
  const label = getTransferBadgeLabel(transferType);

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      <span className="opacity-75">→</span>
      {label}
    </span>
  );
}
