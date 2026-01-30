 import React from 'react';
 import { formatStepLabel } from '@/lib/stepLabel';
 import { STATION_COLORS } from '../constants';
 import type { StationVisit } from '@/types';
 
 const TRACK_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777'];
 
 export function renderVisitLabel(visit: StationVisit, viewMode: 'compact' | 'expanded', isMergeTarget: boolean, trackIndex?: number): React.ReactNode {
   const stationLabel = visit.stationId.replace('_', ' ').toUpperCase();
   const trackColor = trackIndex !== undefined ? TRACK_COLORS[trackIndex % TRACK_COLORS.length] : '#6B7280';
   const isBouncing = visit.visitNumber > 1;
 
   if (viewMode === 'compact') {
     return (
       <div className="text-center w-full">
         <div className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: trackColor }}>
           {visit.trackId.toUpperCase()}
         </div>
         <div className={`text-xs font-semibold ${isBouncing ? 'text-rose-700' : 'text-neutral-800'}`}>
           {stationLabel} {visit.visitNumber}
           {isBouncing && <span className="ml-1 text-[10px]" title="Station Bouncing detected">⚠️</span>}
         </div>
         <div className="text-[10px] text-neutral-500">{visit.steps.length} steps</div>
       </div>
     );
   }
   return (
     <div className="text-left w-full text-[10px] space-y-1">
       <div className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: trackColor }}>{visit.trackId.toUpperCase()}</div>
       <div className={`font-semibold ${isBouncing ? 'text-rose-700' : 'text-neutral-900'}`}>
         {stationLabel} {visit.visitNumber}
         {isBouncing && <span className="ml-1 text-[10px]" title="Station Bouncing: Inefficient revisit">⚠️</span>}
       </div>
       <div className="text-neutral-500">{visit.steps.length} steps</div>
       <div className="border-t border-neutral-200 pt-1 space-y-0.5">
         {visit.steps.slice(0, 5).map(step => <div key={step.id} className="text-[9px] text-neutral-500 truncate">{formatStepLabel(step.orderIndex)} {step.action.family}</div>)}
       </div>
     </div>
   );
 }
