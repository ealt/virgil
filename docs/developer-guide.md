# Virgil Developer Guide

---

type: developer-onboarding
remote: git@github.com:ealt/virgil.git
commit: fb0b1a3ec99858f6cbd1320b9151728556fd85f0

---

A comprehensive guide to understanding and contributing to the Virgil extension

## Welcome to Virgil Development

This walkthrough will help you understand how the Virgil extension works and how to contribute to it.

**What you'll learn:**

- How the extension activates and detects walkthroughs
- The architecture and key components
- How navigation and highlighting work
- How to extend the extension

**Prerequisites:**

- Basic TypeScript knowledge
- Familiarity with VS Code extensions
- Understanding of VS Code API basics

Let's start by understanding how the extension activates, or skip ahead to [UI Components](#ui-components) if you're already familiar with the basics.

## Extension Architecture

This section covers the core architecture of the Virgil extension, including how it activates, its entry point, and the data model. For navigation details, see [Commands and Navigation](#commands-and-navigation).

### Extension Activation

[View code (20)](/package.json)

Virgil activates on startup. The `activationEvents` array is intentionally empty, so VS Code loads the extension without waiting for a file match.

**Key points:**

- Activation is eager (startup), not gated on `workspaceContains`
- `virgil.convertMarkdown` is registered immediately (it still requires a workspace to run)
- Once a workspace folder is available, walkthrough discovery looks in:
  - `.walkthrough.json` at workspace root
  - Any `.json` files in `walkthroughs/` directory
- The extension watches those JSON files for changes

### Extension Entry Point

[View code (44-52,55-98,100-155,157-180,207-228)](/src/extension.ts)

The `activate()` function in `extension.ts` is called when the extension loads.

**What happens on activation:**

1. Creates a `HighlightManager` and reads default view modes from configuration
2. Registers `virgil.convertMarkdown` early so it's available even before a workspace is detected
3. Returns early if no workspace folder is open
4. Initializes diff support (`DiffContentProvider`, `DiffResolver`) and the markdown highlight provider
5. Initializes the `WalkthroughProvider` and the tree view
6. Registers commands and a config watcher for step-numbering changes
7. Sets up file watching for `.walkthrough.json` and `walkthroughs/*.json`
8. Auto-shows the first step if `virgil.view.autoShowFirstStep` is enabled and a walkthrough exists (and then checks commit mismatch + git user name)

### TypeScript Interfaces - Data Model

[View code (1-21,68-112,114-130,161-214,216-262,264-276)](/src/types.ts)

The `types.ts` file defines the shape of walkthrough JSON files and the navigation helpers.

**Key interfaces:**

- `Walkthrough` - Root object with title, description, repository, metadata, steps
- `WalkthroughStep` - Individual step with id, title, body, `location`, optional `base_location`, comments, `parentId`
- `StepTreeNode` - Tree node for hierarchical step display
- `StepNavigationContext` - Precomputed parent/sibling indices for fast navigation
- `Comment` - User comments with id, author, body
- `Repository` - Git info (remote URL, head commit SHA, optional `baseCommit`/`baseBranch`/`pr`)

**Utility functions and types:**

- `parseLocation()` - Parses location strings like `path:10-45,100-120`
- `buildStepTree()` / `flattenStepTree()` - Build and flatten the hierarchical step tree
- `buildNavigationMap()` - Builds O(1) parent/sibling lookup for navigation
- `ViewMode`, `MarkdownViewMode`, `StepType` + `getStepType()` - Diff/view mode typing
- `isMarkdownFile()` / `getFileTypeIcon()` - File-type helpers for UI
- `normalizeRemoteUrl()` - URL normalization helper (currently unused in selection filtering)

These types keep the extension's data model and navigation behavior consistent.

## Commands and Navigation

This section covers how commands are registered and how step navigation works.

### Command Registration

[View code (231-308,310-317,319-341,347-378,379-398,404-413,418-442,444-454,508-549,553-569,571-607)](/src/extension.ts)

The extension registers several commands for navigation and control. (`virgil.convertMarkdown` is registered earlier during activation.)

**Navigation commands:**

- `virgil.start` - Jump to first step
- `virgil.next` - Go to next step
- `virgil.prev` - Go to previous step
- `virgil.goToStep` - Jump to specific step index
- `virgil.goToParent` - Navigate to parent step in hierarchy
- `virgil.nextSibling` - Navigate to next sibling step (same level)
- `virgil.prevSibling` - Navigate to previous sibling step (same level)

**View mode commands (used by the webview):**

- `virgil.setViewMode` - Switch diff view mode (diff/head/base)
- `virgil.setMarkdownViewMode` - Switch markdown view mode (rendered/raw)

**Control commands:**

- `virgil.refresh` - Reload walkthrough from file
- `virgil.selectWalkthrough` - Switch walkthroughs or browse for JSON/Markdown and convert if needed
- `virgil.convertMarkdown` - Convert a Markdown walkthrough to JSON (saves to `walkthroughs/` directory)
- `virgil.submitComment` - Add a comment to current step
- `virgil.openLocation` - Open file at a specific location
- `virgil.checkoutCommit` - Checkout the commit specified in the walkthrough

Most commands delegate to `WalkthroughProvider` for state management, then call `showCurrentStep()` to update the UI.

### File Watching - Auto-refresh

[View code (609-613,615-655)](/src/extension.ts)

The extension uses VS Code `FileSystemWatcher`s to monitor walkthrough JSON files in two locations:

- `.walkthrough.json` at workspace root
- `walkthroughs/*.json` files

**Event handling:**

- **onDidChange**: Refreshes provider, updates context, and optionally auto-shows the first step
- **onDidCreate**: Refreshes provider, updates context, optionally auto-shows the first step, then checks commit mismatch and git user name
- **onDidDelete**: Refreshes provider, clears highlights, and updates context based on remaining walkthroughs

**Benefits:**

- No manual refresh needed when editing walkthrough JSON
- Automatic detection of new walkthroughs in both locations
- Clean state management when files are deleted

The watcher uses `RelativePattern` for both the workspace root and the `walkthroughs/` directory.

### Show Current Step - Core Navigation

[View code (683-716,718-777,781-797)](/src/extension.ts)

The `showCurrentStep()` function orchestrates what happens when navigating to a step.

**Flow:**

1. Gets walkthrough, current index, and step label from the provider
2. Clears all previous highlights
3. Resolves the base commit (if any) and determines the step type
4. Builds step anchor links and hierarchical navigation options for the webview
5. Shows the appropriate view based on step type:
   - **diff**: opens diff/head/base view based on `currentViewMode`
   - **point-in-time**: opens the head file with standard highlights
   - **base-only**: opens the base file with base highlights
   - **informational**: no file opened
6. Renders the step detail panel (including errors if a base ref is missing)

**Key coordination:**

- `WalkthroughProvider` manages state and step labels
- `DiffResolver` determines the base commit
- `HighlightManager` handles decorations
- `StepDetailPanel` renders the webview (diff toggle + markdown toggle)

This function is called by all navigation commands to keep the UI in sync.

## UI Components

This section covers the main UI components: the sidebar tree view, detail panel, and code highlighting.

### WalkthroughProvider - State Management

[View code (46-51,53-83,158-186,199-242,266-302,319-329,568-591)](/src/WalkthroughProvider.ts)

The `WalkthroughProvider` class implements VS Code's `TreeDataProvider` interface.

**Responsibilities:**

- Discovers walkthrough JSON files (`.walkthrough.json` and `walkthroughs/*.json`)
- Loads and parses walkthrough files, then builds:
  - The hierarchical tree (`buildStepTree`)
  - The flat navigation list (`flattenStepTree`)
  - The parent/sibling lookup map (`buildNavigationMap`)
- Tracks current step index and step labels (hierarchical numbering if enabled)
- Builds tree items with file-type icons and diff/base warnings
- Manages Git state (commit mismatch checks, checkout, stash, git user name)
- Manages comments (add + persist to JSON)
- Provides step anchor mapping for in-body step links

**Key methods:**

- `getAvailableWalkthroughs()` - Finds walkthrough JSON files
- `loadWalkthrough()` - Loads JSON and builds tree/flat/nav maps
- `setWalkthroughFile()` - Sets the current walkthrough file
- `goToStep()`, `nextStep()`, `prevStep()` - Step navigation
- `getStepAnchorMap()` - Maps step-title anchors to indices
- `addComment()` - Adds a comment and saves the walkthrough file
- `hasCommitMismatch()` / `getCommitMismatchInfo()` - Commit mismatch checks

### Tree View - Building the Sidebar

[View code (497-565,593-651)](/src/WalkthroughProvider.ts)

The `getRootItems()` and `createStepTreeItem()` methods build the sidebar tree structure.

**Tree structure:**

1. **File selector** (always shown) - Shows current file with a count of available walkthroughs
2. **Title header** - Walkthrough title with description or commit mismatch warning
3. **Steps** - Hierarchical tree of steps with parent/child relationships

**Hierarchical display:**

- Top-level steps (no `parentId`) appear at root level
- Sub-steps appear indented under their parent
- Steps with children are expandable (default: Expanded)
- Navigation traverses all steps in depth-first order

**Step indicators:**

- Current step: Green arrow icon + "(current)" label
- Point-in-time steps: File-type icon based on the location path
- Diff steps: File-type icon when recognized, otherwise `git-compare`
- Base-only steps: File-type icon when recognized, otherwise `history` (red)
- Informational steps: Note icon
- Diff/Base steps show "⚠️ no base ref" if the repository lacks a base reference

**Commit mismatch:** If the walkthrough commit doesn't match current HEAD, the title shows a warning icon and tooltip.

The tree view automatically updates when steps change via `_onDidChangeTreeData`.

### StepDetailPanel - Webview UI

[View code (70-121,123-160)](/src/StepDetailPanel.ts)

The `StepDetailPanel` creates a webview that displays rich step information.

**What it shows:**

- Step title and counter (e.g., "Step 2 of 5")
- Metadata (on first step only)
- Diff view toggle (Diff/Head/Base) for diff steps
- Markdown view toggle (Rendered/Raw) for markdown steps
- Clickable location information (head/base or base-only)
- Step body with Markdown rendering
- Comments section with add comment form
- Previous/Next navigation buttons (plus optional parent/sibling controls)

**Webview features:**

- Opens in `ViewColumn.Two` (side panel)
- `retainContextWhenHidden` preserves state
- Uses VS Code CSS variables for theming
- Communicates via `postMessage` API

**Markdown rendering:** Uses `marked` with `highlight.js` for syntax highlighting in code blocks.

#### Webview HTML Generation

[View code (163-183,194-223,225-336,338-352,353-371,403-439,742-770,772-799,802-848,864-887)](/src/StepDetailPanel.ts)

The `getHtml()` method generates the HTML for the detail panel.

**Key features:**

- **Theming**: Uses VS Code CSS variables (`var(--vscode-foreground)`, etc.)
- **Markdown rendering**: Converts step body and comments from Markdown to HTML (with step-link anchors)
- **Security**: CSP restricts scripts; raw HTML is stripped to prevent XSS
- **Interactivity**: JavaScript handles navigation, view toggles, step links, and comment submission
- **Diff/error UX**: Shows base-ref errors inline and adapts location display per view

**Styling:**

- Matches VS Code's native UI appearance
- Syntax highlighting uses VS Code-compatible colors
- Supports dark/light themes automatically

**Communication:** JavaScript uses `acquireVsCodeApi()` to send messages back to the extension.

### HighlightManager - Code Decorations

[View code (3-9,16-39,45-79,87-145,147-179,182-207,209-229)](/src/HighlightManager.ts)

The `HighlightManager` creates and manages text decorations that highlight code ranges.

**Color variants (configurable in `virgil.highlights.*`):**

| Context                 | Setting key (default)                             | Notes |
| ----------------------- | ------------------------------------------------- | ----- |
| Point-in-time (default) | `standard.backgroundColor` (`#569CDE1A`)         | Blue |
| Head file (diff mode)   | `diffHead.backgroundColor` (`#48B46126`)          | Green |
| Base file (diff mode)   | `diffBase.backgroundColor` (`#DC505026`)          | Red |

**Decoration style:**

- Colors are read from settings and converted from hex to RGBA
- Left border accent per color
- `isWholeLine: true` highlights entire lines
- Appears in the overview ruler (minimap) for navigation

**State management:**

- Tracks decorations per file with color in a `Map<string, { color, ranges }>`
- `highlightRange(editor, start, end, color)` adds or replaces ranges per color
- `clearFile()` removes decorations for a specific file
- `clearAll()` removes all decorations
- `refreshEditor()` reapplies decorations when editor is reopened
- Configuration changes recreate decoration types and reapply active ranges

**Usage:** Called by `showCurrentStep()` to highlight step locations with appropriate colors.

## Diff Mode Support

This section covers the components that enable diff-based walkthroughs.

### DiffContentProvider - Git File Content

[View code (22-26,31-46,51-76,82-93,99-109)](/src/DiffContentProvider.ts)

The `DiffContentProvider` implements VS Code's `TextDocumentContentProvider` to serve file content from specific Git commits.

**URI scheme:** `virgil-git:///<commit>/<file-path>`

**Key methods:**

- `createUri(commit, filePath)` - Creates a URI for a file at a commit
- `parseUri(uri)` - Extracts commit and path from a URI
- `provideTextDocumentContent(uri)` - Returns file content via `git show`
- `fileExistsAtCommit(commit, filePath)` - Checks if file exists at commit

**Usage:**

```typescript
// Create URI for file at specific commit
const uri = DiffContentProvider.createUri('abc123', 'src/auth.ts');

// Open the file
const doc = await vscode.workspace.openTextDocument(uri);
```

**Error handling:**

- Invalid commit references
- Files that don't exist at the specified commit
- Git command failures

### DiffResolver - Base Reference Resolution

[View code (25-69,76-96,101-118,124-160,164-201,204-219)](/src/DiffResolver.ts)

The `DiffResolver` resolves and validates base references for diff mode walkthroughs.

**Resolution priority:**

1. `baseCommit` - Direct commit SHA
2. `baseBranch` - Resolved to branch's current commit
3. `pr` - Resolved via GitHub CLI or merge-base fallback

**Key methods:**

- `resolveBase(repository)` - Returns resolved commit SHA and source
- `validateSingleBaseRef(repository)` - Warns if multiple refs specified
- `validateStepBaseRef(hasBaseLocation, repository)` - Checks step requirements
- `getHeadCommit()` - Gets current HEAD commit

**Usage:**

```typescript
const diffResolver = new DiffResolver(workspaceRoot);
const result = diffResolver.resolveBase(walkthrough.repository);

if (result.commit) {
  // Use result.commit as the base reference
  // result.source tells you which field it came from
}
```

## Data Persistence

This section covers how data is stored and managed.

### Comments System

[View code (391-402,417-448)](/src/WalkthroughProvider.ts)

Users can add comments to steps, which are persisted to the walkthrough JSON file.

**How it works:**

1. User types comment in webview textarea
2. Webview sends `submitComment` message via `postMessage`
3. Extension command handler calls `WalkthroughProvider.addComment()`
4. Comment is created with:
   - Auto-generated ID (timestamp + random)
   - Author from `git config user.name` (or "Anonymous")
   - Body text (supports Markdown)
5. Walkthrough JSON is saved to disk
6. Panel is refreshed to show new comment

**Comment features:**

- Markdown rendering in comments
- Author attribution
- Persisted to JSON file
- Can be edited manually in JSON if needed

**Git user prompt:** On walkthrough load/selection, the extension checks for `git config user.name` and offers to set it if missing.

### Commit Mismatch Detection

[View code (81-106)](/src/WalkthroughProvider.ts)

The extension can warn users when viewing walkthroughs created for different codebase states.

**How it works:**

1. Walkthrough specifies `repository.commit`
2. Extension compares current HEAD to the walkthrough commit (full SHA)
3. If mismatch detected:
   - Shows warning dialog with short SHAs
   - Offers to checkout the commit (with stash option)
   - User can ignore and continue

**Git operations:**

- `hasCommitMismatch()` / `getCommitMismatchInfo()` - Compares commits and returns details
- `refreshGitState()` - Refreshes current HEAD before comparisons
- `checkoutCommit()` - Checks out specified commit
- `stashChanges()` - Stashes uncommitted changes
- `isWorkingTreeDirty()` - Checks for uncommitted changes

**Benefits:**

- Ensures walkthroughs are viewed with correct code
- Prevents confusion from code changes
- Optional (can be ignored if needed)

### Repository Metadata

[View code (114-122,132-158)](/src/types.ts)

Walkthroughs can include repository metadata to capture the intended code state.

**Current fields:**

- `remote` - Optional Git remote URL for reference
- `commit` - Head commit SHA for the walkthrough's target state
- `baseCommit` / `baseBranch` / `pr` - Optional base reference for diff mode

**URL normalization helper:** `normalizeRemoteUrl()` is available to compare SSH/HTTPS URLs, but the current selection logic does not filter walkthroughs by remote.

## Utilities and Helpers

This section covers utility functions and parsing logic.

### Location Parsing

[View code (167-200)](/src/types.ts)

The `parseLocation()` function parses location strings into structured data.

**Location format:** `path:startLine-endLine` or `path:startLine-endLine,startLine-endLine` (used by both `location` and `base_location`)

**Examples:**

- `src/auth.ts:10-45` - Single range
- `src/auth.ts:10` - Single line (treated as range 10-10)
- `src/auth.ts:10-45,100-120` - Multiple ranges (comma-separated)

**Parsing logic:**

1. Finds last `:` to separate path from ranges
2. Splits ranges by comma
3. For each range:
   - If contains `-`, splits into start/end
   - Otherwise, treats as single line
4. Returns `ParsedLocation` with path and array of ranges

**Error handling:** Returns `null` if format is invalid.

**Usage:** Used by `showCurrentStep()` and `virgil.openLocation` command.

### Markdown Parser

[View code (144-163,164-223,234-241,243-373,379-388)](/src/markdownParser.ts)

The `parseMarkdownWalkthrough()` function converts Markdown files to walkthrough JSON.

**Header hierarchy:**

- `#` - Walkthrough title
- `##` - Top-level steps
- `###` - Sub-steps (children of `##`)
- `####` - Sub-sub-steps (children of `###`)
- And so on up to `######`

**Parsing features:**

- YAML frontmatter for repository fields (`remote`, `commit`, `baseBranch`, `baseCommit`, `pr`) and arbitrary metadata
- Location links immediately after headings in the format `[Text (10-20)](file.ts)`
- Base location links with `[Base (10-20)](file.ts)` prefix
- Automatic `parentId` assignment based on header nesting
- Sequential ID generation (1, 2, 3, 4...)
- Warnings when location links appear in the step body (ignored for parsing)

**Example input:** A markdown file with `## Login Flow` (level 2) followed by `### Token Generation` (level 3) produces steps where "Token Generation" has `parentId` pointing to "Login Flow".

## Project Structure Overview

[View code (1-22)](/package.json)

Understanding the project structure helps when contributing.

**Key directories:**

- `src/` - TypeScript source files
- `out/` - Compiled JavaScript (generated)
- `docs/` - Documentation (schema.md, development.md)
- `media/` - Assets (currently just panel.css, though styles are inline)

**Key files:**

- `package.json` - Extension manifest, commands, views, keybindings
- `tsconfig.json` - TypeScript configuration
- `extension.ts` - Entry point and coordination
- `types.ts` - Data model and utilities
- `WalkthroughProvider.ts` - State and tree view
- `StepDetailPanel.ts` - Webview UI
- `HighlightManager.ts` - Code decorations
- `markdownParser.ts` - Markdown to JSON conversion

**Build output:** TypeScript compiles to `out/` directory, which is what VS Code loads.

## Project Documentation - README

[View code (9-20)](/README.md)

The project's main documentation lives in the README.md file. This section showcases the core features of Virgil.

**Tip:** When viewing this step, try toggling between **Rendered** and **Raw** modes using the Markdown toggle in the detail panel. Rendered mode (the default) shows the markdown preview with highlighted sections, while Raw mode shows the source with line highlighting.

**Documentation structure:**

- `README.md` - User-facing documentation, installation, usage
- `docs/schema.md` - Complete walkthrough JSON schema
- `docs/development.md` - Development setup and guidelines
- `docs/developer-guide.md` - This walkthrough (meta!)

When contributing, keep documentation in sync with code changes.

## Extending the Extension

This section covers how to add new features and contribute to Virgil.

### Adding New Commands

[View code (231-239)](/src/extension.ts)

Here's how to add new commands to Virgil:

**Steps:**

1. Add the command to `package.json` under `contributes.commands` (around lines 22-78, plus keybindings if needed)
2. Register the command in `extension.ts` with `vscode.commands.registerCommand()`
3. Push the disposable into `context.subscriptions` for cleanup

**Example:**

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('virgil.myCommand', () => {
    // Command implementation
  })
);
```

### Enhancing the Webview

Modify `StepDetailPanel.getHtml()` to add new UI elements:

- Add new message handlers in `onDidReceiveMessage`
- Update CSS for styling
- Use VS Code CSS variables for theming

### Feature Ideas

Some ideas for extending Virgil:

- **Walkthrough validation**: Add schema validation on load
- **Export/import**: Add commands to export walkthroughs
- **Templates**: Create walkthrough templates
- **Search**: Add search functionality for steps
- **Multiple walkthroughs**: Show multiple walkthroughs simultaneously

### Testing

- Use Extension Development Host (`F5`)
- Test with various walkthrough files
- Test edge cases (missing files, invalid JSON, etc.)

## Development Workflow

Here's the recommended workflow for contributing:

**Setup:**

1. Clone repository and run `npm install`
2. Run `npm run watch` for auto-compilation
3. Press `F5` to launch Extension Development Host

**Making changes:**

1. Edit TypeScript files in `src/`
2. Watch mode automatically recompiles
3. Reload Extension Development Host window (`Cmd+R` / `Ctrl+R`)
4. Test changes with a walkthrough file

**Packaging:**

- Run `npx vsce package --allow-missing-repository`
- Install `.vsix` file to test installation

**Documentation:**

- Update `docs/schema.md` for schema changes
- Update `docs/development.md` for architecture changes
- Update `README.md` for user-facing changes

**See `docs/development.md` for more details.**

## Summary and Next Steps

**Quick links to key sections:**

- [Extension Activation](#extension-activation) - How the extension starts
- [TypeScript Interfaces - Data Model](#typescript-interfaces---data-model) - Core data structures
- [WalkthroughProvider - State Management](#walkthroughprovider---state-management) - State management
- [StepDetailPanel - Webview UI](#stepdetailpanel---webview-ui) - UI implementation

**Key takeaways:**

- Extension activates on startup; walkthroughs are discovered from `.walkthrough.json` and `walkthroughs/*.json`
- `WalkthroughProvider` manages state and builds hierarchical sidebar
- `StepDetailPanel` shows rich step info in themed webview
- `HighlightManager` applies line decorations to editors
- All components coordinate through `extension.ts`
- Steps support hierarchy via `parentId` field
- Navigation traverses all steps in depth-first order
- Comments are persisted to JSON files
- Repository metadata tracks intended commit/base refs (no remote filtering yet)
- Commit mismatch warnings help ensure correct code state

**Next steps for contributors:**

1. Read `docs/development.md` for detailed setup instructions
2. Explore the codebase using this walkthrough
3. Try making a small change (e.g., add a new command)
4. Test thoroughly in Extension Development Host
5. Submit a pull request

**Resources:**

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- `docs/schema.md` - Walkthrough JSON format
- `docs/development.md` - Development guide

Happy contributing!
