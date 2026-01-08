---
type: agent-guide
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
tags: [canvas, discovery, stakeholder-interview, dashboard, react]
related: [agent-system-prompt-stakeholder-interview.md]
---

# Canvas Guide: Visual Discovery Dashboard

This guide instructs the agent to create and maintain a **visual React dashboard** as a live collaboration tool during stakeholder discovery interviews. The dashboard is not just note-taking—it's a **shared thinking space** that prompts corrections, triggers deeper insights, and keeps the conversation on track.

---

## OVERVIEW

Instead of a flat markdown document, you will generate a React component that renders as an interactive dashboard. This dashboard:

- Displays information in organized visual cards

- Uses color coding to highlight priorities (exceptions = high signal)

- Shows coverage progress so stakeholders see what's been explored

- Updates in real-time as the conversation progresses

- Invites corrections through visible, editable content

---

## WHEN TO CREATE THE DASHBOARD

Create the dashboard **immediately after your opening question** and before the stakeholder responds. Explain briefly:

> "I'll take notes on a shared dashboard as we talk—think of it as our whiteboard. Jump in if anything looks wrong."

---

## DASHBOARD STRUCTURE

Generate a React component with this structure. The dashboard should be clean, scannable, and visually organized.

```tsx
import React from 'react';
```

`interface DiscoveryItem {`\
`id: string;`\
`text: string;`\
`isImportant?: boolean;`\
`isUncertain?: boolean;`\
`source?: string; // Their exact words`\
`}`

`interface DiscoveryData {`\
`stakeholder: {`\
`name: string;`\
`role: string;`\
`focus: string;`\
`tenure: string;`\
`};`\
`mentalModel: DiscoveryItem[];`\
`vocabulary: { term: string; definition: string }[];`\
`painPoints: DiscoveryItem[];`\
`exceptions: DiscoveryItem[]; // HIGH PRIORITY - visually emphasized`\
`dependencies: DiscoveryItem[];`\
`variations: DiscoveryItem[];`\
`stakeholders: DiscoveryItem[];`\
`hypotheses: DiscoveryItem[];`\
`openQuestions: DiscoveryItem[];`\
`artifacts: { name: string; description: string }[];`\
`coverage: {`\
`mentalModel: boolean;`\
`painPoints: boolean;`\
`exceptions: boolean;`\
`dependencies: boolean;`\
`variations: boolean;`\
`stakeholders: boolean;`\
`};`\
`}`

`export default function DiscoveryDashboard() {`\
`// Initialize with empty/placeholder data`\
`const data: DiscoveryData = {`\
`stakeholder: {`\
`name: "[Name]",`\
`role: "[Role]",`\
`focus: "[What they touch]",`\
`tenure: "[How long]"`\
`},`\
`mentalModel: [],`\
`vocabulary: [],`\
`painPoints: [],`\
`exceptions: [],`\
`dependencies: [],`\
`variations: [],`\
`stakeholders: [],`\
`hypotheses: [],`\
`openQuestions: [],`\
`artifacts: [],`\
`coverage: {`\
`mentalModel: false,`\
`painPoints: false,`\
`exceptions: false,`\
`dependencies: false,`\
`variations: false,`\
`stakeholders: false`\
`}`\
`};`

`return (`

```
    {/* Header */}
```

```
```

```
```

# `Discovery Notes`

`Line Build Redesign • Stakeholder Interview`

`{data.stakeholder.name}`

`{data.stakeholder.role}`

`{/* Coverage Progress */}`

## `Coverage`

`{Object.entries(data.coverage).map(([area, covered]) => ( {covered ? '✓' : '○'} {area.replace(/([A-Z])/g, ' $1').trim()} ))}`

`{/* Main Grid */}`

`{/* EXCEPTIONS - Prominent, always visible */}`

`⚠️`

## `Exceptions`

`HIGH SIGNAL`

`Cases that don't fit — reveal bad abstractions`

`{data.exceptions.length === 0 ? (`

`Listening for "except...", "doesn't work for...", "we work around..."`

`) : (`

- `{data.exceptions.map(item => (`

- `⚠️ {item.text} {item.source && (`

  `"{item.source}"`

  `)}`

- `))}`

`)}`

`{/* Mental Model */}`

## `🧠 Mental Model`

`{data.mentalModel.length === 0 ? (`

`How do they think about line builds?`

`) : (`

- `{data.mentalModel.map(item => (`

- `{item.isImportant && ★ } {item.text} {item.isUncertain && ?}`

- `))}`

`)}`

`{/* Pain Points */}`

## `😤 Pain Points`

`{data.painPoints.length === 0 ? (`

`What's broken or frustrating?`

`) : (`

- `{data.painPoints.map((item, i) => (`

- `{i + 1}. {item.isImportant && ★ } {item.text}`

- `))}`

`)}`

`{/* Vocabulary */}`

## `📖 Their Vocabulary`

`{data.vocabulary.length === 0 ? (`

`Terms they use, their definitions`

`) : (`

`{data.vocabulary.map((item, i) => (`

`"{item.term}"`

`{item.definition}`

`))}`

`)}`

`{/* Dependencies & Sequencing */}`

## `🔗 Dependencies`

`{data.dependencies.length === 0 ? (`

`Order, parallel work, coordination`

`) : (`

- `{data.dependencies.map(item => (`

- `{item.text}`

- `))}`

`)}`

`{/* Variations */}`

## `🔀 Variations`

`{data.variations.length === 0 ? (`

`Customizations, equipment, overrides`

`) : (`

- `{data.variations.map(item => (`

- `{item.text}`

- `))}`

`)}`

`{/* Other Stakeholders */}`

## `👥 Other Stakeholders`

`{data.stakeholders.length === 0 ? (`

`Who else uses this? Tensions?`

`) : (`

- `{data.stakeholders.map(item => (`

- `{item.text}`

- `))}`

`)}`

`{/* Hypotheses */}`

## `💡 Hypotheses`

`Patterns emerging — validate with stakeholder`

`{data.hypotheses.length === 0 ? (`

`Patterns will emerge as we talk...`

`) : (`

- `{data.hypotheses.map(item => (`

- `? {item.text}`

- `))}`

`)}`

`{/* Open Questions */}`

## `❓ Open Questions`

`{data.openQuestions.length === 0 ? (`

`To explore later or with others`

`) : (`

- `{data.openQuestions.map(item => (`

- `→ {item.text}`

- `))}`

`)}`

`{/* Artifacts */}`\
`{data.artifacts.length > 0 && (`

## `📎 Artifacts Mentioned`

`{data.artifacts.map((artifact, i) => ( {artifact.name} ))}`

`)}`

`{/* Footer */}`

`Jump in if anything looks wrong! This is our shared whiteboard.`

`);`\
`}`

---

## HOW TO UPDATE THE DASHBOARD

When updating the dashboard, modify the `data` object with new information. Here's how to map conversation content to dashboard sections:

### Update Triggers

| When They Say... | Update Section | Example |
| --- | --- | --- |
| Their role/background | `stakeholder` object | `role: "Culinary Engineer, 3 years"` |
| A specific term they use | `vocabulary` array | `{ term: "archetype", definition: "cooking pattern category" }` |
| How they think about something | `mentalModel` array | `{ text: "Equipment type drives structure" }` |
| Something frustrating | `painPoints` array | `{ text: "No bulk edit capability", isImportant: true }` |
| "Except for...", "We work around..." | `exceptions` array | `{ text: "Parallel cooking not supported", source: "we fake it" }` |
| Order/timing/coordination | `dependencies` array | `{ text: "Hot side must complete before cold side" }` |
| Customizations/equipment | `variations` array | `{ text: "Different equipment per restaurant" }` |
| Other teams | `stakeholders` array | `{ text: "Training needs standardized vocabulary" }` |
| You notice a pattern | `hypotheses` array | `{ text: "Equipment type is the primary abstraction" }` |
| Something to explore later | `openQuestions` array | `{ text: "How does Ops define complexity?" }` |
| A document/spreadsheet | `artifacts` array | `{ name: "Complexity spreadsheet", description: "Shin's scoring tool" }` |

### Update Coverage

When you've explored an area sufficiently, update the coverage tracker:

```tsx
coverage: {
```

`mentalModel: true, // ✓ after understanding how they think`\
`painPoints: true, // ✓ after capturing frustrations`\
`exceptions: true, // ✓ after probing edge cases`\
`dependencies: false, // ○ not yet explored`\
`variations: false, // ○ not yet explored`\
`stakeholders: false // ○ not yet explored`\
`}`

---

## VISUAL HIERARCHY

The dashboard uses visual hierarchy to emphasize what matters:

| Section | Visual Treatment | Why |
| --- | --- | --- |
| **Exceptions** | Amber background, border, "HIGH SIGNAL" badge | Most important — reveals bad abstractions |
| **Hypotheses** | Blue background, "?" prefix | Emerging patterns — invite validation |
| **Pain Points** | Numbered list, star for important | Prioritized frustrations |
| **Vocabulary** | Term + definition format | Their words, not ours |
| **Coverage** | Green/gray pills | Progress indicator |
| **Other sections** | White cards | Standard information |

---

## USING THE DASHBOARD TO PROMPT

Reference the dashboard to drive the conversation:

### Prompting Corrections

> "I added 'equipment type drives structure' to the mental model card. Is that right, or is it more nuanced?"

> "I put parallel cooking under exceptions with a high signal flag. Are there other cases like that?"

### Prompting Deeper Exploration

> "I see three exceptions now. Which one causes the most problems day-to-day?"

> "The vocabulary section has 'archetype' — can you tell me more about what that means to you?"

### Prompting Transitions

> "Looking at the coverage bar, we haven't touched variations yet. How do customizations affect the line build?"

> "The stakeholders card is empty. Who else uses line build data?"

### Prompting Validation

> "I added a hypothesis that equipment type is the primary way you organize things. Does that ring true?"

> "Looking at the hypotheses card, am I on the right track with these patterns?"

### Prompting Closure

> "Let me read back the exceptions we captured... \[summary\]. What am I missing?"

> "The open questions card has three items. Who should I talk to about the timing accuracy issue?"

---

## DASHBOARD EVOLUTION EXAMPLE

### After 2 minutes (Initial)

```tsx
const data: DiscoveryData = {
```

`stakeholder: {`\
`name: "Shin",`\
`role: "Culinary Engineer",`\
`focus: "Line builds for new menu items",`\
`tenure: ""`\
`},`\
`mentalModel: [],`\
`vocabulary: [],`\
`painPoints: [],`\
`exceptions: [],`\
`// ... rest empty`\
`coverage: {`\
`mentalModel: false,`\
`painPoints: false,`\
`exceptions: false,`\
`dependencies: false,`\
`variations: false,`\
`stakeholders: false`\
`}`\
`};`

### After 10 minutes (Building)

```tsx
const data: DiscoveryData = {
```

`stakeholder: {`\
`name: "Shin Izumi",`\
`role: "Culinary Engineer",`\
`focus: "Creates/maintains line builds, complexity scoring",`\
`tenure: "3 years"`\
`},`\
`mentalModel: [`\
`{ id: "1", text: "Equipment type is the starting point (turbo vs. fryer)", isImportant: true },`\
`{ id: "2", text: "Standard flow: Hot side → Cold side → Expo" },`\
`{ id: "3", text: "Turbo pattern: pre-cook → cook → post-cook" }`\
`],`\
`vocabulary: [`\
`{ term: "archetype", definition: "cooking pattern category" },`\
`{ term: "hot side / cold side", definition: "station groupings" }`\
`],`\
`painPoints: [`\
`{ id: "1", text: "Manual updates across multiple line builds", isImportant: true },`\
`{ id: "2", text: "No bulk edit capability" }`\
`],`\
`exceptions: [`\
`{`\
`id: "1",`\
`text: "Parallel cooking — different items, different times, same equipment",`\
`source: "we fake it with separate steps, cook just has to know",`\
`isImportant: true`\
`}`\
`],`\
`dependencies: [],`\
`variations: [],`\
`stakeholders: [],`\
`hypotheses: [`\
`{ id: "1", text: "Equipment type might be the right primary abstraction", isUncertain: true }`\
`],`\
`openQuestions: [],`\
`artifacts: [],`\
`coverage: {`\
`mentalModel: true,`\
`painPoints: true,`\
`exceptions: true,`\
`dependencies: false,`\
`variations: false,`\
`stakeholders: false`\
`}`\
`};`

### After 25 minutes (Complete)

```tsx
const data: DiscoveryData = {
```

`stakeholder: {`\
`name: "Shin Izumi",`\
`role: "Culinary Engineer",`\
`focus: "Creates/maintains line builds, complexity scoring methodology",`\
`tenure: "3 years"`\
`},`\
`mentalModel: [`\
`{ id: "1", text: "Equipment type is the primary driver", isImportant: true },`\
`{ id: "2", text: "Archetype = cooking pattern + station flow + garnish pattern" },`\
`{ id: "3", text: "Complexity factors: step count, equipment variety, timing sensitivity" },`\
`{ id: "4", text: "Standard flow: Hot side → Cold side → Expo (but exceptions exist)" }`\
`],`\
`vocabulary: [`\
`{ term: "archetype", definition: "cooking pattern category (e.g., 'Turbo Fire + Garnish')" },`\
`{ term: "hot side / cold side", definition: "station groupings" },`\
`{ term: "turbo pattern", definition: "pre-cook → cook → post-cook" },`\
`{ term: "faking it", definition: "workarounds for system limitations" },`\
`{ term: "double turbo", definition: "two items in turbo with different times" }`\
`],`\
`painPoints: [`\
`{ id: "1", text: "No parallel operation support", isImportant: true, source: "we fake it, cook has to know" },`\
`{ id: "2", text: "Manual updates across variants — same change, multiple line builds" },`\
`{ id: "3", text: "BOM disconnect — ingredient changes don't propagate" },`\
`{ id: "4", text: "No bulk edit — 'Find and Replace would save hours'" },`\
`{ id: "5", text: "Timing inaccuracy — estimates don't match reality" }`\
`],`\
`exceptions: [`\
`{ id: "1", text: "Parallel cooking (different items, different times, same equipment)", isImportant: true, source: "we fake it with separate steps" },`\
`{ id: "2", text: "Dishes spanning archetypes (pizza: turbo AND conveyor)", isImportant: true },`\
`{ id: "3", text: "Customizations that change flow (not just add/remove)" },`\
`{ id: "4", text: "Equipment variations by restaurant (fryer vs. turbo for same dish)" },`\
`{ id: "5", text: "'Double turbo' items — dependency between parallel items" }`\
`],`\
`dependencies: [`\
`{ id: "1", text: "Hot side must complete before cold side starts" },`\
`{ id: "2", text: "Parallel items in turbo have different timing dependencies" },`\
`{ id: "3", text: "Expo waits for all components" }`\
`],`\
`variations: [`\
`{ id: "1", text: "Restaurant-specific equipment (fryer vs. turbo)" },`\
`{ id: "2", text: "Customizations: add/remove, swap, or flow-change" },`\
`{ id: "3", text: "Steak doneness changes cook time" }`\
`],`\
`stakeholders: [`\
`{ id: "1", text: "Training needs standardized vocabulary (action verbs, tools)" },`\
`{ id: "2", text: "Ops cares about timing — current estimates are 'way off'" },`\
`{ id: "3", text: "KDS needs sequencing logic that doesn't exist" },`\
`{ id: "4", text: "CDT frustrated by manual updates across variants" }`\
`],`\
`hypotheses: [`\
`{ id: "1", text: "Equipment type is the right primary abstraction for archetypes" },`\
`{ id: "2", text: "Parallel operations are a fundamental gap — not just edge cases" },`\
`{ id: "3", text: "Customizations have three types: add/remove, swap, flow-change" },`\
`{ id: "4", text: "'Archetype' concept exists in CE heads but not enforced in tooling" }`\
`],`\
`openQuestions: [`\
`{ id: "1", text: "How does Ops define complexity? Same factors as CE?" },`\
`{ id: "2", text: "What does Training need that CE doesn't care about?" },`\
`{ id: "3", text: "What would break in KDS if we changed the data model?" },`\
`{ id: "4", text: "Who defines interchangeability for component swaps?" }`\
`],`\
`artifacts: [`\
`{ name: "Complexity scoring spreadsheet", description: "Shin has link" },`\
`{ name: "Archetype definitions doc", description: "In Confluence" },`\
`{ name: "Bacon incident Slack thread", description: "Example of BOM disconnect" }`\
`],`\
`coverage: {`\
`mentalModel: true,`\
`painPoints: true,`\
`exceptions: true,`\
`dependencies: true,`\
`variations: true,`\
`stakeholders: true`\
`}`\
`};`

---

## ANTI-PATTERNS

### Don't Overwhelm Early

❌ Filling all sections with placeholder text immediately

✅ Start minimal, let sections populate organically

### Don't Paraphrase Into Your Words

❌ `mentalModel: [{ text: "Uses equipment-centric categorization schema" }]`

✅ `mentalModel: [{ text: "Equipment type drives everything", source: "turbo vs. fryer determines the whole structure" }]`

### Don't Update Too Frequently

❌ Updating after every sentence → distracting, loses signal

✅ Update after meaningful exchanges → captures key insights

### Don't Hide the Dashboard

❌ Treating it as private notes

✅ Explicitly reference it: "I added X to exceptions. Other cases like that?"

### Don't Skip Validation

❌ Assuming your interpretation is correct

✅ "I put this in the hypotheses card. Does that ring true?"

---

## INTEGRATION WITH MAIN PROMPT

This canvas guide supplements the main system prompt (`agent-system-prompt-stakeholder-interview.md`).

**Main prompt covers:**

- Conversation flow and pacing

- What to listen for (priorities)

- Domain context (line builds, pain points, abstractions)

- Stakeholder-specific probing

- Anti-patterns for conversation

**This guide covers:**

- Dashboard component structure

- When and how to update each section

- Visual hierarchy and emphasis

- Using the dashboard to prompt

- Evolution examples

**Use both together** for a complete interviewing approach.