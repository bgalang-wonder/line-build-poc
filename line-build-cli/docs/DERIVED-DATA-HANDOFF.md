# Handoff: Derived Data Architecture Decision

**Date:** 2025-01-24
**Context:** Line Build CLI refactoring
**Status:** Needs assessment and solution proposal

---

## Problem Statement

The line build system derives data from authored content (e.g., transfer steps from component flow). Currently, this derived data is stored directly on the build object. This creates potential issues with data staleness and conceptual mixing of authored vs computed data.

**Your task:** Assess the current implementation, evaluate the options, and propose a solution.

---

## Current Implementation

### How Derived Transfers Work

When a build is normalized (`normalizeBuild()` in `scripts/lib/normalize.ts`), the system:

1. Analyzes component flow between steps (which step outputs component X, which step inputs it)
2. Compares locations (producer's output location vs consumer's input location)
3. If locations differ → generates a `DerivedTransferStep` representing the implicit movement

```typescript
// scripts/lib/transfers.ts
export function deriveTransferSteps(build: BenchTopLineBuild): DerivedTransferStep[] {
  const producers = buildProducerMap(build);  // componentId → {stepId, outputLocation}
  const derivedTransfers: DerivedTransferStep[] = [];

  for (const step of build.steps) {
    for (const inp of step.input || []) {
      if (inp.source.type !== "in_build") continue;

      const producer = producers.get(inp.source.componentId);
      if (!producer) continue;

      const fromLocation = producer.outputLocation;
      const toLocation = inp.from ?? step.from;

      if (locationsMatch(fromLocation, toLocation)) continue;

      // Generate transfer step...
      derivedTransfers.push(transfer);
    }
  }
  return derivedTransfers;
}
```

### Where Derived Data is Stored

The `BenchTopLineBuild` schema includes a `derivedTransfers` field:

```typescript
// scripts/lib/schema/build.ts
export interface BenchTopLineBuild {
  // ... authored fields ...
  steps: Step[];
  components?: Component[];

  // Derived data (populated during normalization)
  derivedTransfers?: DerivedTransferStep[];
}
```

### When Normalization Runs

Normalization happens on every write:
- `lb write` → `parseBuild()` → `normalizeBuild()` → `writeBuild()`
- `lb edit --apply` → load → edit → `normalizeBuild()` → `writeBuild()`

So derived transfers are recomputed from scratch on each save.

---

## The Concerns

### 1. Staleness Risk

If someone edits the build JSON directly (not through CLI), the `derivedTransfers` array becomes stale - it no longer reflects the actual step/component structure.

### 2. Conceptual Mixing

The build JSON mixes authored data (what the user/agent created) with computed data (what the system derived). This makes it unclear what's "source of truth" vs "can be regenerated."

### 3. Step Removal Cleanup

When a step is removed, what happens to transfers that referenced it? Currently: they get recomputed on next normalize. But if normalize doesn't run, they're orphaned.

### 4. Viewer/Analysis Accuracy

The DAG viewer and complexity scoring read `derivedTransfers` from the stored build. If stale, they show incorrect information.

---

## Options to Evaluate

### Option A: Compute on Demand (Don't Persist)

Remove `derivedTransfers` from the stored build schema. Compute them when needed.

**Changes required:**
- Remove `derivedTransfers` from `BenchTopLineBuildSchema`
- Viewer computes transfers when rendering
- Complexity scoring computes transfers when analyzing
- Remove from `normalizeBuild()` output

**Pros:**
- Always fresh - impossible to have stale data
- Clear separation: stored = authored, computed = derived
- Simpler schema

**Cons:**
- Recomputes every read (minor perf cost, but transfers are cheap)
- Can't query stored builds for transfer info without recomputing

### Option B: Separate Derived Layer

Store derived data in parallel files:

```
data/line-builds/build-123.json     # Authored only
data/derived/build-123.derived.json # { transfers, computedAt, sourceHash }
```

**Changes required:**
- New `DerivedBuildData` type and schema
- New storage functions for derived layer
- Hash the source build to detect when derived is stale
- Update viewer/analysis to load both files

**Pros:**
- Clean separation of concerns
- Can cache derived data (don't recompute if source unchanged)
- Easy to invalidate (delete derived file)
- Can version/audit derived data separately

**Cons:**
- More files to manage
- Must keep in sync (or detect staleness via hash)
- More complex storage layer

### Option C: Keep Current with Clear Marking

Keep storing on build, but:
1. Ensure ALL mutations go through normalization (audit edit paths)
2. Add metadata to mark derived sections

```typescript
{
  steps: [...],
  components: [...],
  _derived: {
    transfers: [...],
    computedAt: "2026-01-24T00:00:00Z",
    sourceStepsHash: "abc123"  // Hash of steps at computation time
  }
}
```

**Changes required:**
- Move `derivedTransfers` under `_derived` namespace
- Add hash/timestamp for staleness detection
- Validate on read: if hash doesn't match current steps, recompute

**Pros:**
- Minimal schema change
- Self-contained (one file per build)
- Can detect and auto-fix staleness

**Cons:**
- Still mixing authored + derived in one object
- Must implement hash comparison
- `_derived` convention is non-standard

---

## Files to Review

| File | Purpose |
|------|---------|
| `scripts/lib/transfers.ts` | Transfer derivation logic |
| `scripts/lib/normalize.ts` | Where derivation is called |
| `scripts/lib/schema/build.ts` | BenchTopLineBuild schema with derivedTransfers |
| `scripts/lib/complexity.ts` | Consumes derivedTransfers for scoring |
| `viewer/` | Consumes derivedTransfers for visualization |

---

## Questions to Answer

1. **How often are transfers actually used?** (Viewer, complexity scoring, anywhere else?)

2. **What's the performance cost of recomputing?** (Probably negligible for builds with <100 steps)

3. **Are there other derived fields we should consider?** (e.g., derived dependencies are currently merged into `dependsOn` - should those also be separated?)

4. **What's the viewer's tolerance for computation?** (Can it compute on render, or does it need pre-computed data?)

5. **Do we need historical derived data?** (e.g., "what were the transfers when this build was published?")

---

## Recommendation Request

Please:
1. Review the current implementation in the files listed above
2. Evaluate the three options against the concerns
3. Propose a solution with implementation plan
4. Identify any concerns or edge cases I haven't considered

---

## Context: Recent Refactoring

We just completed a refactoring that split large files into modules:
- `schema.ts` → `schema/` directory (enums, step, component, build, index)
- `validate.ts` → `validate/` directory (helpers, hard-rules, hard-rules-advanced, composition-rules, soft-rules, index)

The codebase is in a clean state with all tests passing. Any solution should maintain this modularity.
