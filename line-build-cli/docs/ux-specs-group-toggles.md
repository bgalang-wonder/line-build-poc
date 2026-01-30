# Material Flow Groups Toggles - UX Specification

## Problem Statement

The current Groups section in Material Flow mode (GraphLayerToggles.tsx:218-246) has scalability issues:

1. **Space inefficiency**: All groups displayed inline causes wrapping when >5 groups exist
2. **Poor scannability**: No visual hierarchy or organization
3. **Missing bulk operations**: No "Select All" / "Clear All" functionality
4. **Accessibility gaps**: Color-only indication of selection state

## Strategic Principles

### Even/Over Framework

1. **Scannability even over completeness** → Progressive disclosure for >5 groups
2. **Speed even over flexibility** → Quick presets for common operations
3. **Recognition even over recall** → Show node counts per group

### Applied Laws of UX

- **Hick's Law**: Reduce decisions with presets ("All", "None", "Primary")
- **Miller's Law**: Chunk when >7 groups (use dropdown)
- **Doherty Threshold**: Instant visual feedback (<400ms)
- **Jakob's Law**: Follow standard multi-select patterns (chips + checkboxes)

---

## Proposed Solution: Compact Mode with Progressive Disclosure

### Visual Hierarchy (3 Display Modes)

#### Mode 1: Inline (≤5 groups)
```
Groups: [All] [None] | main (8) · side-1 (2) · garnish (3)
```

#### Mode 2: Compact + Expandable (6-10 groups)
```
Groups: [All] [None] | main (8) · side-1 (2) · +3 more ↓
                                                        ↑ Expand button
```

When expanded:
```
Groups: [All] [None] | main (8) · side-1 (2) · garnish (3) · sauce (1) · prep (2) ↑
```

#### Mode 3: Menu (>10 groups)
```
Groups: [All] [None] | 8 of 12 selected ⌄
                                          ↓ Opens dropdown menu
```

### State Machine

```typescript
type GroupsDisplayMode = 'inline' | 'compact' | 'menu';
type GroupsExpansionState = 'collapsed' | 'expanded';

interface GroupsState {
  displayMode: GroupsDisplayMode;
  expansionState: GroupsExpansionState;
  selectedGroupIds: string[];
  availableGroups: Array<{
    id: string;
    nodeCount: number;
    color: string;
  }>;
}

// Mode selection logic:
function selectDisplayMode(groupCount: number): GroupsDisplayMode {
  if (groupCount <= 5) return 'inline';
  if (groupCount <= 10) return 'compact';
  return 'menu';
}

// States:
// 1. inline → always expanded (no collapse needed)
// 2. compact/collapsed → shows first 2-3 groups + "X more" button
// 3. compact/expanded → shows all groups inline
// 4. menu/collapsed → shows summary count + dropdown icon
// 5. menu/expanded → shows dropdown with checkbox list
```

### Component Structure

```typescript
// New component: GroupsFilter
export type GroupsFilterProps = {
  selectedGroupIds: string[];
  availableGroups: Array<{
    id: string;
    nodeCount: number;
    color: string;
  }>;
  onToggleGroupId: (groupId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

// Internal state:
const [isExpanded, setIsExpanded] = useState(false);
const displayMode = selectDisplayMode(availableGroups.length);
```

---

## Detailed Specifications

### 1. Preset Buttons

**"All" Button:**
- Label: `All` or `All (12)` if counts shown
- Action: Select all groups
- State: Primary style when all selected
- Keyboard: `Alt+A` shortcut

**"None" Button:**
- Label: `None`
- Action: Deselect all groups
- State: Primary style when none selected
- Keyboard: `Alt+N` shortcut

**"Primary" Button (Optional):**
- Label: `Main Track` or auto-detect largest group
- Action: Select only the primary group
- Show only when >3 groups exist

### 2. Group Pills (Inline/Compact Modes)

**Visual Design:**
```
Selected:   [main 8] ← filled with group color, white text
Unselected: main 8   ← gray text, no background, lower opacity
```

**Hover States:**
```
Selected:   [main 8] ← slightly darker shade on hover
Unselected: [main 8] ← light gray background on hover
```

**Accessibility:**
- Use aria-pressed="true|false" for toggle state
- Include checkmark icon (✓) in addition to color for selected state
- Focus ring must be visible and high contrast

**Structure:**
```tsx
<button
  type="button"
  role="checkbox"
  aria-checked={isSelected}
  aria-label={`${groupId} group, ${nodeCount} nodes`}
  onClick={() => onToggleGroupId(groupId)}
  className={...}
>
  {isSelected && <CheckIcon className="w-3 h-3 mr-1" />}
  <span>{groupId}</span>
  {showCounts && <span className="opacity-75 ml-1">{nodeCount}</span>}
</button>
```

### 3. Expansion Button (Compact Mode)

**Collapsed State:**
```
+4 more ↓
```

**Expanded State:**
```
↑ Show less
```

**Behavior:**
- Click toggles between collapsed/expanded
- Keyboard: `Space` or `Enter` to toggle
- State persists across page reloads (localStorage)

### 4. Dropdown Menu (>10 Groups)

**Trigger Button:**
```
8 of 12 selected ⌄
```

**Menu Content:**
```
┌─────────────────────────────┐
│ [✓] All                     │
│ [ ] None                    │
│ ─────────────────────────   │
│ [✓] main          8 nodes   │
│ [✓] side-1        2 nodes   │
│ [✓] garnish       3 nodes   │
│ [ ] sauce         1 node    │
│ ...                         │
└─────────────────────────────┘
```

**Keyboard Navigation:**
- `↓`/`↑`: Navigate options
- `Space`: Toggle checkbox
- `Enter`: Toggle checkbox
- `Esc`: Close menu
- `Home`/`End`: Jump to first/last

**Accessibility:**
- Use proper `role="menu"` and `role="menuitemcheckbox"`
- Announce counts with `aria-label`
- Focus trap while open
- Return focus to trigger on close

---

## Implementation Plan

### Phase 1: Core Restructure (Week 1)

**Files to modify:**
- `GraphLayerToggles.tsx` (extract Groups section)

**New files:**
- `GroupsFilter.tsx` (main component)
- `GroupsFilterMenu.tsx` (dropdown menu)
- `useGroupsFilter.ts` (state management hook)

**Tasks:**
1. Extract current Groups section into `GroupsFilter` component
2. Add display mode detection logic
3. Implement preset buttons (All/None)
4. Add node counts to group data

### Phase 2: Progressive Disclosure (Week 1-2)

**Tasks:**
1. Implement compact mode with "X more" expansion
2. Add localStorage persistence for expansion state
3. Implement dropdown menu for >10 groups
4. Add keyboard shortcuts

### Phase 3: Accessibility & Polish (Week 2)

**Tasks:**
1. Add ARIA attributes and roles
2. Implement keyboard navigation
3. Add focus management
4. Add visual indicators beyond color (checkmarks, icons)
5. Test with screen readers (NVDA, JAWS, VoiceOver)

### Phase 4: Validation (Week 2)

**Usability Testing:**
- Task 1: "Show only the main track" (success = <3 seconds)
- Task 2: "View all groups with more than 5 nodes" (success = find + select <10 seconds)
- Task 3: "Toggle between viewing one group vs all groups" (success = <5 seconds)

**Metrics:**
- Time to complete tasks
- Error rate (selecting wrong groups)
- Preference (old vs new design)

---

## Edge Cases & Guardrails

### 1. No Groups Available
```
Groups: No material flow groups detected
```
- Entire section hidden OR show info message
- Don't show preset buttons if no groups exist

### 2. Single Group
```
Groups: main (8 nodes)
```
- No need for toggles (always visible)
- Hide preset buttons
- Show as static label instead of interactive pill

### 3. All Groups Deselected
```
Graph is empty - Select at least one group to view
```
- Show warning message in graph area
- "All" button becomes prominent (call-to-action style)

### 4. Loading State
```
Groups: Loading... [spinner]
```
- Skeleton pills or spinner while data loads
- Disable interaction until loaded

### 5. Group Name Overflow
```
very-long-group-name-here → very-long-gro... (8)
```
- Truncate with ellipsis after 15-20 characters
- Show full name in tooltip on hover
- Full name in aria-label for screen readers

### 6. Color Accessibility
- If two groups have similar colors (Δ < 3.0 WCAG contrast):
  - Add distinct patterns (stripes, dots, solid)
  - Use icons (●, ■, ▲, ◆) in addition to color
  - Ensure text contrast ratio ≥ 4.5:1

### 7. State Persistence
```typescript
// Save to localStorage on change
const STORAGE_KEY = 'material-flow-groups-state';

interface StoredState {
  expandedState: 'collapsed' | 'expanded';
  lastSelectedGroups: string[];
  timestamp: number;
}

// Clear after 24 hours (stale state)
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Display mode automatically selects based on group count (≤5 inline, 6-10 compact, >10 menu)
- [ ] "All" button selects all groups in one click
- [ ] "None" button deselects all groups in one click
- [ ] Compact mode shows "X more" button when collapsed
- [ ] Expansion state persists across page reloads (localStorage)
- [ ] Dropdown menu shows checkboxes with node counts
- [ ] Graph updates immediately (<400ms) when selections change

### Accessibility Requirements (WCAG 2.1 AA)

- [ ] All interactive elements keyboard accessible (Tab, Space, Enter)
- [ ] Focus indicators visible with 3:1 contrast ratio
- [ ] Selected state indicated by checkmark icon + color (not color alone)
- [ ] aria-checked/aria-pressed correctly applied
- [ ] Screen reader announces: "main group, 8 nodes, selected" or "not selected"
- [ ] Dropdown menu implements focus trap and Esc to close
- [ ] Color contrast ≥ 4.5:1 for text on colored backgrounds

### Visual Requirements

- [ ] Selected groups use group color with white text
- [ ] Unselected groups use gray text with 50% opacity
- [ ] Hover states provide visual feedback (background change)
- [ ] Node counts displayed in parentheses or as badges
- [ ] Spacing prevents accidental clicks (≥4px between pills)
- [ ] Wrapping handled gracefully (max 2 lines before "more" button)

### Performance Requirements

- [ ] Toggle action completes in <100ms (perceived as instant)
- [ ] Graph re-layout completes in <400ms (Doherty Threshold)
- [ ] Dropdown opens in <100ms
- [ ] No layout shift when expanding/collapsing

---

## Future Enhancements (Out of Scope)

1. **Group Search/Filter** (for >20 groups)
   - Add search box in dropdown menu
   - Filter groups by name as user types

2. **Smart Grouping**
   - Auto-detect "Main Track" vs "Side Tracks"
   - Provide "Show Main Only" preset

3. **Group Reordering**
   - Drag-and-drop to reorder groups
   - Remember user's preferred order

4. **Saved Presets**
   - Allow users to save custom group combinations
   - Quick-switch between saved views

5. **Keyboard Power User Mode**
   - Number shortcuts (1-9) to toggle first 9 groups
   - `Ctrl+A` to select all, `Ctrl+Shift+A` to deselect all

---

## Rollout Plan

### Development
- Week 1: Phases 1-2 (core + progressive disclosure)
- Week 2: Phases 3-4 (a11y + validation)

### Testing
- Internal testing with 5 team members
- Usability test with 3-5 external users
- A11y audit with screen readers

### Launch
- Feature flag: `material-flow-compact-groups` (default off)
- Enable for 25% of users week 1
- Enable for 100% of users week 2 if metrics pass
- Keep old implementation for 1 sprint (easy rollback)

### Success Metrics
- Task completion time reduced by >30%
- Zero critical a11y issues
- User preference >70% (vs old design)
- No increase in error rate

---

## Technical Notes

### Integration with Existing Code

**Current props (GraphLayerToggles.tsx:100-110):**
```typescript
selectedGroupIds?: string[];
availableGroupIds?: string[];
groupColorMap?: Map<string, string>;
onToggleGroupId?: (groupId: string) => void;
```

**New props needed:**
```typescript
// Add to ModeOptionsProps
groupNodeCounts?: Map<string, number>;  // node count per group
onSelectAllGroups?: () => void;
onSelectNoGroups?: () => void;
groupsExpansionState?: 'collapsed' | 'expanded';  // for persistence
onSetGroupsExpansion?: (state: 'collapsed' | 'expanded') => void;
```

**Parent component changes (DAGVisualization.tsx):**
```typescript
// Add node counting logic
const groupNodeCounts = useMemo(() => {
  const counts = new Map<string, number>();
  nodes.forEach(node => {
    const groupId = node.data.groupId;
    if (groupId) {
      counts.set(groupId, (counts.get(groupId) || 0) + 1);
    }
  });
  return counts;
}, [nodes]);

// Add bulk operations
const handleSelectAllGroups = () => {
  setSelectedGroupIds(availableGroupIds);
};

const handleSelectNoGroups = () => {
  setSelectedGroupIds([]);
};

// Pass to ModeOptions
<ModeOptions
  {...props}
  groupNodeCounts={groupNodeCounts}
  onSelectAllGroups={handleSelectAllGroups}
  onSelectNoGroups={handleSelectNoGroups}
/>
```

---

## References

- WCAG 2.1 Understanding Docs: https://www.w3.org/WAI/WCAG21/Understanding/
- Laws of UX: https://lawsofux.com/
- Digital.gov HCD Guide: https://digital.gov/topics/human-centered-design/
- Material Design - Selection Controls: https://m2.material.io/components/selection-controls

---

## Appendix: Implementation Code Sketch

### GroupsFilter.tsx (Simplified)

```typescript
import React, { useState, useEffect } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';

export type GroupsFilterProps = {
  selectedGroupIds: string[];
  availableGroups: Array<{
    id: string;
    nodeCount: number;
    color: string;
  }>;
  onToggleGroupId: (groupId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

type DisplayMode = 'inline' | 'compact' | 'menu';

function selectDisplayMode(count: number): DisplayMode {
  if (count <= 5) return 'inline';
  if (count <= 10) return 'compact';
  return 'menu';
}

export function GroupsFilter({
  selectedGroupIds,
  availableGroups,
  onToggleGroupId,
  onSelectAll,
  onSelectNone,
}: GroupsFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayMode = selectDisplayMode(availableGroups.length);

  const allSelected = selectedGroupIds.length === availableGroups.length;
  const noneSelected = selectedGroupIds.length === 0;

  // Compact mode: show first 3, hide rest
  const visibleGroups = isExpanded || displayMode === 'inline'
    ? availableGroups
    : availableGroups.slice(0, 3);
  const hiddenCount = availableGroups.length - visibleGroups.length;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-500">Groups:</span>

      {/* Preset Buttons */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onSelectAll}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            allSelected
              ? 'bg-neutral-800 text-white border-neutral-800'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
          }`}
          aria-label={`Select all ${availableGroups.length} groups`}
        >
          All {availableGroups.length > 0 && `(${availableGroups.length})`}
        </button>
        <button
          type="button"
          onClick={onSelectNone}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            noneSelected
              ? 'bg-neutral-800 text-white border-neutral-800'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
          }`}
          aria-label="Deselect all groups"
        >
          None
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-300" />

      {/* Group Pills (Inline/Compact modes) */}
      {displayMode !== 'menu' && (
        <div className="flex flex-wrap gap-1 items-center">
          {visibleGroups.map((group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            return (
              <button
                key={group.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`${group.id} group, ${group.nodeCount} nodes, ${isSelected ? 'selected' : 'not selected'}`}
                onClick={() => onToggleGroupId(group.id)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-all
                  ${isSelected
                    ? 'border-transparent text-white'
                    : 'border-neutral-300 text-neutral-500 bg-white hover:bg-neutral-50 opacity-50'
                  }
                `}
                style={isSelected ? { backgroundColor: group.color } : {}}
              >
                {isSelected && <CheckIcon className="w-3 h-3" />}
                <span>{group.id}</span>
                <span className="opacity-75">({group.nodeCount})</span>
              </button>
            );
          })}

          {/* Expansion Toggle (Compact mode only) */}
          {displayMode === 'compact' && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded"
              aria-label={isExpanded ? 'Show less' : `Show ${hiddenCount} more groups`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon className="w-3 h-3" />
                  Show less
                </>
              ) : (
                <>
                  +{hiddenCount} more
                  <ChevronDownIcon className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Menu Mode (>10 groups) */}
      {displayMode === 'menu' && (
        <GroupsFilterMenu
          selectedGroupIds={selectedGroupIds}
          availableGroups={availableGroups}
          onToggleGroupId={onToggleGroupId}
          onSelectAll={onSelectAll}
          onSelectNone={onSelectNone}
        />
      )}
    </div>
  );
}
```

This specification provides a comprehensive blueprint for implementing the Groups filter improvements with a focus on scannability, accessibility, and user efficiency.
