# Virgil

[![PR Checks](https://github.com/ealt/virgil/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/ealt/virgil/actions/workflows/pr-checks.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)](https://marketplace.visualstudio.com/items?itemName=ealt.virgil-walkthroughs)

Named after Dante's guide through the Inferno, Virgil transforms written walkthroughs into interactive journeys. Authors create the guidance—whether for code reviews, codebase onboarding, feature documentation, or any repository content—and Virgil brings it to life as a polished, step-by-step experience within your editor. It's the tooling that turns knowledge into a guided path.

## Features

- **Interactive Code Walkthroughs**: Navigate through code with step-by-step explanations
- **Hierarchical Steps**: Organize steps into nested sub-steps with collapsible tree view
- **Code Highlighting**: Automatically highlights relevant code sections as you progress
- **Diff Mode**: Compare changes between commits with 3-way toggle (Diff/Head/Base)
- **Markdown Rendering**: Toggle between raw source (with highlighting) and rendered preview for markdown files
- **Multiple Navigation Methods**: Use the sidebar, keyboard shortcuts, or detail panel buttons
- **Comments**: Add comments to steps for collaboration and notes
- **Commit Awareness**: Warns when viewing walkthroughs created for different codebase states
- **Repository Scoping**: Walkthroughs can be scoped to specific repositories

## Installation

### From VS Code Marketplace

1. Open VS Code or Cursor
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Virgil"
4. Click **Install**

Or install via command line:

```bash
code --install-extension ealt.virgil-walkthroughs
```

### From Source

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the extension:

   ```bash
   npm run compile
   ```

4. Package the extension:

   ```bash
   npx vsce package --allow-missing-repository
   ```

5. Install the `.vsix` file:
   - **VS Code**: `code --install-extension virgil-walkthroughs-<version>.vsix`
   - **Cursor**: `cursor --install-extension virgil-walkthroughs-<version>.vsix`

### Dev Refresh Script

If you are actively working on the extension and want to rebuild + reinstall quickly:

```bash
npm run refresh:extension
```

This runs `npm install`, compiles, packages the VSIX, and installs it into Cursor. Reload the window afterward.

## Quick Start

1. **Write a Markdown walkthrough**: Create a `.md` file using the [Markdown walkthrough format](#creating-walkthroughs)

2. **Convert to JSON**: Run `Virgil: Convert Markdown to Walkthrough` to generate a JSON file in the `walkthroughs/` directory

3. **Open your workspace**: The Virgil extension will automatically detect walkthrough files (`.walkthrough.json` at root or any `.json` in `walkthroughs/` directory) and activate

4. **Navigate**:
   - Click steps in the Virgil sidebar (book icon in the activity bar)
   - Use keyboard shortcuts (see below)
   - Use Previous/Next buttons in the detail panel

5. **View details**: The detail panel opens automatically showing step descriptions, code locations, and comments

## Usage

### Navigating Walkthroughs

- **Sidebar**: Click any step in the Virgil sidebar to jump to it
- **Keyboard Shortcuts**: Use shortcuts to move between steps (see below)
- **Detail Panel**: Use the Previous/Next buttons in the detail panel
- **Code Locations**: Click on location links in the detail panel to open files

### Keyboard Shortcuts

| Command          | Mac            | Windows/Linux  |
| ---------------- | -------------- | -------------- |
| Next Step        | `Cmd+Shift+]`  | `Ctrl+Shift+]` |
| Previous Step    | `Cmd+Shift+[`  | `Ctrl+Shift+[` |
| Go to Parent     | `Cmd+Shift+\`  | `Ctrl+Shift+\` |
| Next Sibling     | `Cmd+Option+]` | `Ctrl+Alt+]`   |
| Previous Sibling | `Cmd+Option+[` | `Ctrl+Alt+[`   |

Keyboard shortcuts are only active when a walkthrough is loaded.

### Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Virgil: Start Walkthrough` - Jump to the first step
- `Virgil: Next Step` - Go to next step
- `Virgil: Previous Step` - Go to previous step
- `Virgil: Go to Parent Step` - Navigate to the parent step in hierarchical walkthroughs
- `Virgil: Next Sibling Step` - Navigate to the next sibling step (same level)
- `Virgil: Previous Sibling Step` - Navigate to the previous sibling step (same level)
- `Virgil: Refresh Walkthrough` - Reload the JSON file
- `Virgil: Select Walkthrough` - Switch between multiple walkthrough files
- `Virgil: Convert Markdown to Walkthrough` - Convert a Markdown walkthrough to JSON

### Adding Comments

1. Navigate to a step
2. Scroll to the Comments section in the detail panel
3. Type your comment in the text area
4. Click "Add Comment" or press `Ctrl+Enter` / `Cmd+Enter`
5. Comments are saved to the walkthrough JSON file and attributed to your git `user.name`

### Commit Mismatch Warnings

If a walkthrough specifies a `repository.commit`, the extension will warn you if your current commit doesn't match. This helps ensure you're viewing the walkthrough with the correct codebase state. You can choose to checkout the specified commit or continue anyway.

### Viewing Markdown Files

When a walkthrough step references a markdown file (`.md` or `.markdown`), a **Markdown: Rendered / Raw** toggle appears in the detail panel:

- **Rendered** (default): Shows VS Code's markdown preview with highlighted sections - the specified line ranges are visually highlighted with a colored background and border
- **Raw**: Shows the markdown source in the text editor with line highlighting - useful for seeing exactly which lines are referenced

This is helpful for walkthroughs that reference documentation files like README.md or other markdown content.

## Configuration

Virgil supports customization through VS Code settings. Open Settings (`Cmd+,` / `Ctrl+,`) and search for "Virgil" to configure:

### Highlight Colors

Customize the colors used for code highlighting. Colors use semantic names based on their purpose:

- **`standard`**: Used for point-in-time/non-diff steps (default: blue)
- **`diffHead`**: Used for head/new code in diff mode (default: green)
- **`diffBase`**: Used for base/old code in diff mode (default: red)

Each color type has three properties you can customize:

- `backgroundColor`: Background color for highlighted lines
- `borderColor`: Left border color
- `overviewRulerColor`: Color in the overview ruler

**Example settings.json:**

```json
{
  "virgil.highlights.standard.backgroundColor": "#569CDE1A",
  "virgil.highlights.standard.borderColor": "#569CDE99",
  "virgil.highlights.standard.overviewRulerColor": "#569CDECC",
  "virgil.highlights.diffHead.backgroundColor": "#48B46126",
  "virgil.highlights.diffHead.borderColor": "#48B46199",
  "virgil.highlights.diffHead.overviewRulerColor": "#48B461CC",
  "virgil.highlights.diffBase.backgroundColor": "#DC505026",
  "virgil.highlights.diffBase.borderColor": "#DC505099",
  "virgil.highlights.diffBase.overviewRulerColor": "#DC5050CC"
}
```

Colors support both 6-digit (`#RRGGBB`) and 8-digit (`#RRGGBBAA`) hex formats. The 8-digit format includes alpha channel for transparency.

### View Behavior

- **`virgil.view.defaultDiffViewMode`**: Default view mode for diff steps
  - `"diff"` (default): Side-by-side comparison
  - `"head"`: Show new code only
  - `"base"`: Show old code only

- **`virgil.view.defaultMarkdownViewMode`**: Default view mode for markdown files
  - `"rendered"` (default): Formatted markdown with highlighting
  - `"raw"`: Source markdown in text editor

- **`virgil.view.autoShowFirstStep`**: Automatically show the first step when a walkthrough loads (default: `true`)

- **`virgil.view.showStepNumbers`**: Show hierarchical step numbers in step labels (default: `true`)

- **`virgil.view.showHierarchicalNavigation`**: Show parent and sibling navigation buttons in the step panel (default: `false`). When enabled, buttons for navigating to parent, previous sibling, and next sibling steps appear in the detail panel. Keyboard shortcuts for hierarchical navigation work regardless of this setting.

### Customizing Keyboard Shortcuts

Keyboard shortcuts can be customized through VS Code's keybindings. The default shortcuts are:

- **Next Step**: `Cmd+Shift+]` (Mac) / `Ctrl+Shift+]` (Windows/Linux)
- **Previous Step**: `Cmd+Shift+[` (Mac) / `Ctrl+Shift+[` (Windows/Linux)
- **Go to Parent**: `Cmd+Shift+\` (Mac) / `Ctrl+Shift+\` (Windows/Linux)
- **Next Sibling**: `Cmd+Option+]` (Mac) / `Ctrl+Alt+]` (Windows/Linux)
- **Previous Sibling**: `Cmd+Option+[` (Mac) / `Ctrl+Alt+[` (Windows/Linux)

**To customize keybindings:**

1. Open Keyboard Shortcuts:
   - **Mac**: `Cmd+K Cmd+S`
   - **Windows/Linux**: `Ctrl+K Ctrl+S`
   - Or go to: **File → Preferences → Keyboard Shortcuts** (VS Code) or **Cursor → Settings → Keyboard Shortcuts** (Cursor)

2. Search for "Virgil" in the search box

3. Find the command you want to customize (e.g., "Virgil: Next Step" or "Virgil: Previous Step")

4. Click on the command, then press your desired key combination

5. If the key combination is already in use, VS Code will warn you and you can choose to replace it or use a different combination

#### Alternative: Edit keybindings.json directly

You can also edit your `keybindings.json` file directly:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run "Preferences: Open Keyboard Shortcuts (JSON)"
3. Add entries like:

```json
[
  {
    "command": "virgil.next",
    "key": "ctrl+right",
    "when": "virgilWalkthroughActive"
  },
  {
    "command": "virgil.prev",
    "key": "ctrl+left",
    "when": "virgilWalkthroughActive"
  },
  {
    "command": "virgil.goToParent",
    "key": "ctrl+up",
    "when": "virgilWalkthroughActive"
  },
  {
    "command": "virgil.nextSibling",
    "key": "ctrl+alt+right",
    "when": "virgilWalkthroughActive"
  },
  {
    "command": "virgil.prevSibling",
    "key": "ctrl+alt+left",
    "when": "virgilWalkthroughActive"
  }
]
```

The `when` clause ensures shortcuts only work when a walkthrough is active.

## Creating Walkthroughs

The easiest way to create a walkthrough is to write it in **Markdown** and convert it using the extension. This keeps authoring simple and readable, and the conversion handles the JSON structure for you.

### Recommended: Markdown Walkthroughs

```markdown
# Walkthrough Title

---

metadata_key: value
remote: git@github.com:org/repo.git
commit: abc123...

---

Description text

## Step Title

[View code (10-20)](/src/file.ts)

Step body text.

### Sub-step Title

Sub-steps use ### headers (nested under ##).
```

Convert it with:

1. Open or create a Markdown file
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. The JSON file will be automatically created in the `walkthroughs/` directory with the same basename as the Markdown file

**Example:** See [docs/developer-guide.md](docs/developer-guide.md) for a complete walkthrough in Markdown.

For detailed Markdown format docs, see the [Markdown Format section](docs/schema.md#markdown-format). Use a leading `/` in link URLs so they resolve from the repo root.

### Advanced: JSON Walkthroughs

If you prefer to author JSON directly, you can create walkthrough files in two locations:

1. **Root location**: `.walkthrough.json` at the workspace root
2. **Walkthroughs directory**: Any `.json` file in the `walkthroughs/` directory

Files in the `walkthroughs/` directory do not need the `.walkthrough.json` suffix - any `.json` file is recognized.

```json
{
  "title": "My Walkthrough",
  "description": "A brief description",
  "steps": [
    {
      "id": 1,
      "title": "First Step",
      "body": "Explanation of what this step covers",
      "location": "src/file.ts:10-25"
    }
  ]
}
```

### Key Fields

- **title** (required): The walkthrough name
- **description** (optional): Brief summary
- **steps** (required): Array of step objects
- **repository** (optional): Git repository info for scoping and commit tracking
- **metadata** (optional): Freeform key-value pairs

### Step Fields

- **id** (required): Step identifier (typically 1, 2, 3, ...)
- **title** (required): Step name
- **body** (optional): Explanation text (supports Markdown)
- **location** (optional): File location in format `path:startLine-endLine`
- **parentId** (optional): Parent step's id for hierarchical display
- **comments** (optional): Array of user comments

### Hierarchical Steps

Steps can be organized into a tree structure using `parentId`:

```json
{
  "steps": [
    { "id": 1, "title": "Architecture" },
    { "id": 2, "title": "Frontend", "parentId": 1 },
    { "id": 3, "title": "Backend", "parentId": 1 },
    { "id": 4, "title": "Conclusion" }
  ]
}
```

This displays as an indented tree in the sidebar. In Markdown, use header levels: `##` for top-level, `###` for children, `####` for grandchildren, etc.

### Location Format

Locations use the format: `path:startLine-endLine`

Examples:

- `src/auth.ts:10-45` - lines 10 to 45
- `src/auth.ts:10` - single line 10
- `src/auth.ts:10-45,100-120` - multiple ranges (comma-separated)

### Markdown Support

The `body` field supports Markdown formatting:

- Headers, bold, italic
- Code blocks with syntax highlighting
- Lists, links, blockquotes

### Repository Scoping

You can scope walkthroughs to specific repositories:

```json
{
  "title": "PR Review",
  "repository": {
    "remote": "https://github.com/org/repo",
    "commit": "a1b2c3d4e5f6..."
  },
  "steps": [...]
}
```

When `repository.remote` is specified, the walkthrough only appears for workspaces with matching Git remotes. This allows storing walkthroughs in shared locations while only showing them for relevant repositories.

### Diff Walkthroughs

For PR reviews or comparing changes between commits, use diff mode by specifying a base reference and `base_location` on steps:

```json
{
  "title": "PR Review: Auth Refactor",
  "repository": {
    "remote": "https://github.com/org/repo",
    "commit": "abc123",
    "baseBranch": "main"
  },
  "steps": [
    {
      "id": 1,
      "title": "Overview",
      "body": "This PR refactors the authentication system..."
    },
    {
      "id": 2,
      "title": "JWT validation changes",
      "body": "Key changes to the JWT validation logic:",
      "location": "src/auth/jwt.ts:15-45",
      "base_location": "src/auth/jwt.ts:15-40"
    },
    {
      "id": 3,
      "title": "New helper added",
      "body": "This function was added:",
      "location": "src/auth/helpers.ts:1-20"
    },
    {
      "id": 4,
      "title": "Removed legacy code",
      "body": "This code was removed:",
      "base_location": "src/auth/legacy.ts:1-50"
    }
  ]
}
```

**Base reference options** (pick one):

- `baseBranch`: Branch name (e.g., "main") - resolved at runtime
- `baseCommit`: Explicit commit SHA
- `pr`: PR number - uses the PR's base branch

**Step types:**

- Steps with both `location` and `base_location` show a 3-way toggle (Diff/Head/Base)
- Steps with only `location` show with standard highlights (configurable, default: blue)
- Steps with only `base_location` show with diff base highlights (configurable, default: red)

**Markdown format:**

```markdown
## JWT validation changes

[View code (15-45)](/src/auth/jwt.ts)
[Base (15-40)](/src/auth/jwt.ts)

Key changes to the JWT validation logic.
```

### Complete Example

See [docs/schema.md](docs/schema.md) for the complete schema documentation with detailed examples.

### Writing Walkthroughs in Markdown

You can write walkthroughs in Markdown format and convert them to JSON using the extension. This makes it easier to write and maintain longer walkthroughs.

**Basic format:**

```markdown
# Walkthrough Title

---

metadata_key: value
remote: git@github.com:org/repo.git
commit: abc123...

---

Description text

## Step Title

[View code (10-20)](/src/file.ts)

Step body text.
```

**Key features:**

- Title from first `#` heading
- YAML frontmatter for metadata and repository info
- Steps from `##` headings, sub-steps from `###`, `####`, etc. (creates hierarchical tree)
- Location links: `[text (10-20)](/file.ts)` immediately after step title
- Repository info automatically inferred from Git if not in frontmatter

**Converting to JSON:**

1. Open or create a Markdown file
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. The JSON file will be automatically created in the `walkthroughs/` directory with the same basename as the Markdown file

You can also use the "Select Walkthrough" command to browse and select Markdown files, which will be converted automatically.

**Example:** See [docs/developer-guide.md](docs/developer-guide.md) for a complete example.

For detailed documentation on the Markdown format, see the [Markdown Format section](docs/schema.md#markdown-format) in the schema documentation. Use a leading `/` in link URLs so they resolve from the repo root.

## Walkthrough Format

For complete documentation of the walkthrough JSON format, including all fields, examples, and TypeScript interfaces, see [docs/schema.md](docs/schema.md).

## Contributing

Interested in contributing to Virgil?

1. **Fork the repository** on GitHub
2. **Clone your fork** and set up the upstream remote
3. See [CONTRIBUTING.md](CONTRIBUTING.md) for a quick start guide
4. See [docs/development.md](docs/development.md) for detailed development setup and architecture
5. See [docs/marketplace-setup.md](docs/marketplace-setup.md) for marketplace publishing setup (maintainers only)

Your interest in contributing is appreciated! Please open an issue first to discuss major changes, or submit a pull request for smaller fixes and improvements.

## License

MIT
