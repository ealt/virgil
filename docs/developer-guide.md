# Virgil Developer Guide

---

type: developer-onboarding
remote: <git@github.com>:ealt/virgil.git
commit: 650427ba9686081d02291711998d80a8ae3b6c9f
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

Let's start by understanding how the extension activates.

## Extension Activation

[View code (13-15)](/package.json)

Virgil activates when it detects any `*.walkthrough.json` file in your workspace root.

The activation event is defined in `package.json`. The extension uses `workspaceContains:*.walkthrough.json` which means it only activates when the workspace contains matching files.

**Key points:**

- Activation is lazy (only when needed)
- Multiple walkthrough files can coexist
- The extension watches for file changes automatically

## Extension Entry Point

[View code (13-41)](/src/extension.ts)

The `activate()` function in `extension.ts` is called when the extension activates.

**What happens on activation:**

1. Creates a `HighlightManager` instance
2. Finds walkthrough files in the workspace root
3. Initializes the `WalkthroughProvider`
4. Registers the tree view in the sidebar
5. Registers all commands
6. Sets up file watching
7. Auto-shows the first step if a walkthrough exists

**Early return:** If no workspace folder is open, the extension returns early.

## TypeScript Interfaces - Data Model

[View code (1-96)](/src/types.ts)

The `types.ts` file defines the shape of walkthrough JSON files.

**Key interfaces:**

- `Walkthrough` - Root object with title, description, repository, metadata, steps
- `WalkthroughStep` - Individual step with id, title, body, location, comments
- `Comment` - User comments with id, author, body
- `Repository` - Git repository info (remote URL, commit SHA)

**Utility functions:**

- `parseLocation()` - Parses location strings like `path:10-45,100-120`
- `normalizeRemoteUrl()` - Normalizes git URLs for comparison (SSH ↔ HTTPS)

These types ensure type safety throughout the extension.

## Command Registration

[View code (43-119)](/src/extension.ts)

The extension registers several commands for navigation and control.

**Navigation commands:**

- `virgil.start` - Jump to first step
- `virgil.next` - Go to next step
- `virgil.prev` - Go to previous step
- `virgil.goToStep` - Jump to specific step index

**Control commands:**

- `virgil.refresh` - Reload walkthrough from file
- `virgil.selectWalkthrough` - Switch between multiple walkthrough files
- `virgil.submitComment` - Add a comment to current step
- `virgil.openLocation` - Open file at specific location
- `virgil.checkoutCommit` - Checkout the commit specified in walkthrough

All commands delegate to `WalkthroughProvider` for state management, then call `showCurrentStep()` to update the UI.

## File Watching - Auto-refresh

[View code (271-293)](/src/extension.ts)

The extension uses VS Code's `FileSystemWatcher` to monitor `*.walkthrough.json` files.

**Event handling:**

- **onDidCreate**: Shows notification, refreshes provider, sets context
- **onDidChange**: Refreshes provider to reload walkthrough
- **onDidDelete**: Clears highlights, updates context, refreshes provider

**Benefits:**

- No need to manually refresh when editing walkthrough files
- Automatic detection of new walkthroughs
- Clean state management when files are deleted

The watcher uses `RelativePattern` to only watch the workspace root, not subdirectories.

## Show Current Step - Core Navigation

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

## WalkthroughProvider - State Management

[View code (17-220)](/src/WalkthroughProvider.ts)

The `WalkthroughProvider` class implements VS Code's `TreeDataProvider` interface.

**Responsibilities:**

- Loads and parses walkthrough JSON files
- Maintains current step index
- Builds tree items for the sidebar
- Handles git operations (remote matching, commit checking)
- Manages comments (add, save to file)
- Filters walkthroughs by repository remote

**Key methods:**

- `loadWalkthrough()` - Loads JSON file and parses it
- `getAvailableWalkthroughs()` - Finds all matching walkthrough files
- `goToStep()`, `nextStep()`, `prevStep()` - Navigation
- `addComment()` - Adds comment and saves to file
- `hasCommitMismatch()` - Checks if current commit matches walkthrough

**Repository matching:** Uses `normalizeRemoteUrl()` to handle SSH/HTTPS variations.

## Tree View - Building the Sidebar

[View code (358-425)](/src/WalkthroughProvider.ts)

The `getRootItems()` method builds the sidebar tree structure.

**Tree structure:**

1. **File selector** (if multiple walkthroughs) - Shows current file with count
2. **Title header** - Walkthrough title with description or commit mismatch warning
3. **Steps** - Numbered list of all steps

**Step indicators:**

- Current step: Green arrow icon + "(current)" label
- Steps with locations: File-code icon
- Steps without locations: Note icon

**Commit mismatch:** If the walkthrough commit doesn't match current HEAD, the title shows a warning icon and tooltip.

The tree view automatically updates when steps change via `_onDidChangeTreeData` event.

## StepDetailPanel - Webview UI

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

## Webview HTML Generation

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

## HighlightManager - Code Decorations

[View code (1-71)](/src/HighlightManager.ts)

The `HighlightManager` creates and manages text decorations that highlight code ranges.

**Decoration style:**

- Subtle blue background (`rgba(86, 156, 214, 0.1)`)
- Left border accent (`rgba(86, 156, 214, 0.6)`)
- `isWholeLine: true` highlights entire lines
- Appears in overview ruler (minimap) for navigation

**State management:**

- Tracks decorations per file in a `Map<string, Range[]>`
- `highlightRange()` adds decorations to a file
- `clearFile()` removes decorations from a specific file
- `clearAll()` removes all decorations
- `refreshEditor()` reapplies decorations when editor is reopened

**Usage:** Called by `showCurrentStep()` to highlight step locations.

## Comments System

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

## Commit Mismatch Detection

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

## Repository Remote Matching

[View code (28-55)](/src/types.ts)

Walkthroughs can be scoped to specific repositories using `repository.remote`.

**How it works:**

1. Walkthrough specifies `repository.remote`
2. Extension gets workspace git remote
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

## Location Parsing

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

## Project Structure Overview

[View code (1-50)](/package.json)

Understanding the project structure helps when contributing.

**Key directories:**

- `src/` - TypeScript source files
- `out/` - Compiled JavaScript (generated)
- `docs/` - Documentation (SCHEMA.md, DEVELOPMENT.md)
- `media/` - Assets (currently just panel.css, though styles are inline)

**Key files:**

- `package.json` - Extension manifest, commands, views, keybindings
- `tsconfig.json` - TypeScript configuration
- `extension.ts` - Entry point and coordination
- `types.ts` - Data model and utilities
- `WalkthroughProvider.ts` - State and tree view
- `StepDetailPanel.ts` - Webview UI
- `HighlightManager.ts` - Code decorations

**Build output:** TypeScript compiles to `out/` directory, which is what VS Code loads.

## How to Extend the Extension

[View code (1-12)](/src/extension.ts)

Here are some ways you can extend Virgil:

**Adding new commands:**

1. Add command to `package.json` `contributes.commands`
2. Register in `extension.ts` with `vscode.commands.registerCommand()`
3. Add to subscriptions for cleanup

**Enhancing the webview:**

- Modify `StepDetailPanel.getHtml()` to add new UI elements
- Add new message handlers in `onDidReceiveMessage`
- Update CSS for styling

**Adding features:**

- **Walkthrough validation**: Add schema validation on load
- **Export/import**: Add commands to export walkthroughs
- **Templates**: Create walkthrough templates
- **Search**: Add search functionality for steps
- **Multiple walkthroughs**: Show multiple walkthroughs simultaneously

**Testing:**

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

- Update `docs/SCHEMA.md` for schema changes
- Update `docs/DEVELOPMENT.md` for architecture changes
- Update `README.md` for user-facing changes

**See `docs/DEVELOPMENT.md` for more details.**

## Summary and Next Steps

**Key takeaways:**

- Extension activates on `*.walkthrough.json` detection
- `WalkthroughProvider` manages state and builds sidebar
- `StepDetailPanel` shows rich step info in themed webview
- `HighlightManager` applies line decorations to editors
- All components coordinate through `extension.ts`
- Comments are persisted to JSON files
- Repository matching enables portable walkthroughs
- Commit mismatch warnings help ensure correct code state

**Next steps for contributors:**

1. Read `docs/DEVELOPMENT.md` for detailed setup instructions
2. Explore the codebase using this walkthrough
3. Try making a small change (e.g., add a new command)
4. Test thoroughly in Extension Development Host
5. Submit a pull request

**Resources:**

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- `docs/SCHEMA.md` - Walkthrough JSON format
- `docs/DEVELOPMENT.md` - Development guide

Happy contributing! 🚀
