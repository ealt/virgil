# AGENTS.md

This repo is a VS Code extension written in TypeScript that provides interactive code walkthroughs with step-by-step navigation, code highlighting, and diff viewing.

## Project layout

- `src/`: TypeScript source for the extension.
- `out/`: Compiled JavaScript output (generated).
- `docs/`: Developer docs and walkthrough schema.
- `walkthroughs/`: Example/author walkthrough JSON files.
- `scripts/`: Dev helper scripts.

## Key source files

**Core:**

- `extension.ts`: Entry point, activation, command registration
- `types.ts`: TypeScript interfaces and tree utilities

**UI/Views:**

- `WalkthroughProvider.ts`: Tree view provider, step navigation
- `StepDetailPanel.ts`: Webview panel for step details
- `HighlightManager.ts`: Code highlighting/decorations

**Content Providers:**

- `DiffContentProvider.ts`: Git file content for virtual documents
- `MarkdownHighlightProvider.ts`: Markdown preview with highlighting

**Utilities:**

- `markdownParser.ts`: Converts Markdown walkthroughs to JSON
- `DiffResolver.ts`: Resolves base commits for diff viewing

## Virtual document providers

The extension uses custom URI schemes for virtual documents:

- `virgil-git://` - File content from git commits (DiffContentProvider)
- `virgil-md-preview://` - Markdown with injected highlighting (MarkdownHighlightProvider)

## View modes

- **Diff steps**: Toggle between diff/head/base views
- **Markdown files**: Toggle between rendered (default, with highlighting) and raw views

## Setup

- Install dependencies: `npm install`

## Common commands

- Build: `npm run compile`
- Watch: `npm run watch`
- Lint: `npm run lint`
- Format: `npm run format`
- Format check: `npm run format:check`
- Package VSIX: `npm run package`
- Dev refresh (rebuild + install): `npm run refresh:extension`

## Testing

- Run `npm run watch` for auto-compilation
- Press `F5` in VS Code to launch Extension Development Host
- Open a workspace with a walkthrough file (`.walkthrough.json` at root or any `.json` in `walkthroughs/`)

## Editing rules of thumb

- Edit TypeScript in `src/`; do not hand-edit `out/`.
- Avoid committing changes to `node_modules/` or other generated artifacts.
- If you change the walkthrough schema or Markdown conversion behavior, update docs in `docs/`.
- Run `npm run compile` (and `npm run lint` when appropriate) before finalizing changes.
- Walkthroughs support hierarchical steps via `parentId` (see `types.ts` for tree utilities).

## Walkthrough files

Walkthroughs are discovered from:

- `.walkthrough.json` at workspace root
- Any `.json` files in `walkthroughs/` directory

Markdown files can be converted to JSON using the `Virgil: Convert Markdown to Walkthrough` command.

## Quality and consistency

- Prefer small, composable functions; keep UI/view updates in the webview layer and data/model logic in extension services.
- Keep commands and side effects centralized (avoid ad-hoc `vscode.commands.executeCommand` calls in leaf helpers).
- Preserve existing naming patterns: `camelCase` for functions/vars, `PascalCase` for classes, `SCREAMING_SNAKE_CASE` for constants.
- Favor explicit types over `any`; if narrowing is needed, use type guards and narrow as close to the source as possible.
- Keep UI strings consistent (match casing and phrasing) and reuse existing labels where possible.
- Handle failures explicitly: surface user-facing errors via `vscode.window.showErrorMessage` and log diagnostics once.
- Keep JSON schema changes backward-compatible; if not possible, document and add migration notes in `docs/`.
- Add or update tests if behavior changes are user-visible or parsing-related.

## Helpful docs

- Walkthrough schema and Markdown format: `docs/schema.md`
- Development setup and architecture: `docs/development.md`
