# Virgil

Interactive guided walkthroughs for code review and codebase exploration. Named after Dante's guide through the Divine Comedy.

## Features

- **Interactive Code Walkthroughs**: Navigate through code with step-by-step explanations
- **Code Highlighting**: Automatically highlights relevant code sections as you progress
- **Multiple Navigation Methods**: Use the sidebar, keyboard shortcuts, or detail panel buttons
- **Comments**: Add comments to steps for collaboration and notes
- **Commit Awareness**: Warns when viewing walkthroughs created for different codebase states
- **Repository Scoping**: Walkthroughs can be scoped to specific repositories

## Installation

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
   - **VS Code**: `code --install-extension virgil-0.1.0.vsix`
   - **Cursor**: `cursor --install-extension virgil-0.1.0.vsix`

## Quick Start

1. **Create a walkthrough file**: Create a file ending in `.walkthrough.json` in your workspace root (see [Creating Walkthroughs](#creating-walkthroughs) below)

2. **Open your workspace**: The Virgil extension will automatically detect the walkthrough file and activate

3. **Navigate**:
   - Click steps in the Virgil sidebar (book icon in the activity bar)
   - Use keyboard shortcuts (see below)
   - Use Previous/Next buttons in the detail panel

4. **View details**: The detail panel opens automatically showing step descriptions, code locations, and comments

## Usage

### Navigating Walkthroughs

- **Sidebar**: Click any step in the Virgil sidebar to jump to it
- **Keyboard Shortcuts**: Use shortcuts to move between steps (see below)
- **Detail Panel**: Use the Previous/Next buttons in the detail panel
- **Code Locations**: Click on location links in the detail panel to open files

### Keyboard Shortcuts

| Command | Mac | Windows/Linux |
|---------|-----|---------------|
| Next Step | `Cmd+Shift+]` | `Ctrl+Shift+]` |
| Previous Step | `Cmd+Shift+[` | `Ctrl+Shift+[` |

Keyboard shortcuts are only active when a walkthrough is loaded.

### Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Virgil: Start Walkthrough` - Jump to the first step
- `Virgil: Next Step` - Go to next step
- `Virgil: Previous Step` - Go to previous step
- `Virgil: Refresh Walkthrough` - Reload the JSON file
- `Virgil: Select Walkthrough` - Switch between multiple walkthrough files

### Adding Comments

1. Navigate to a step
2. Scroll to the Comments section in the detail panel
3. Type your comment in the text area
4. Click "Add Comment" or press `Ctrl+Enter` / `Cmd+Enter`
5. Comments are saved to the walkthrough JSON file and attributed to your git `user.name`

### Commit Mismatch Warnings

If a walkthrough specifies a `repository.commit`, the extension will warn you if your current commit doesn't match. This helps ensure you're viewing the walkthrough with the correct codebase state. You can choose to checkout the specified commit or continue anyway.

## Creating Walkthroughs

Walkthroughs are JSON files that follow a specific schema. Create a file ending in `.walkthrough.json` in your workspace root.

### Basic Structure

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
- **comments** (optional): Array of user comments

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

When `repository.remote` is specified, the walkthrough only appears for workspaces with matching git remotes. This allows storing walkthroughs in shared locations while only showing them for relevant repositories.

### Complete Example

See [docs/SCHEMA.md](docs/SCHEMA.md) for the complete schema documentation with detailed examples.

## Walkthrough Format

For complete documentation of the walkthrough JSON format, including all fields, examples, and TypeScript interfaces, see [docs/SCHEMA.md](docs/SCHEMA.md).

## Contributing

Interested in contributing to Virgil? See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for development setup, architecture overview, and contributing guidelines.

## License

MIT
