# Line Build Redesign — Progress Log

## 2026-01-10 — Schema MECE + extensibility updates (flow + prepared components)

### Why this update

We identified a core gap in the canonical v1 schema: it models a **work graph** (steps + ordering + optional dependsOn), but does not sufficiently model **material flow**.

Stakeholders want to represent:
- multiple components moving through the kitchen in parallel,
- joins where paths merge (e.g., assembly, packaging), and
- use of **pre-prepped components** where the component itself has a dedicated build.

Trying to force these requirements into `step.target` would overload `target` (semantic identity) with flow semantics (state), which is not MECE and would cause future schema expansion / awkward workarounds.

### Decisions made

1) **Build identity is item-centric**
- We added `itemId` to `BenchTopLineBuild` as the canonical identifier (builds can represent 80* menu items OR prepared component items).
- `menuItemId` is retained as optional back-compat for MVP/POC tooling.

2) **Prepared components are first-class composition**
- We added `requiresBuilds?: BuildRef[]` to represent that a build depends on other items’ published builds.
- MVP policy: `requiresBuilds` references published builds only.

3) **Material flow is modeled explicitly via artifacts**
- We added optional artifact flow types:
  - `build.artifacts?: Artifact[]`
  - `build.primaryOutputArtifactId?: string`
  - `step.consumes?: ArtifactRef[]`
  - `step.produces?: ArtifactRef[]`
- This is distinct from `dependsOn` (work ordering).

4) **Single primary output per build**
- We assume each build has exactly one default/primary output. This enables simple cross-build consumption without multi-output modeling.

### Invariant updates

We introduced invariants to keep composition and flow auditable and resolvable:
- `requiresBuilds[].itemId` unique and no self-dependency.
- Any `external_build` reference in `step.consumes` must be declared in `build.requiresBuilds`.
- Any in-build `artifactId` reference in consumes/produces must exist in `build.artifacts`.
- When artifacts are used, `primaryOutputArtifactId` should be set (Strong invariant).

We also tightened MECE guidance between `Step.kind` and `action.family`:
- `kind` is treated as a UX/display hint.
- `action.family` remains the semantic spine.

### Files updated

- `docs/spec/SCHEMA-REFERENCE.md`
  - Added `itemId`, `requiresBuilds`, `artifacts`, `primaryOutputArtifactId`
  - Added artifact flow types and composition types
  - Clarified semantics: work graph vs material graph

- `docs/spec/INVARIANTS.md`
  - Added hard invariants for composition/flow integrity
  - Added strong invariant for primary output artifact
  - Updated strong invariant section to remove dependence on `kind="component"`

- `docs/spec/HARD-RULES.md`
  - Updated referenced fields list to include composition/flow fields

- `docs/spec/AI-AGENT-PROMPT.md`
  - Updated workflow to detect prepared components and model joins via consumes/produces
  - Updated output shape guidance to prefer `itemId`

- `docs/spec/POC-PLAN.md`
  - Updated list output to reference `itemId`
  - Clarified DAG viewer scope as work graph; noted optional flow view

- `docs/prd/PRD-FULL.md`
  - Aligned action vocabulary list with canonical ActionFamily; added mapping note

### Open follow-ups

- Decide whether `Step.kind` should be fully removed (schema simplification) vs retained with stricter invariants.
- Decide whether composition/flow invariants should be publish-blocking in MVP policy (vs tracked as quality).
