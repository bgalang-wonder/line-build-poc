 import React from 'react';
 import { formatStepLabel } from '@/lib/stepLabel';
 import { resolveStepDuration } from '@/lib/timeResolution';
 import { 
   STATION_COLORS, 
   STATION_SHORT_LABELS, 
   type ColorBy,
   type ActionFamily 
 } from '../constants';
 import type { Step, BenchTopLineBuild } from '@/types';
 
 function formatDuration(seconds: number): string {
   if (!Number.isFinite(seconds) || seconds <= 0) return '';
   if (seconds < 60) return `${Math.round(seconds)}s`;
   const mins = Math.floor(seconds / 60);
   const secs = Math.round(seconds % 60);
   return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
 }
 
 export function renderCompactLabel(step: Step, hardErrorCount: number, build: BenchTopLineBuild, assemblyInfo?: { inputCount: number; outputCount: number }, colorBy?: ColorBy): React.ReactNode {
   const targetLabel = step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || '';
   const instructionLabel = typeof step.instruction === 'string' && step.instruction.trim().length > 0
     ? step.instruction.trim()
     : typeof step.notes === 'string' && step.notes.trim().length > 0
       ? step.notes.trim()
       : '';
 
   const resolved = resolveStepDuration(step, { buildId: build.id, buildName: build.name });
   const hasResolvedTime = resolved.seconds > 0;
   const isExplicit = resolved.source === 'explicit';
   
   const stationId = step.stationId || 'other';
   const stationColor = STATION_COLORS[stationId] || STATION_COLORS.other;
   const stationShortLabel = STATION_SHORT_LABELS[stationId] || '?';
   const showStationBadge = colorBy === 'station';
 
   return (
     <div className="relative w-full max-w-[150px] text-center">
       <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
         {formatStepLabel(step.orderIndex)}
       </div>
       {showStationBadge ? (
         <div className="absolute -top-2 right-0 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10" style={{ backgroundColor: stationColor }}>
           {stationShortLabel}
         </div>
       ) : null}
       {hardErrorCount > 0 ? (
         <div className={`absolute -top-2 ${showStationBadge ? 'right-10' : '-right-2'} bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow`}>
           {hardErrorCount}
         </div>
       ) : null}
       {assemblyInfo && assemblyInfo.inputCount > 1 ? (
         <div className="absolute -bottom-2 right-0 bg-purple-600 text-white text-[9px] font-semibold rounded px-1.5 py-0.5 shadow">
           {assemblyInfo.inputCount}→1
         </div>
       ) : null}
       <div className="font-semibold text-xs truncate">{step.action.family}</div>
       {targetLabel ? <div className="text-xs text-neutral-600 truncate">{targetLabel}</div> : null}
       {step.equipment?.applianceId ? <div className="text-xs text-neutral-500">🔧 {step.equipment.applianceId}</div> : null}
       <div className={`text-xs ${isExplicit ? 'text-neutral-500' : 'text-neutral-400 italic'}`}>
         ⏱ {hasResolvedTime ? formatDuration(resolved.seconds) : '—'}
       </div>
       {instructionLabel ? <div className="mt-1 text-[11px] text-neutral-500 line-clamp-2">{instructionLabel}</div> : <div className="mt-1 text-[11px] text-neutral-400">—</div>}
     </div>
   );
 }
 
 export function renderExpandedLabel(step: Step, hardErrorCount: number, build: BenchTopLineBuild, assemblyInfo?: { inputCount: number; outputCount: number }, colorBy?: ColorBy): React.ReactNode {
   const targetLabel = step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || '';
   const quantity = (step as any).quantity;
   const resolved = resolveStepDuration(step, { buildId: build.id, buildName: build.name });
   const hasResolvedTime = resolved.seconds > 0;
   const stationId = step.stationId || 'other';
   const stationColor = STATION_COLORS[stationId] || STATION_COLORS.other;
   const stationShortLabel = STATION_SHORT_LABELS[stationId] || '?';
   const showStationBadge = colorBy === 'station';
 
   return (
     <div className="relative w-full text-left text-[10px] space-y-1">
       <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10">
         {formatStepLabel(step.orderIndex)}
       </div>
       {showStationBadge ? (
         <div className="absolute -top-2 right-0 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow z-10" style={{ backgroundColor: stationColor }}>
           {stationShortLabel}
         </div>
       ) : null}
       {hardErrorCount > 0 ? (
         <div className={`absolute -top-2 ${showStationBadge ? 'right-12' : '-right-2'} bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow z-10`}>
           {hardErrorCount}
         </div>
       ) : null}
       {assemblyInfo && assemblyInfo.inputCount > 1 ? (
         <div className="absolute -bottom-2 right-0 bg-purple-600 text-white text-[9px] font-semibold rounded px-1.5 py-0.5 shadow z-10">
           {assemblyInfo.inputCount}→{assemblyInfo.outputCount}
         </div>
       ) : null}
       <div className="flex items-center justify-between gap-2 pb-1 border-b border-neutral-200">
         <div className="font-bold text-xs text-neutral-900">{step.action.family}</div>
         <div className="text-neutral-500 text-[9px]">ord {step.orderIndex}</div>
       </div>
       {targetLabel ? <div className="text-neutral-700 font-medium truncate">{targetLabel}</div> : null}
       <div className="flex flex-wrap gap-1 text-[9px]">
         {step.stationId && <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.stationId}</span>}
         {step.cookingPhase && <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.cookingPhase}</span>}
         {step.prepType && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{step.prepType}</span>}
       </div>
       {(step.equipment?.applianceId || step.action.techniqueId) && (
         <div className="flex items-center gap-2 text-neutral-600">
           {step.equipment?.applianceId && <span>🔧 {step.equipment.applianceId}</span>}
           {step.action.techniqueId && <span className="text-blue-600">✂ {step.action.techniqueId}</span>}
         </div>
       )}
       <div className={`flex flex-col ${resolved.source === 'explicit' ? 'text-neutral-600' : 'text-neutral-400 italic'}`}>
         <div>⏱ {hasResolvedTime ? formatDuration(resolved.seconds) : '—'}{step.time?.isActive === false ? ' (passive)' : ''}</div>
       </div>
       {step.container && <div className="text-neutral-600">📦 {step.container.type}{step.container.name ? `: ${step.container.name}` : ''}</div>}
       {step.action.family === 'PORTION' && quantity && <div className="text-neutral-600">⚖ {quantity.value} {quantity.unit}</div>}
       {typeof step.instruction === 'string' && step.instruction.trim().length > 0 && (
         <div className="pt-1 border-t border-neutral-100">
           <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Instruction</div>
           <div className="text-neutral-700 whitespace-pre-wrap">{step.instruction.trim()}</div>
         </div>
       )}
       {typeof step.notes === 'string' && step.notes.trim().length > 0 && (
         <div className="pt-1 border-t border-neutral-100">
           <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Notes</div>
           <div className="text-neutral-500 italic whitespace-pre-wrap">{step.notes.trim()}</div>
         </div>
       )}
       {((step.input ?? []).length > 0 || (step.output ?? []).length > 0) && (
         <div className="pt-1 border-t border-neutral-100 text-[9px]">
           {(step.input ?? []).length > 0 && <div className="text-cyan-600">← {(step.input ?? []).map(c => c.source.type === 'in_build' ? (c.source as any).assemblyId : 'external').join(', ')}</div>}
           {(step.output ?? []).length > 0 && <div className="text-green-600">→ {(step.output ?? []).map(p => p.source.type === 'in_build' ? (p.source as any).assemblyId : 'external').join(', ')}</div>}
         </div>
       )}
     </div>
   );
 }
