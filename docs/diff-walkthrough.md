# Implementing Diff Support

---
baseCommit: 84ce6fc
---

This walkthrough demonstrates how diff-based walkthroughs work by walking through the implementation of this very feature. It's a "meta" example that serves dual purposes: demonstrating the diff walkthrough feature with real content, and teaching how the diff support was implemented.

## Understanding Diff-Based Walkthroughs

Diff-based walkthroughs allow you to show code changes between two points in time. When viewing a diff step, you'll see a 3-way toggle:

- **Diff**: Shows VS Code's built-in diff editor comparing base and head
- **Head**: Shows the current (new) code with diff head highlights (configurable, default: green)
- **Base**: Shows the old code with diff base highlights (configurable, default: red)

This is useful for code reviews, explaining refactors, or documenting how a feature evolved.

**Key concepts:**

- `repository.baseCommit` specifies the "before" state
- Steps with only `location` show head code with `standard` highlights (configurable)
- Steps with both `location` and `base_location` enable the 3-way toggle
- Steps with neither show as informational (no code view)

## Core Implementation

This section covers the fundamental types and infrastructure needed for diff support.

### New Types for Diff Support

[View code (7-15,202-210,264-276)](/src/types.ts)

The diff feature required new types to represent view modes and step types, plus a `base_location` field on steps. See `src/types.ts` around lines 202-276 for the view mode and step type definitions.

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

### Reading Files from Git Commits

[View code (22-26,31-46,51-76)](/src/DiffContentProvider.ts)

To show files at specific commits, we implement a virtual document provider using VS Code's `TextDocumentContentProvider` interface.

**URI scheme:** `virgil-git:///<commit>/<file-path>`

**How it works:**

1. `createUri()` builds a URI for a file at a specific commit
2. `parseUri()` extracts the commit and path from a URI
3. `provideTextDocumentContent()` retrieves content via `git show <commit>:<path>`

This allows VS Code to open files from any commit as if they were regular documents, enabling highlighting and diff views.

### Resolving Base References

[View code (25-69,140-160,164-201)](/src/DiffResolver.ts)

Users can specify the base reference in three ways, with a clear priority order:

1. **baseCommit** - Explicit commit SHA (highest priority)
2. **baseBranch** - Branch name, resolved to its current commit
3. **pr** - PR number, resolved via GitHub CLI or merge-base fallback

The `resolveBase()` method tries each in order and returns the resolved commit SHA along with which source it came from. This flexibility allows walkthroughs to work in different contexts (local development, CI, PR reviews).

## UI Changes

This section covers the user interface modifications for diff support.

### Multi-Color Highlight System

[View code (3-9,16-39,45-79,87-145,147-179)](/src/HighlightManager.ts)
[Base (3-16,19-34)](/src/HighlightManager.ts)

The highlight manager was refactored to support multiple colors for different contexts.

**Before (base):**

- Single decoration type with blue color
- Simple `Map<string, Range[]>` for tracking

**After (head):**

- `HighlightColor` type: `'standard' | 'diffHead' | 'diffBase'` (semantic names)
- Colors read from VS Code configuration with hex-to-rgba conversion
- Decoration types created for each color in constructor
- `Map<string, { color, ranges }>` tracks both color and ranges per file
- Configuration change listener recreates decorations when colors change

**Color semantics:**

- `standard`: Point-in-time steps (traditional walkthrough, configurable, default: blue)
- `diffHead`: Head file in diff mode (new code, configurable, default: green)
- `diffBase`: Base file in diff mode (old code, configurable, default: red)

### Toggle Between Diff, Head, and Base Views

[View code (54-61,246-291)](/src/StepDetailPanel.ts)
[Base (307-318)](/src/StepDetailPanel.ts)

The step detail panel now shows a 3-way toggle for diff steps.

**New interface:** `DiffModeOptions` carries the step type, current view mode, and commit references to the panel.

**UI changes:**

- Toggle buttons styled with the color of their view (diffHead for Head, diffBase for Base)
- Location info shows file paths with colored indicators
- Both head and base locations displayed when in diff mode
- Markdown steps add a Rendered/Raw toggle when viewing head/base

**Before:** The panel only showed a single clickable location. Now it adapts based on step type and shows appropriate controls.

## Wiring It All Together

[View code (695-809,812-870,872-909)](/src/extension.ts)
[Base (176-216)](/src/extension.ts)

The main extension file orchestrates all the diff components.

**Key changes to `showCurrentStep()`:**

1. Determines step type using `getStepType()`
2. Resolves base commit using `DiffResolver` (and shows an error panel if none is configured)
3. Handles each step type differently:
   - **diff**: Shows 3-way toggle, opens diff/head/base based on `currentViewMode`
   - **point-in-time**: Opens file with standard highlights (configurable)
   - **base-only**: Opens base file with diff base highlights (configurable, default: red)
   - **informational**: Shows panel only, no file opened

**New helper functions:**

- `showFile()` - Opens a file at a specific commit with colored highlights (or a rendered markdown preview)
- `showDiff()` - Opens VS Code's diff editor for two commits

**View mode command:** `virgil.setViewMode` allows the toggle buttons to switch views without changing steps.
