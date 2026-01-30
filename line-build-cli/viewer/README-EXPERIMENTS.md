# Viewer Validation Experiments

We have added several new features to help culinary engineers validate line builds more effectively.

## New Views
- **Graph (Default)**: Visual structural DAG of the build.
- **Steps**: A list-based table view. Best for scanning order, station/phase consistency, and missing fields.
- **Rules**: A summary of all validation errors grouped by Rule ID. Best for seeing what remains to be fixed.

## Validation Workflow
1. **Check the Health Strip**: Look at the top bar for total hard errors and entry point counts.
2. **Scan the Steps Table**: Use the 'Steps' view to read the build linearly and check for logical flow.
3. **Audit by Rule**: Use the 'Rules' view to see specific violations. Click a rule to highlight all offending steps in the graph.
4. **Reference in Chat**: Every step now has an `S##` label (e.g., S01, S07). Use the "Copy Ref" button in the Step Inspector to copy a precise reference to use in your conversation with the agent.

## Deep Linking
Selection state is now preserved in the URL:
`?buildId=<id>&stepId=<stepId>`
You can share this link to point exactly to a specific build and step.
