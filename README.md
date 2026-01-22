# Virgil

Named after Dante's guide through the Inferno, Virgil transforms written walkthroughs into interactive journeys. Authors create the guidance—whether for code reviews, codebase onboarding, feature documentation, or any repository content—and Virgil brings it to life as a polished, step-by-step experience within your editor. It's the tooling that turns knowledge into a guided path.

## Features

- **Interactive Code Walkthroughs**: Navigate through code with step-by-step explanations
- **Code Highlighting**: Automatically highlights relevant code sections as you progress
- **Diff Mode**: Compare changes between commits with 3-way toggle (Diff/Head/Base)
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

### Dev Refresh Script

If you are actively working on the extension and want to rebuild + reinstall quickly:

```bash
npm run refresh:extension
```

This runs `npm install`, compiles, packages the VSIX, and installs it into Cursor. Reload the window afterward.

## Quick Start

1. **Write a Markdown walkthrough**: Create a `.md` file using the [Markdown walkthrough format](#creating-walkthroughs)

2. **Convert to JSON**: Run `Virgil: Convert Markdown to Walkthrough` to generate the `.walkthrough.json`

3. **Open your workspace**: The Virgil extension will automatically detect the walkthrough file and activate

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
- `Virgil: Convert Markdown to Walkthrough` - Convert a Markdown walkthrough to JSON

### Adding Comments

1. Navigate to a step
2. Scroll to the Comments section in the detail panel
3. Type your comment in the text area
4. Click "Add Comment" or press `Ctrl+Enter` / `Cmd+Enter`
5. Comments are saved to the walkthrough JSON file and attributed to your git `user.name`

### Commit Mismatch Warnings

If a walkthrough specifies a `repository.commit`, the extension will warn you if your current commit doesn't match. This helps ensure you're viewing the walkthrough with the correct codebase state. You can choose to checkout the specified commit or continue anyway.

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
```

Convert it with:

1. Open or create a markdown file
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. Select output location
4. The JSON file will be created

**Example:** See [docs/developer-guide.md](docs/developer-guide.md) for a complete walkthrough in Markdown.

For detailed markdown format docs, see the [Markdown Format section](docs/SCHEMA.md#markdown-format). Use a leading `/` in link URLs so they resolve from the repo root.

### Advanced: JSON Walkthroughs

If you prefer to author JSON directly, create a file ending in `.walkthrough.json` in your workspace root.

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
- Steps with only `location` show in blue (unchanged behavior)
- Steps with only `base_location` show in red (base file view)

**Markdown format:**

```markdown
## JWT validation changes

[View code (15-45)](/src/auth/jwt.ts)
[Base (15-40)](/src/auth/jwt.ts)

Key changes to the JWT validation logic.
```

### Complete Example

See [docs/SCHEMA.md](docs/SCHEMA.md) for the complete schema documentation with detailed examples.

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
- Steps from `##` headings
- Location links: `[text (10-20)](/file.ts)` immediately after step title
- Repository info automatically inferred from git if not in frontmatter

**Converting to JSON:**

1. Open or create a markdown file
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. Select output location
4. The JSON file will be created

**Example:** See [docs/developer-guide.md](docs/developer-guide.md) for a complete example.

For detailed documentation on the markdown format, see the [Markdown Format section](docs/SCHEMA.md#markdown-format) in the schema documentation. Use a leading `/` in link URLs so they resolve from the repo root.

## Walkthrough Format

For complete documentation of the walkthrough JSON format, including all fields, examples, and TypeScript interfaces, see [docs/SCHEMA.md](docs/SCHEMA.md).

## Contributing

Interested in contributing to Virgil? See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for development setup, architecture overview, and contributing guidelines.

## License

MIT
