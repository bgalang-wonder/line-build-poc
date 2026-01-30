# Material Flow Groups Toggles - Simple 80/20 Improvement

## Problem
Groups section takes up too much space and lacks quick operations.

## Solution (Simple Changes Only)

### 1. Add Preset Buttons (HIGH IMPACT, LOW COMPLEXITY)

Add two simple buttons before the group pills:

```
Groups: [All] [None] | main (8) · side-1 (2) · garnish (3) · sauce (1)
```

**Implementation:**
- `All` button: calls `onSelectAll()` - selects all groups
- `None` button: calls `onSelectNone()` - deselects all groups
- Parent component provides these handlers (2 simple functions)

**Why this matters:**
- Most common operations become 1-click instead of 5+ clicks
- Works for any number of groups
- Zero state management complexity

---

### 2. Add Node Counts (HIGH IMPACT, LOW COMPLEXITY)

Show how many nodes in each group: `main (8)` instead of just `main`

**Implementation:**
- Parent already has this data (count nodes by groupId)
- Just render it: `{groupId} ({nodeCount})`
- No logic changes, just display

**Why this matters:**
- Users can see which groups are "worth" viewing
- Helps identify the main track vs small side tracks
- Zero complexity - just pass data and render it

---

### 3. Add Checkmark Icons for Selected State (ACCESSIBILITY, LOW COMPLEXITY)

```
Selected:   [✓ main 8]  ← with checkmark
Unselected: [  main 8]  ← no checkmark
```

**Implementation:**
```tsx
{isSelected && <CheckIcon className="w-3 h-3 mr-1" />}
```

**Why this matters:**
- Accessibility: not color-only indication
- Better scannability: quick visual scan for selected items
- Trivial to add (conditional render)

---

### 4. Constrain Height + Scroll (LOW IMPACT, TRIVIAL COMPLEXITY)

If groups wrap beyond 2 rows, add scroll:

```tsx
<div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
  {/* group pills */}
</div>
```

**Why this matters:**
- Prevents excessive vertical space usage
- Works with any number of groups
- Pure CSS solution (no JS)

---

## What We're NOT Doing (Complexity Not Worth It)

❌ **Expansion/collapse states** - adds state management
❌ **Dropdown menus** - complex component, keyboard nav, focus trap
❌ **Display mode detection** - conditional logic branches
❌ **localStorage persistence** - state serialization/hydration
❌ **Smart grouping** - heuristics and algorithms

---

## Implementation Diff

### Changes to GraphLayerToggles.tsx (Lines 218-246)

**BEFORE:**
```tsx
<div className="flex items-center gap-2">
  <span className="text-xs font-medium text-neutral-500">Groups:</span>
  <div className="flex flex-wrap gap-1">
    {availableGroupIds.map((groupId) => {
      const isSelected = selectedGroupIds.includes(groupId);
      const color = groupColorMap?.get(groupId) || '#6B7280';
      return (
        <button
          key={groupId}
          type="button"
          onClick={() => onToggleGroupId(groupId)}
          className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
            isSelected
              ? 'border-transparent text-white'
              : 'border-neutral-300 text-neutral-500 bg-white hover:bg-neutral-50 opacity-50'
          }`}
          style={isSelected ? { backgroundColor: color } : {}}
        >
          {groupId}
        </button>
      );
    })}
  </div>
</div>
```

**AFTER:**
```tsx
<div className="flex items-center gap-2">
  <span className="text-xs font-medium text-neutral-500">Groups:</span>

  {/* NEW: Preset buttons */}
  <div className="flex gap-1">
    <Button
      type="button"
      size="sm"
      variant={allSelected ? "primary" : "secondary"}
      onClick={onSelectAllGroups}
    >
      All
    </Button>
    <Button
      type="button"
      size="sm"
      variant={noneSelected ? "primary" : "secondary"}
      onClick={onSelectNoGroups}
    >
      None
    </Button>
  </div>

  <div className="w-px h-4 bg-neutral-300" />

  {/* UPDATED: Pills with checkmarks + counts + scroll */}
  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
    {availableGroupIds.map((groupId) => {
      const isSelected = selectedGroupIds.includes(groupId);
      const color = groupColorMap?.get(groupId) || '#6B7280';
      const nodeCount = groupNodeCounts?.get(groupId) || 0; // NEW

      return (
        <button
          key={groupId}
          type="button"
          role="checkbox" // NEW: better semantics
          aria-checked={isSelected} // NEW: accessibility
          onClick={() => onToggleGroupId(groupId)}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-all ${
            isSelected
              ? 'border-transparent text-white'
              : 'border-neutral-300 text-neutral-500 bg-white hover:bg-neutral-50 opacity-50'
          }`}
          style={isSelected ? { backgroundColor: color } : {}}
        >
          {/* NEW: Checkmark for selected */}
          {isSelected && <CheckIcon className="w-3 h-3" />}

          {/* UPDATED: Show count */}
          <span>{groupId}</span>
          {nodeCount > 0 && (
            <span className="opacity-75">({nodeCount})</span>
          )}
        </button>
      );
    })}
  </div>
</div>
```

---

## New Props Needed

Add to `ModeOptionsProps`:

```typescript
// NEW props
groupNodeCounts?: Map<string, number>;  // node count per group
onSelectAllGroups?: () => void;         // select all
onSelectNoGroups?: () => void;          // deselect all

// Computed in component
const allSelected = selectedGroupIds.length === availableGroupIds.length;
const noneSelected = selectedGroupIds.length === 0;
```

---

## Parent Component Changes (DAGVisualization.tsx)

Add these simple handlers:

```typescript
// Count nodes per group (simple reduce/map)
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

// Simple bulk operations
const handleSelectAllGroups = () => {
  setSelectedGroupIds([...availableGroupIds]);
};

const handleSelectNoGroups = () => {
  setSelectedGroupIds([]);
};

// Pass to ModeOptions
<ModeOptions
  {...existingProps}
  groupNodeCounts={groupNodeCounts}
  onSelectAllGroups={handleSelectAllGroups}
  onSelectNoGroups={handleSelectNoGroups}
/>
```

---

## Acceptance Criteria (Minimal)

**Functional:**
- [ ] "All" button selects all groups
- [ ] "None" button deselects all groups
- [ ] Node counts display next to group names
- [ ] Checkmark shows on selected groups
- [ ] Pills don't wrap beyond 2 rows (scrollable)

**Accessibility:**
- [ ] `role="checkbox"` on group buttons
- [ ] `aria-checked` reflects selection state
- [ ] Checkmark provides non-color indicator

**No regressions:**
- [ ] Existing toggle behavior unchanged
- [ ] Colors still apply correctly
- [ ] Graph updates on selection change

---

## Effort Estimate

**Developer time:** ~2-3 hours
- 30 min: Add preset buttons + handlers
- 30 min: Add node counts (compute + display)
- 30 min: Add checkmark icons
- 30 min: Add scroll container + test
- 30 min: Testing + polish

**No new files needed.** Just modify existing component.

---

## Visual Before/After

### BEFORE (current)
```
Groups: main · side-1 · garnish · sauce · prep · drinks · dessert · sides
        ↑ wraps to 2-3 lines, hard to quickly select/deselect
```

### AFTER (simple improvements)
```
Groups: [All] [None] | [✓ main 8] · [✓ side-1 2] · garnish (3) · sauce (1)
                       ↑ clear selection, counts show importance
```

When many groups:
```
Groups: [All] [None] | [✓ main 8] · [✓ side-1 2] · garnish (3) · sauce (1) · prep (2)
                       drinks (1) · dessert (1) · sides (2) · condiments (1)
                       ↑ scrollable after 2 rows, doesn't push content down
```

---

## Why This Is Better Than Complex Solution

| Feature | Simple (This) | Complex (Original) | Impact | Complexity |
|---------|---------------|-------------------|--------|------------|
| Preset buttons | ✓ | ✓ | HIGH | LOW |
| Node counts | ✓ | ✓ | HIGH | LOW |
| Checkmarks | ✓ | ✓ | MEDIUM | LOW |
| Scroll container | ✓ | ✓ | LOW | TRIVIAL |
| Expansion states | ✗ | ✓ | MEDIUM | MEDIUM |
| Dropdown menu | ✗ | ✓ | LOW | HIGH |
| State persistence | ✗ | ✓ | LOW | MEDIUM |
| Display modes | ✗ | ✓ | MEDIUM | HIGH |
| **TOTAL** | **4 features** | **8 features** | **80%** | **20%** |

The simple solution delivers 80% of the value with 20% of the complexity.

---

## Migration Path (If You Want More Later)

This simple solution doesn't preclude future enhancements. If you later need them:

1. **Add expansion**: Wrap in a parent component with `isExpanded` state
2. **Add menu**: Detect `>10 groups` and render dropdown instead
3. **Add persistence**: Save `selectedGroupIds` to localStorage on change

But test this simple version first - it might be all you need.
