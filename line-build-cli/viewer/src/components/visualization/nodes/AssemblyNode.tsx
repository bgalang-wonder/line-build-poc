 import React from 'react';
 import { getGroupColor, getLightTint } from '@/lib/componentColors';
 
 type AssemblyMeta = {
   id: string;
   name?: string;
   groupId?: string;
   subAssemblies?: string[];
   lineage?: { evolvesFrom?: string };
 };
 
 export function renderAssemblyLabel(
   assembly: AssemblyMeta, 
   viewMode: 'compact' | 'expanded',
   baseComponents: Array<{id: string; name: string; color: string}>,
   showKitchenLayout: boolean,
   sourceLabel?: string
 ): React.ReactNode {
   return (
     <div className={`text-center w-full ${viewMode === 'expanded' ? 'text-left space-y-1' : ''}`}>
       {baseComponents.length > 1 && (
         <div className="absolute -top-2 -right-2 bg-violet-600 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow z-10">
           {baseComponents.length}
         </div>
       )}
       <div className={`font-bold leading-tight ${viewMode === 'compact' ? 'text-[11px]' : 'text-sm'}`} style={{ color: '#111827' }}>
         {assembly.name || assembly.id}
       </div>
       {!showKitchenLayout && sourceLabel && (
         <div className="text-[10px] text-neutral-500 font-medium mt-0.5">📍 {sourceLabel}</div>
       )}
       {viewMode === 'expanded' && (
         <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">{assembly.groupId || 'no group'}</div>
       )}
     </div>
   );
 }
