---
name: walkthrough
description: Generate interactive code walkthroughs in Virgil markdown format
disable-model-invocation: true
argument-hint: <pr-number|tour|keyword|incident|guide>
---

# Walkthrough Generator

Generate interactive code walkthroughs in Virgil markdown format for the Virgil VS Code extension.

## Mode Routing

Determine the walkthrough mode from `$ARGUMENTS`:

| Pattern | Mode | Description |
|---------|------|-------------|
| Number (e.g. `123`) | PR review (diff) | Walk through PR changes with diff mode |
| `tour` | Codebase tour | High-level architecture walkthrough |
| Keyword (e.g. `auth`) | Focused subsystem tour | Deep dive into a specific subsystem |
| `incident` or `debug` | Incident trace | Investigation/debugging narrative |
| `guide` or `setup` | Implementation guide | Step-by-step setup or implementation |

If `$ARGUMENTS` is ambiguous, ask with AskUserQuestion: "What type of walkthrough?" with options matching the modes above.

## Virgil Markdown Format

### Frontmatter

YAML between `---` delimiters at the start of the file:

```yaml
---
remote: <git remote URL>
commit: <full HEAD commit SHA>
# For diff mode, add ONE of (priority: baseCommit > baseBranch > pr):
baseCommit: <base commit SHA>
baseBranch: main
pr: 123
# Any additional key-value pairs become metadata
---
```

Always include `remote` and `commit`. The extension uses `remote` to filter walkthroughs to the matching workspace. A warning is shown if multiple base references are specified.

### Document Structure

- **Title**: The first `# heading` becomes the walkthrough title
- **Description**: Text between frontmatter and first `##` heading (optional)
- **Steps**: Each `##` through `######` heading creates a step

### Steps

Header level determines hierarchy:

| Header | Relationship |
|--------|-------------|
| `##` | Top-level step |
| `###` | Child of nearest `##` |
| `####` | Child of nearest `###` |
| `#####` | Child of nearest `####` |
| `######` | Child of nearest `#####` |

Navigation traverses all steps in depth-first order.

### Location Links

Place location links in the step body (typically right after the heading or explanation).

**View code** (head/current file): `[View code (startLine-endLine)](/path/from/repo/root)`
**Base** (diff mode, base file): `[Base (startLine-endLine)](/path/from/repo/root)`

Rules:
- Line numbers are **1-based** and **inclusive**
- Path **must** start with `/` (repo root-relative)
- Multiple ranges: `[View code (10-20,33-45)](/src/file.ts)`
- Single line: `[View code (10)](/src/file.ts)`

### Step Display Modes

| `View code` | `Base` | Mode | Display |
|-------------|--------|------|---------|
| Yes | No | Point-in-time | Standard code highlight |
| No | Yes | Base-only | Base file highlight |
| Yes | Yes | Diff | 3-way toggle: diff view / head / base |
| No | No | Informational | No code view (overview/summary steps) |

### Body Content

Full markdown is supported in step bodies: headers, bold/italic, code blocks (with language identifier), inline code, lists, links, blockquotes.

### Step Links

Link to other steps using anchor syntax: `[link text](#step-title-as-anchor)`

Anchor rules (GitHub/CommonMark): lowercase, spaces to hyphens, strip special chars.
Example: `## JWT Validation` → `[see validation](#jwt-validation)`

## Shared Workflow

These steps apply to **all** walkthrough modes:

1. **Gather repository info**
   ```bash
   git remote get-url origin 2>/dev/null || echo "no-remote"
   git rev-parse HEAD
   ```

2. **Explore the codebase** — Use Glob for structure, Grep for patterns, Read for content. Map out the relevant execution flow or architecture.

3. **Design walkthrough structure** — Plan 5-15 steps. Determine hierarchy (## for major areas, ### for details). Map each step to a file path and line range.

4. **Write the walkthrough** — Use the **Write tool** to create `walkthroughs/<name>.md`. Do NOT use `cat` heredoc or Bash for output.

5. **Verify accuracy** — Read each referenced file and confirm:
   - File paths exist
   - Line numbers point to the correct code
   - Narrative flows logically from step to step

## Mode-Specific Instructions

After determining the mode from [Mode Routing](#mode-routing), **Read** the corresponding mode file for detailed instructions:

| Mode | File to Read |
|------|-------------|
| PR review (diff) | `modes/pr-review.md` |
| Codebase tour | `modes/codebase-tour.md` |
| Focused subsystem tour | `modes/subsystem-tour.md` |
| Incident/debugging trace | `modes/incident-trace.md` |
| Setup/implementation guide | `modes/implementation-guide.md` |

Read the file path relative to this skill's directory. Only read the one mode file that applies — do not read all of them.

## Quality Guidelines

1. Always **read files** to get correct line numbers — never guess
2. One concept per step; meaningful titles (what the code does, not file names)
3. Focused line ranges (10-50 lines); break up larger sections
4. Body explains "why", not just "what" — use markdown formatting
5. Always include `remote` and `commit` in frontmatter
6. Use step links (`#anchor`) to cross-reference related steps
7. Informational steps (no location links) for overview/summary/transitions
8. Narrative flow: start with context, build understanding progressively

## Output

Use the **Write tool** to create the walkthrough file at:

```
walkthroughs/<name>.md
```

**Naming conventions:**
- PR review: `pr-<number>.md`
- Codebase tour: `architecture.md`
- Subsystem tour: `<keyword>.md`
- Incident trace: `incident-<id>.md`
- Implementation guide: `<guide-name>.md`

Create the `walkthroughs/` directory if it doesn't exist.

After writing, tell the user: "Walkthrough generated! Open in VS Code/Cursor with the Virgil extension, then use **Convert Markdown to Walkthrough** to view it."
