# Virgil Developer Guide

---

type: developer-onboarding
remote: <git@github.com>:ealt/virgil.git
commit: d4b85b5b1f5ab646b671bfff01e7d1c46ccf57db

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

[View code (13-15)](/package.json)

Virgil activates when it detects any `*.walkthrough.json` file in your workspace root.

The activation event is defined in `package.json`. The extension uses `workspaceContains:*.walkthrough.json` which means it only activates when the workspace contains matching files at the root.

**Key points:**

- Activation is lazy (only when needed)
- Once activated, the extension discovers walkthroughs from two locations:
  - `.walkthrough.json` at workspace root
  - Any `.json` files in `walkthroughs/` directory
- Multiple walkthrough files can coexist
- The extension watches for file changes automatically in both locations

### Extension Entry Point

[View code (13-41)](/src/extension.ts)

The `activate()` function in `extension.ts` is called when the extension activates.

**What happens on activation:**

1. Creates a `HighlightManager` instance
2. Finds walkthrough files in two locations:
   - `.walkthrough.json` at workspace root
   - Any `.json` files in `walkthroughs/` directory
3. Initializes the `WalkthroughProvider`
4. Registers the tree view in the sidebar
5. Registers all commands (including walkthrough selection and Markdown conversion)
6. Sets up file watching for both locations
7. Auto-shows the first step if a walkthrough exists

**Early return:** If no workspace folder is open, the extension returns early.

### TypeScript Interfaces - Data Model

[View code (1-96)](/src/types.ts)

The `types.ts` file defines the shape of walkthrough JSON files.

**Key interfaces:**

- `Walkthrough` - Root object with title, description, repository, metadata, steps
- `WalkthroughStep` - Individual step with id, title, body, location, comments, parentId
- `StepTreeNode` - Tree node for hierarchical step display
- `Comment` - User comments with id, author, body
- `Repository` - Git repository info (remote URL, commit SHA)

**Utility functions:**

- `parseLocation()` - Parses location strings like `path:10-45,100-120`
- `normalizeRemoteUrl()` - Normalizes Git URLs for comparison (SSH <-> HTTPS)
- `buildStepTree()` - Builds tree structure from flat steps with parentId
- `flattenStepTree()` - Flattens tree back to array for navigation

These types ensure type safety throughout the extension.

## Commands and Navigation

This section covers how commands are registered and how step navigation works.

### Command Registration

[View code (43-119)](/src/extension.ts)

The extension registers several commands for navigation and control.

**Navigation commands:**

- `virgil.start` - Jump to first step
- `virgil.next` - Go to next step
- `virgil.prev` - Go to previous step
- `virgil.goToStep` - Jump to specific step index

**Control commands:**

- `virgil.refresh` - Reload walkthrough from file
- `virgil.selectWalkthrough` - Switch between multiple walkthrough files or select Markdown files for conversion
- `virgil.convertMarkdown` - Convert a Markdown walkthrough to JSON (saves to `walkthroughs/` directory)
- `virgil.submitComment` - Add a comment to current step
- `virgil.openLocation` - Open file at specific location
- `virgil.checkoutCommit` - Checkout the commit specified in walkthrough

All commands delegate to `WalkthroughProvider` for state management, then call `showCurrentStep()` to update the UI.

### File Watching - Auto-refresh

[View code (494-525)](/src/extension.ts)

The extension uses VS Code's `FileSystemWatcher` to monitor walkthrough files in two locations:

- `.walkthrough.json` at workspace root
- `walkthroughs/*.json` files

**Event handling:**

- **onDidCreate**: Shows notification, refreshes provider, sets context
- **onDidChange**: Refreshes provider to reload walkthrough
- **onDidDelete**: Clears highlights, updates context, refreshes provider

**Benefits:**

- No need to manually refresh when editing walkthrough files
- Automatic detection of new walkthroughs in both locations
- Clean state management when files are deleted

The watcher uses `RelativePattern` to watch both the workspace root and the `walkthroughs/` directory.

### Show Current Step - Core Navigation

[View code (315-371)](/src/extension.ts)

The `showCurrentStep()` function orchestrates what happens when navigating to a step.

**Flow:**

1. Gets current walkthrough and step index from provider
2. Clears all previous highlights
3. If step has a location:
   - Parses the location string
   - Opens the file in the editor
   - Scrolls to the first range
   - Applies highlights to all ranges
4. Updates the detail panel with step content

**Key coordination:**

- `WalkthroughProvider` manages state
- `HighlightManager` handles decorations
- `StepDetailPanel` displays UI

This function is called by all navigation commands to keep the UI in sync.

## UI Components

This section covers the main UI components: the sidebar tree view, detail panel, and code highlighting.

### WalkthroughProvider - State Management

[View code (17-220)](/src/WalkthroughProvider.ts)

The `WalkthroughProvider` class implements VS Code's `TreeDataProvider` interface.

**Responsibilities:**

- Discovers walkthrough files from root (`.walkthrough.json`) and `walkthroughs/` directory (any `.json` files)
- Loads and parses walkthrough JSON files
- Builds tree structure from flat steps using `buildStepTree()`
- Maintains current step index and flat navigation array
- Builds tree items for the sidebar with hierarchical display
- Handles Git operations (commit checking, checkout)
- Manages comments (add, save to file)

**Key methods:**

- `getAvailableWalkthroughs()` - Finds all walkthrough files (root `.walkthrough.json` and `walkthroughs/*.json`)
- `loadWalkthrough()` - Loads JSON file, parses it, and builds step tree
- `setWalkthroughFile()` - Sets the current walkthrough file (accepts relative paths)
- `goToStep()`, `nextStep()`, `prevStep()` - Navigation using flat step array
- `getTotalSteps()`, `getCurrentStep()` - Helper methods for navigation
- `addComment()` - Adds comment and saves to file
- `hasCommitMismatch()` - Checks if current commit matches walkthrough

### Tree View - Building the Sidebar

[View code (358-425)](/src/WalkthroughProvider.ts)

The `getRootItems()` and `createStepTreeItem()` methods build the sidebar tree structure.

**Tree structure:**

1. **File selector** (if multiple walkthroughs) - Shows current file with count
2. **Title header** - Walkthrough title with description or commit mismatch warning
3. **Steps** - Hierarchical tree of steps with parent/child relationships

**Hierarchical display:**

- Top-level steps (no `parentId`) appear at root level
- Sub-steps appear indented under their parent
- Steps with children are expandable (collapsed state: Expanded by default)
- Navigation traverses all steps in depth-first order

**Step indicators:**

- Current step: Green arrow icon + "(current)" label
- Steps with locations: File-code icon
- Steps without locations: Note icon
- Diff steps: Git-compare icon
- Base-only steps: History icon (red)

**Commit mismatch:** If the walkthrough commit doesn't match current HEAD, the title shows a warning icon and tooltip.

The tree view automatically updates when steps change via `_onDidChangeTreeData` event.

### StepDetailPanel - Webview UI

[View code (46-106)](/src/StepDetailPanel.ts)

The `StepDetailPanel` creates a webview that displays rich step information.

**What it shows:**

- Step title and counter (e.g., "Step 2 of 5")
- Metadata (on first step only)
- Clickable location link
- Step body with Markdown rendering
- Comments section with add comment form
- Previous/Next navigation buttons

**Webview features:**

- Opens in `ViewColumn.Two` (side panel)
- `retainContextWhenHidden` preserves state
- Uses VS Code CSS variables for theming
- Communicates via `postMessage` API

**Markdown rendering:** Uses `marked` library with `highlight.js` for syntax highlighting in code blocks.

#### Webview HTML Generation

[View code (114-465)](/src/StepDetailPanel.ts)

The `getHtml()` method generates the HTML for the detail panel.

**Key features:**

- **Theming**: Uses VS Code CSS variables (`var(--vscode-foreground)`, etc.)
- **Markdown rendering**: Converts step body and comments from Markdown to HTML
- **Security**: Content Security Policy restricts scripts, HTML is escaped to prevent XSS
- **Interactivity**: JavaScript handles button clicks and comment submission
- **Responsive**: Navigation buttons disabled at first/last steps

**Styling:**

- Matches VS Code's native UI appearance
- Syntax highlighting uses VS Code-compatible colors
- Supports dark/light themes automatically

**Communication:** JavaScript uses `acquireVsCodeApi()` to send messages back to extension.

### HighlightManager - Code Decorations

[View code (1-71)](/src/HighlightManager.ts)

The `HighlightManager` creates and manages text decorations that highlight code ranges.

**Color variants:**

| Context                 | Color                                     | CSS Background            |
| ----------------------- | ----------------------------------------- | ------------------------- |
| Point-in-time (default) | `standard` (configurable, default: blue)  | `rgba(86, 156, 214, 0.1)` |
| Head file (diff mode)   | `diffHead` (configurable, default: green) | `rgba(72, 180, 97, 0.15)` |
| Base file (diff mode)   | `diffBase` (configurable, default: red)   | `rgba(220, 80, 80, 0.15)` |

**Decoration style:**

- Background color based on context
- Left border accent matching the color
- `isWholeLine: true` highlights entire lines
- Appears in overview ruler (minimap) for navigation

**State management:**

- Tracks decorations per file with color in a `Map<string, { color, ranges }>`
- `highlightRange(editor, start, end, color)` adds decorations with specified color
- `clearFile()` removes decorations from a specific file
- `clearAll()` removes all decorations
- `refreshEditor()` reapplies decorations when editor is reopened

**Usage:** Called by `showCurrentStep()` to highlight step locations with appropriate colors.

## Diff Mode Support

This section covers the components that enable diff-based walkthroughs.

### DiffContentProvider - Git File Content

[View code (1-100)](/src/DiffContentProvider.ts)

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

[View code (1-200)](/src/DiffResolver.ts)

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

[View code (290-322)](/src/WalkthroughProvider.ts)

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

### Commit Mismatch Detection

[View code (69-135)](/src/WalkthroughProvider.ts)

The extension can warn users when viewing walkthroughs created for different codebase states.

**How it works:**

1. Walkthrough specifies `repository.commit`
2. Extension compares current HEAD to walkthrough commit
3. If mismatch detected:
   - Shows warning dialog with commit SHAs
   - Offers to checkout the commit (with stash option)
   - User can ignore and continue

**Git operations:**

- `hasCommitMismatch()` - Compares commits
- `checkoutCommit()` - Checks out specified commit
- `stashChanges()` - Stashes uncommitted changes
- `isWorkingTreeDirty()` - Checks for uncommitted changes

**Benefits:**

- Ensures walkthroughs are viewed with correct code
- Prevents confusion from code changes
- Optional (can be ignored if needed)

### Repository Remote Matching

[View code (28-55)](/src/types.ts)

Walkthroughs can be scoped to specific repositories using `repository.remote`.

**How it works:**

1. Walkthrough specifies `repository.remote`
2. Extension gets workspace Git remote
3. `normalizeRemoteUrl()` normalizes both URLs:
   - Removes `.git` suffix
   - Converts SSH to HTTPS format
   - Case-insensitive comparison
   - Removes authentication info
4. Only matching walkthroughs appear in `getAvailableWalkthroughs()`

**Benefits:**

- Walkthrough files can be stored in shared locations
- Only show for relevant repositories
- Prevents confusion from wrong walkthroughs

**Example:** `git@github.com:org/repo.git` matches `https://github.com/org/repo`

## Utilities and Helpers

This section covers utility functions and parsing logic.

### Location Parsing

[View code (63-96)](/src/types.ts)

The `parseLocation()` function parses location strings into structured data.

**Location format:** `path:startLine-endLine` or `path:startLine-endLine,startLine-endLine`

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

[View code (144-366)](/src/markdownParser.ts)

The `parseMarkdownWalkthrough()` function converts Markdown files to walkthrough JSON.

**Header hierarchy:**

- `#` - Walkthrough title
- `##` - Top-level steps
- `###` - Sub-steps (children of `##`)
- `####` - Sub-sub-steps (children of `###`)
- And so on up to `######`

**Parsing features:**

- YAML frontmatter for metadata (commit, baseBranch, etc.)
- Location links in format `[Text (10-20)](file.ts)`
- Base location links with `[Base (10-20)](file.ts)` prefix
- Automatic `parentId` assignment based on header nesting
- Sequential ID generation (1, 2, 3, 4...)

**Example input:** A markdown file with `## Login Flow` (level 2) followed by `### Token Generation` (level 3) produces steps where "Token Generation" has `parentId` pointing to "Login Flow".

## Project Structure Overview

[View code (1-50)](/package.json)

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

[View code (9-17)](/README.md)

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

[View code (1-12)](/src/extension.ts)

Here's how to add new commands to Virgil:

**Steps:**

1. Add command to `package.json` `contributes.commands`
2. Register in `extension.ts` with `vscode.commands.registerCommand()`
3. Add to subscriptions for cleanup

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

- Extension activates on `*.walkthrough.json` detection
- `WalkthroughProvider` manages state and builds hierarchical sidebar
- `StepDetailPanel` shows rich step info in themed webview
- `HighlightManager` applies line decorations to editors
- All components coordinate through `extension.ts`
- Steps support hierarchy via `parentId` field
- Navigation traverses all steps in depth-first order
- Comments are persisted to JSON files
- Repository matching enables portable walkthroughs
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
