# PR Review (diff mode)

## Data Gathering

1. **Fetch PR data:**
   ```bash
   gh pr view $ARGUMENTS --json number,title,body,url,files
   gh pr diff $ARGUMENTS
   gh pr view $ARGUMENTS --json baseRefName
   ```

2. **Get changed files:**
   ```bash
   git diff --name-status <base>..<head>
   ```
   Categorize each file by its git status (A/D/M/R) — this determines which link types are required.

## Frontmatter

Include `baseBranch` (from the PR's base ref) or `pr` number in the YAML frontmatter to enable diff mode.

## Coverage Rules

**100% of changed files must be covered.** Every file in the diff must appear in at least one step with the correct link type:

| Git status | Required links |
|------------|---------------|
| **A** (Added) | `[View code ...]` |
| **D** (Deleted) | `[Base ...]` |
| **M** (Modified) | Both `[View code ...]` AND `[Base ...]` |
| **R** (Renamed) | `[Base ...]` for old path, `[View code ...]` for new path |

Verify coverage before finalizing — every changed file path must appear in a location link somewhere in the walkthrough.

## Structure

1. **Overview** (informational) — PR purpose, scope, and key decisions
2. **Grouped changes** — Organize by category (e.g., "API Changes", "Database Migrations", "UI Updates"). Use `##` for categories, `###` for individual file/change walkthroughs within each category.
3. **Impact summary** (informational) — User-facing impact, developer impact, testing notes, and recommendation (approve/request changes/comment)

## Tips

- Read the PR description and comments for context on *why* changes were made
- For modified files, explain what changed and why — not just what the code does now
- Group related files together even if they're in different directories
- Use the PR title as part of the walkthrough title: `# PR #<number>: <title>`
