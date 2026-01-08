# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## OpenSkills (AI Skills Library)

Use `openskills` to access specialized knowledge and workflows.

```bash
openskills list                    # List all available skills
openskills read <skill-name>       # Read skill content (pipe to context)
```

### Key Skills for UX/Design Work

Use in this order for design tasks:
1. **ux-strategy** - Starting point: user workflows, trade-offs, mental models (Laws of UX)
2. **ux-engineering** - Convert workflows to specs: state machines, edge cases, accessibility
3. **ui-polish** - Final pass: visual polish, branding, typography, aesthetics

### Usage Pattern

```bash
# Read a skill and include in your context
openskills read ux-strategy

# Or pipe to clipboard/file for agent consumption
openskills read ui-polish > /tmp/ui-polish-skill.md
```

### Other Useful Skills

- `brainstorming` - Use BEFORE any creative work
- `senior-architect` - System design, architecture diagrams
- `code-reviewer` - Comprehensive code review
- `product-manager-toolkit` - RICE prioritization, PRDs, discovery

## Design System (line-build-mvp)

The `apps/line-build-mvp` app has a design system. **Always use it for UI work.**

### Design Direction: "Quiet Confidence"
Enterprise-grade aesthetic inspired by Linear, Notion, Figma.
- Deep indigo primary (`primary-600: #4f46e5`)
- Warm neutral tones (`neutral-50: #fafaf9`)
- Layered soft shadows
- Inter font for UI, JetBrains Mono for code

### Design Tokens
```typescript
import { colors, typography, spacing, shadows } from '@/lib/design-system/tokens';
```

### UI Components
```typescript
import {
  Button,           // variants: primary, secondary, ghost, danger
  Card, CardHeader, CardBody, CardFooter,  // variants: default, elevated, bordered
  Badge,            // variants: default, success, warning, danger, info
  Input,            // with label, error, helperText support
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Modal, ModalHeader, ModalBody, ModalFooter,
} from '@/components/ui';
```

### Color Usage
| Purpose | Class | Token |
|---------|-------|-------|
| Primary action | `bg-primary-600` | `#4f46e5` |
| Page background | `bg-neutral-50` | `#fafaf9` |
| Card background | `bg-white` | - |
| Success/Active | `bg-emerald-*` | success tokens |
| Warning/Draft | `bg-amber-*` | warning tokens |
| Danger | `bg-rose-*` | danger tokens |

### Component Patterns
```tsx
// Buttons
<Button variant="primary">Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" loading>Deleting...</Button>

// Cards
<Card variant="elevated" padding="lg">
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>

// Badges
<Badge variant="success">Active</Badge>
<Badge variant="warning">Draft</Badge>

// Input
<Input label="Name" error="Required" />
```

### DO NOT
- Use raw Tailwind colors like `bg-blue-600` - use `bg-primary-600`
- Use gray-* - use `neutral-*` (warm tones)
- Create one-off button styles - use `<Button>` component
- Skip the design system for "quick" UI work
