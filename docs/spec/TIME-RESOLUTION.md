# Time Resolution and Inheritance

This document describes how the Line Build system determines the duration of a step when explicit timing is missing.

## Inheritance Hierarchy

The system resolves duration using the following priority (first match wins):

1.  **Step-level Override**: If `step.time.durationSeconds` is set and `> 0`.
2.  **Equipment Preset**: If the step is a `HEAT` action and has an `equipment.presetId` (or falls back to a `default` preset for that appliance).
3.  **Technique Default**: If the step has a `techniqueId` (e.g., `dice`, `fold`, `retrieve`).
4.  **Assembly Complexity**: If the step is an `ASSEMBLE` action, the duration is based on the menu item type (e.g., `burrito` vs `bowl`).
5.  **Action Family Default**: Fallback based on the broad category (e.g., `PREP`, `PORTION`, `TRANSFER`).

## Confidence Levels

| Confidence | Source | Description |
| :--- | :--- | :--- |
| **High** | Explicit, Preset | Direct user input or appliance program settings. |
| **Medium** | Technique, Assembly | Based on historical averages for specific actions/items. |
| **Low** | Family Default | Broad heuristic fallback. |

## Reference Data

Reference data is maintained in `poc/line-build-cli/viewer/src/data/time-references.ts`.

### Equipment Presets (Example)
- `turbo/chicken_breast`: 180s
- `waterbath/brisket_pouch`: 360s

### Technique Durations (Example)
- `dice`: 20s
- `fold`: 8s
- `open_pack`: 5s

### Assembly Complexity (Example)
- `burrito`: 30s
- `bowl`: 12s
- `quesadilla`: 15s
