# Implementing Diff Support

---
baseCommit: e65ac7f
---

This walkthrough demonstrates how diff-based walkthroughs work by walking through the implementation of this very feature. It's a "meta" example that serves dual purposes: demonstrating the diff walkthrough feature with real content, and teaching how the diff support was implemented.

## Understanding Diff-Based Walkthroughs

Diff-based walkthroughs allow you to show code changes between two points in time. When viewing a diff step, you'll see a 3-way toggle:

- **Diff**: Shows VS Code's built-in diff editor comparing base and head
- **Head**: Shows the current (new) code with green highlights
- **Base**: Shows the old code with red highlights

This is useful for code reviews, explaining refactors, or documenting how a feature evolved.

**Key concepts:**

- `baseCommit` in the frontmatter specifies the "before" state
- Steps with only `location` show head code (blue highlights)
- Steps with both `location` and `base_location` enable the 3-way toggle
- Steps with neither show as informational (no code view)

## New Types for Diff Support

[View code (104-123)](/src/types.ts)

The diff feature required new types to represent view modes and step types.

**ViewMode** defines the three possible views:
- `'diff'` - Side-by-side comparison
- `'head'` - Current/new code only
- `'base'` - Previous/old code only

**StepType** categorizes steps based on their location fields:
- `'diff'` - Has both `location` and `base_location`
- `'point-in-time'` - Has only `location` (traditional walkthrough)
- `'base-only'` - Has only `base_location` (rare, for deleted code)
- `'informational'` - Has neither (text-only step)

The `getStepType()` function determines the type from a step's fields.

## Reading Files from Git Commits

[View code (1-77)](/src/DiffContentProvider.ts)

To show files at specific commits, we implement a virtual document provider using VS Code's `TextDocumentContentProvider` interface.

**URI scheme:** `virgil-git:///<commit>/<file-path>`

**How it works:**

1. `createUri()` builds a URI for a file at a specific commit
2. `parseUri()` extracts the commit and path from a URI
3. `provideTextDocumentContent()` retrieves content via `git show <commit>:<path>`

This allows VS Code to open files from any commit as if they were regular documents, enabling highlighting and diff views.

## Resolving Base References

[View code (1-70)](/src/DiffResolver.ts)

Users can specify the base reference in three ways, with a clear priority order:

1. **baseCommit** - Explicit commit SHA (highest priority)
2. **baseBranch** - Branch name, resolved to its current commit
3. **pr** - PR number, resolved via GitHub CLI or merge-base fallback

The `resolveBase()` method tries each in order and returns the resolved commit SHA along with which source it came from. This flexibility allows walkthroughs to work in different contexts (local development, CI, PR reviews).

## Multi-Color Highlight System

[View code (1-55)](/src/HighlightManager.ts)
[Base (1-35)](/src/HighlightManager.ts)

The highlight manager was refactored to support multiple colors for different contexts.

**Before (base):**
- Single decoration type with blue color
- Simple `Map<string, Range[]>` for tracking

**After (head):**
- `HighlightColor` type: `'blue' | 'green' | 'red'`
- `COLOR_CONFIGS` object with background, border, and ruler colors for each
- Decoration types created for each color in constructor
- `Map<string, { color, ranges }>` tracks both color and ranges per file

**Color semantics:**
- Blue: Point-in-time steps (traditional walkthrough)
- Green: Head file in diff mode (new code)
- Red: Base file in diff mode (old code)

## Toggle Between Diff, Head, and Base Views

[View code (46-52,165-191)](/src/StepDetailPanel.ts)
[Base (52-61,118-127)](/src/StepDetailPanel.ts)

The step detail panel now shows a 3-way toggle for diff steps.

**New interface:** `DiffModeOptions` carries the step type, current view mode, and commit references to the panel.

**UI changes:**
- Toggle buttons styled with the color of their view (green for Head, red for Base)
- Location info shows file paths with colored indicators
- Both head and base locations displayed when in diff mode

**Before:** The panel only showed a single clickable location. Now it adapts based on step type and shows appropriate controls.

## Wiring It All Together

[View code (563-654)](/src/extension.ts)
[Base (414-469)](/src/extension.ts)

The main extension file orchestrates all the diff components.

**Key changes to `showCurrentStep()`:**

1. Determines step type using `getStepType()`
2. Resolves base commit using `DiffResolver`
3. Handles each step type differently:
   - **diff**: Shows 3-way toggle, opens diff/head/base based on `currentViewMode`
   - **point-in-time**: Opens file with blue highlights (unchanged behavior)
   - **base-only**: Opens base file with red highlights
   - **informational**: Shows panel only, no file opened

**New helper functions:**
- `showFile()` - Opens a file at a specific commit with colored highlights
- `showDiff()` - Opens VS Code's diff editor for two commits

**View mode command:** `virgil.setViewMode` allows the toggle buttons to switch views without changing steps.
