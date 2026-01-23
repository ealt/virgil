# Development Guide

This guide is for developers who want to contribute to the Virgil extension.

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- npm
- VS Code or Cursor (for testing)

### Initial Setup

#### For Contributors (Fork-Based Workflow)

1. **Fork the repository** on GitHub (click the "Fork" button)

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/virgil.git
   cd virgil
   ```

3. **Add upstream remote** (to sync with the main repository):

   ```bash
   git remote add upstream https://github.com/ealt/virgil.git
   ```

#### For Maintainers (Direct Access)

1. Clone the repository:

   ```bash
   git clone https://github.com/ealt/virgil.git
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
   - In the new window, open a workspace with a walkthrough file (`.walkthrough.json` at root or any `.json` in `walkthroughs/` directory) to test

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
│   ├── schema.md           # Walkthrough JSON schema documentation
│   └── development.md      # This file
└── out/                    # Compiled JavaScript (generated)
```

## Architecture Overview

Virgil is a VS Code extension that provides interactive code walkthroughs. The extension activates when it detects `.walkthrough.json` files in the workspace root, and discovers walkthroughs from both the root (`.walkthrough.json`) and the `walkthroughs/` directory (any `.json` files). It provides a tree view, webview panel, and code highlighting.

### Key Components

#### `extension.ts`

The main entry point that:

- Activates when `*.walkthrough.json` files are detected at workspace root
- Discovers walkthroughs from both root (`.walkthrough.json`) and `walkthroughs/` directory (any `.json` files)
- Initializes core components (HighlightManager, WalkthroughProvider)
- Registers commands (start, next, prev, refresh, select, etc.)
- Sets up file watching for walkthrough files in both locations
- Coordinates navigation and UI updates
- Handles Markdown to JSON conversion via file picker

#### `WalkthroughProvider.ts`

Implements `TreeDataProvider` to:

- Load and parse walkthrough JSON files
- Discover walkthroughs from root (`.walkthrough.json`) and `walkthroughs/` directory (any `.json` files)
- Manage current step state
- Build the sidebar tree view
- Handle Git operations (commit checking, checkout)
- Manage comments (add, save to file)

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

1. Extension activates on `workspaceContains:*.walkthrough.json` (detects root `.walkthrough.json` files)
2. `extension.ts` finds walkthrough files in two locations:
   - `.walkthrough.json` at workspace root
   - Any `.json` files in `walkthroughs/` directory
3. `WalkthroughProvider` loads the first available walkthrough
4. Tree view is registered and displayed in sidebar
5. If walkthrough exists, first step is automatically shown
6. Users can select different walkthroughs via "Select Walkthrough" command, which also allows selecting Markdown files for conversion

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

- `FileSystemWatcher` monitors both:
  - `.walkthrough.json` at workspace root
  - `walkthroughs/*.json` files
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

### Walkthrough Discovery

- Walkthroughs are discovered from two locations:
  - `.walkthrough.json` at workspace root
  - Any `.json` files in `walkthroughs/` directory
- `getAvailableWalkthroughs()` returns all discovered walkthroughs
- Users can select walkthroughs via the "Select Walkthrough" command
- The selection command also allows picking Markdown files, which are converted to JSON and saved to `walkthroughs/` directory

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
3. In the new window, open a workspace with a walkthrough file (`.walkthrough.json` at root or any `.json` in `walkthroughs/` directory)
4. Test features: navigation, highlighting, comments, walkthrough selection, Markdown conversion, etc.

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
- Git operations handle non-Git workspaces gracefully

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
3. **Schema Changes**: Update `types.ts` and `docs/schema.md`
4. **New Files**: Follow existing patterns, add to appropriate component

### Pull Request Process

#### For Contributors (Fork-Based)

1. **Sync your fork** with upstream (before starting):

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Create a feature branch** in your fork:

   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make changes** with clear commits (Husky will run pre-commit hooks)

4. **Test thoroughly** in Extension Development Host

5. **Update documentation** if needed

6. **Push to your fork**:

   ```bash
   git push origin feature/my-feature
   ```

7. **Create Pull Request** from your fork to the main repository
   - Use the PR template
   - Describe your changes clearly
   - Reference any related issues

8. **Address review feedback** by pushing more commits to your branch

#### For Maintainers

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes with clear commits
3. Test thoroughly in Extension Development Host
4. Update documentation if needed
5. Push branch and create PR: `git push origin feature/my-feature`
6. Submit PR with description of changes

### Areas for Improvement

- Automated testing
- Better error messages
- Walkthrough validation (schema checking)
- Support for multiple walkthroughs simultaneously
- Export/import walkthroughs
- Walkthrough templates
- Better Markdown rendering options

## Dependencies

### Runtime Dependencies

- `highlight.js` - Syntax highlighting in Markdown code blocks
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
