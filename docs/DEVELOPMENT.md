# Development Guide

This guide is for developers who want to contribute to the Virgil extension.

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- npm
- VS Code or Cursor (for testing)

### Initial Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd virgil
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the extension:

   ```bash
   npm run compile
   ```

### Development Workflow

1. **Watch mode**: Run the TypeScript compiler in watch mode to automatically recompile on changes:

   ```bash
   npm run watch
   ```

2. **Testing**:
   - Open the `virgil` folder in VS Code/Cursor
   - Press `F5` to launch a new Extension Development Host window
   - In the new window, open a workspace with a `.walkthrough.json` file to test

3. **Packaging**: Create a `.vsix` file for distribution:

   ```bash
   npx vsce package --allow-missing-repository
   ```

## Project Structure

```
virgil/
├── package.json              # Extension manifest (activation, commands, views)
├── tsconfig.json            # TypeScript configuration
├── src/
│   ├── extension.ts         # Entry point, activation, command registration
│   ├── types.ts             # TypeScript interfaces for walkthrough schema
│   ├── WalkthroughProvider.ts  # Tree view provider for sidebar
│   ├── StepDetailPanel.ts   # Webview panel for step details
│   └── HighlightManager.ts  # Code highlighting/decorations
├── media/
│   └── panel.css           # Styles for webview (currently unused, styles inline)
├── docs/
│   ├── SCHEMA.md           # Walkthrough JSON schema documentation
│   └── DEVELOPMENT.md      # This file
└── out/                    # Compiled JavaScript (generated)
```

## Architecture Overview

Virgil is a VS Code extension that provides interactive code walkthroughs. The extension activates when it detects `.walkthrough.json` files in the workspace and provides a tree view, webview panel, and code highlighting.

### Key Components

#### `extension.ts`

The main entry point that:

- Activates when `*.walkthrough.json` files are detected
- Initializes core components (HighlightManager, WalkthroughProvider)
- Registers commands (start, next, prev, refresh, etc.)
- Sets up file watching for walkthrough files
- Coordinates navigation and UI updates

#### `WalkthroughProvider.ts`

Implements `TreeDataProvider` to:

- Load and parse walkthrough JSON files
- Manage current step state
- Build the sidebar tree view
- Handle git operations (commit checking, checkout)
- Manage comments (add, save to file)
- Filter walkthroughs by repository remote

#### `StepDetailPanel.ts`

Creates and manages the webview panel that:

- Displays step title, body (with Markdown rendering), and location
- Shows metadata on the first step
- Renders comments with Markdown support
- Provides Previous/Next navigation buttons
- Handles comment submission
- Communicates with extension via `postMessage`

#### `HighlightManager.ts`

Manages code decorations to:

- Highlight line ranges in editors
- Track active decorations per file
- Clear decorations when navigating
- Use VS Code's decoration API with custom styling

#### `types.ts`

Defines TypeScript interfaces:

- `Walkthrough`, `WalkthroughStep`, `Comment`, `Repository`
- Utility functions: `parseLocation()`, `normalizeRemoteUrl()`

## How It Works

### Activation Flow

1. Extension activates on `workspaceContains:*.walkthrough.json`
2. `extension.ts` finds walkthrough files in workspace root
3. `WalkthroughProvider` loads the first available walkthrough
4. Tree view is registered and displayed in sidebar
5. If walkthrough exists, first step is automatically shown

### Navigation Flow

1. User clicks step in sidebar OR uses keyboard shortcut OR clicks panel button
2. Command handler calls `WalkthroughProvider.goToStep(index)`
3. `showCurrentStep()` function:
   - Clears previous highlights
   - Parses step location
   - Opens file in editor
   - Applies highlights via `HighlightManager`
   - Updates `StepDetailPanel` with step content

### File Watching

- `FileSystemWatcher` monitors `*.walkthrough.json` files
- On create: Shows notification, refreshes provider
- On change: Refreshes provider
- On delete: Clears highlights, updates context

### Comment System

1. User types comment in webview textarea
2. Webview sends `submitComment` message via `postMessage`
3. Extension command handler calls `WalkthroughProvider.addComment()`
4. Comment is added to step's `comments` array
5. Walkthrough JSON is saved to disk
6. Panel is refreshed to show new comment

### Repository Matching

- Walkthroughs can specify `repository.remote`
- `normalizeRemoteUrl()` handles SSH/HTTPS variations, `.git` suffix, case
- Only matching walkthroughs appear in `getAvailableWalkthroughs()`
- Allows portable walkthrough files that only show for relevant repos

### Commit Mismatch Detection

- Walkthroughs can specify `repository.commit`
- Extension compares current HEAD to walkthrough commit
- Shows warning dialog if mismatch detected
- User can checkout the commit or continue anyway

## Building and Packaging

### Compile

```bash
npm run compile
```

Compiles TypeScript to JavaScript in the `out/` directory.

### Package

```bash
npx vsce package --allow-missing-repository
```

Creates a `.vsix` file that can be installed in VS Code/Cursor.

### Watch Mode

```bash
npm run watch
```

Continuously compiles TypeScript on file changes. Useful during development.

## Testing

Currently, testing is manual:

1. Run `npm run watch` in terminal
2. Press `F5` in VS Code to launch Extension Development Host
3. In the new window, open a workspace with a `.walkthrough.json` file
4. Test features: navigation, highlighting, comments, etc.

For automated testing, consider adding:

- Unit tests for utility functions (`parseLocation`, `normalizeRemoteUrl`)
- Integration tests for walkthrough loading and parsing
- E2E tests for UI interactions

## Code Organization

### Type Safety

- All walkthrough data structures are typed via `types.ts`
- JSON parsing uses type assertions with interfaces
- Location strings are parsed and validated

### Error Handling

- File operations wrapped in try/catch
- JSON parsing errors show user-friendly messages
- Git operations handle non-git workspaces gracefully

### State Management

- `WalkthroughProvider` maintains current step index
- `HighlightManager` tracks decorations per file
- `StepDetailPanel` is a singleton (one panel instance)

### Webview Communication

- Extension → Webview: HTML content with data embedded
- Webview → Extension: `postMessage` with command objects
- Commands: `next`, `prev`, `openLocation`, `submitComment`

## Contributing Guidelines

### Code Style

- TypeScript with strict mode enabled
- Use async/await for asynchronous operations
- Follow VS Code extension patterns
- Use VS Code API types (`vscode` namespace)

### Adding Features

1. **New Commands**: Add to `package.json` `contributes.commands`, register in `extension.ts`
2. **New UI**: Consider tree view items or webview enhancements
3. **Schema Changes**: Update `types.ts` and `docs/SCHEMA.md`
4. **New Files**: Follow existing patterns, add to appropriate component

### Pull Request Process

1. Create a feature branch
2. Make changes with clear commits
3. Test thoroughly in Extension Development Host
4. Update documentation if needed
5. Submit PR with description of changes

### Areas for Improvement

- Automated testing
- Better error messages
- Walkthrough validation (schema checking)
- Support for multiple walkthroughs simultaneously
- Export/import walkthroughs
- Walkthrough templates
- Better markdown rendering options

## Dependencies

### Runtime Dependencies

- `highlight.js` - Syntax highlighting in markdown code blocks
- `marked` - Markdown parsing and rendering
- `marked-highlight` - Integration of highlight.js with marked

### Dev Dependencies

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `@types/vscode` - VS Code API type definitions
- `eslint` - Linting
- `@typescript-eslint/*` - TypeScript ESLint plugins

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
