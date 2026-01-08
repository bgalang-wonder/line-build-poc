---
type: meeting
status: current
project: line-build-redesign
title: "Line build tool planning with complexity score exploration for Infinite Kitchen project"
date: 2025-12-11
participants: ["Brandon Galang", "(unnamed stakeholder)"]
author: Brandon Galang
tags: [line-builds, cutover, kds, infinite-kitchen, complexity-score, rollout, migration]
related: [prd-reference-first-line-builds.md, analysis-abstraction-context-v1.md, analysis-poc-context-v1.md]
---

# Cutover strategy (as discussed in Dec 11 meeting)

## Why a cutover strategy is needed

- **Legacy reality:** today’s Cookbook line builds are mostly unstructured “sticky-note” instructions that feed KDS.
- **New need:** both **complexity scoring** and **Infinite Kitchen** require more granular, machine-readable steps.
- **Constraint:** we cannot realistically rewrite Cookbook + KDS end-to-end quickly; a full cutover to new structured line builds is likely a **6–12 month** effort (or more) because it touches:
  - line build data model
  - authoring UX
  - downstream KDS integration contract
  - deployment/rollback and operational validation

The strategy below is designed to deliver near-term value (complexity scoring + early IK foundations) without breaking production.

## The proposed cutover model: “New upstream, legacy downstream”

### Core concept

Build a **new line build tool** that becomes the **authoritative upstream source** for a more structured, “bench-top” line build.

Then generate a **legacy-compatible line build** representation that continues to feed KDS until KDS is ready to consume the new structured model directly.

In short:

1. **Author once** in the new tool (structured).
2. **Auto-convert** to the old format (unstructured-ish) for KDS.
3. **Store safely** (attach to item record / Cookbook as system-of-record).
4. **Later:** when KDS is ready, cut over to consuming the new format directly.

### Why this works

- Chefs enter data **one time**, not twice.
- We preserve the current production KDS pathway while we validate the new model.
- We get immediate leverage: complexity scoring, simulations, bulk editing, and AI assistance can all operate on the structured upstream model.

## Phased rollout (sequence + deliverables)

### Phase 0 — Prove the “bench-top” tool is useful (Q1-level outcome)

**Goal:** a usable internal app that is better than spreadsheets and can support complexity exploration.

**Key characteristics:**
- Runs as a separate app (not necessarily inside Cookbook).
- Uses periodic data snapshots (e.g., from BigQuery) so it stays reasonably up to date.
- Supports structured data entry/editing + analytics.
- Supports “copilot” style editing and bulk updates (agent/LLM-assisted).

**Notes from meeting:**
- Early prototype already exists and was built quickly (weekend-level effort).
- With limited time (5–6 hrs/week), a functional tool is plausible within Q1 for internal use (not production-grade).

### Phase 1 — Add the conversion pipeline: new → legacy (MVP cutover bridge)

**Goal:** chefs still author once, but production systems can keep using the legacy line build format.

**What gets built:**
- A translation layer that converts structured steps into the legacy line build representation KDS expects.
- A workflow to **upload/publish** the converted legacy line build back into Cookbook.
- A storage strategy so the “new format” is saved/attached to the item record (system-of-record).

**Important nuance:**
- The conversion is described as feasible to implement quickly *once the new structured model is defined*.
- The conversion may not be perfectly deterministic if it uses AI, but can be high accuracy with preview/approval.

### Phase 2 — Operationalize: previews, safety, auditability

**Goal:** make the bridge safe enough to use regularly.

**Key product requirements implied by the meeting:**
- Preview of the generated legacy output before publish.
- A clear pipeline so teams understand:
  - what is authored (new)
  - what is generated (legacy)
  - what is actually running in KDS
- Strong guardrails so the system does not drift back into “manual duplication.”

### Phase 3 — Full cutover: KDS consumes the new structured model (6–12 month horizon)

**Goal:** eliminate the legacy line build format entirely.

**Why it’s the hard part:**
- KDS integration is legacy-heavy and has years of assumptions.
- Moving to more granular “machine action” steps likely requires:
  - new contract
  - validation in restaurants
  - side-by-side testing
  - careful migration/rollout controls

**Meeting estimate:**
- 6 months would be very optimistic.
- 12 months is a more realistic planning assumption.

## Where AI/agents fit in the cutover

The meeting proposes using AI as the leverage multiplier, specifically:

1. **Authoring assistance**
   - An agent can help build/edit structured line builds (even via natural language or voice commands).
   - Example mentioned: “Barbacoa tacos is not in water bath anymore; it’s pitco.”

2. **New → legacy conversion assistance**
   - Because legacy line builds are so unstructured, converting structured → unstructured is comparatively easy.
   - AI can help generate the “legacy phrasing” and format, with a human preview.

3. **Analysis + simulation**
   - With structured data in place, AI can surface inconsistencies and opportunities (e.g., infeasible BOM quantities given container size).

**Guardrail principle:** AI is a productivity layer; the workflow must still be safe via preview + validation.

## Storage + system-of-record approach (explicitly discussed)

The meeting suggests an MVP where the new tool is outside Cookbook, but **the output is saved into Cookbook** so it is attached to the item record.

A practical model:

- Pull snapshot from BigQuery → edit in new tool → generate:
  - structured “bench-top” record (stored/attached)
  - legacy line build (published for KDS)

This ensures:
- durability
- traceability
- a single place to find the current approved state

## Key trade-offs and constraints (explicit)

- Maintaining “two line builds” is acknowledged as unavoidable in the near term, but the strategy minimizes pain by:
  - keeping humans responsible for only one (the new one)
  - auto-generating the legacy representation

- The biggest risk is not building the conversion. The biggest risk is defining the new structured model correctly and getting adoption.

## Timeline expectations captured in the meeting

- **Complexity-score usable app:** plausible within Q1 (internal tool, not production-grade).
- **Integration to legacy Cookbook (publish legacy line build):** requires additional engineering work; likely the gating item.
- **Full KDS cutover to new structured data:** likely 6–12 months.

## Open questions to resolve (implied by the discussion)

1. **Where should the new authoring tool live long-term?**
   - inside Cookbook vs owned elsewhere (Jason’s domain was mentioned)

2. **How deterministic must new → legacy conversion be?**
   - fully deterministic template vs AI-generated with preview

3. **What are the acceptance tests for “ready to cut over”?**
   - side-by-side KDS comparison, error budgets, restaurant pilot criteria

4. **How do we prevent duplicated human work?**
   - ensure legacy is always generated, not manually edited

## Recommended next step

Confirm the MVP cutover contract in one sentence:

> “Chefs author only the new structured line build; we auto-generate and publish the legacy KDS line build from it until KDS can consume the new model directly.”

Once agreed, we can define:
- the publish workflow (preview → approve → write into Cookbook)
- the audit trail
- the pilot scope (which cuisine/items/sites)
