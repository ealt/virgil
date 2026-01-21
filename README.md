# Virgil

Interactive guided walkthroughs for code review and codebase exploration. Named after Dante's guide through the Divine Comedy.

## Features

- **PR Reviews**: Walk through pull request changes with context and explanations
- **Codebase Tours**: Generate guided tours for onboarding or documentation
- **Code Highlighting**: Automatically highlights relevant code sections
- **Step Navigation**: Navigate through steps via sidebar, keyboard shortcuts, or detail panel

## Installation

### From Source

```bash
cd ~/Documents/virgil
npm install
npm run compile
```

Then package and install:

```bash
npx vsce package --allow-missing-repository

# VS Code
code --install-extension virgil-0.1.0.vsix

# Cursor
cursor --install-extension virgil-0.1.0.vsix
```

### Development

```bash
npm run watch  # Compile on file changes
```

## Usage

### 1. Generate a Walkthrough

Use the Claude Code `/walkthrough` skill:

```bash
# For a PR review
/walkthrough 123

# For a general codebase tour
/walkthrough tour

# For a focused tour (e.g., authentication system)
/walkthrough auth
```

This creates a `*.walkthrough.json` file in your repository root (e.g., `pr-123.walkthrough.json` or `architecture.walkthrough.json`).

### 2. Navigate the Walkthrough

1. Open the repository in VS Code/Cursor
2. The Virgil sidebar appears automatically when any `*.walkthrough.json` file is detected
3. Click on steps in the sidebar to navigate
4. Use the detail panel for descriptions and notes
5. Code sections are highlighted automatically

### Keyboard Shortcuts

| Command | Mac | Windows/Linux |
|---------|-----|---------------|
| Next Step | `Cmd+Shift+]` | `Ctrl+Shift+]` |
| Previous Step | `Cmd+Shift+[` | `Ctrl+Shift+[` |

### Commands

- `Virgil: Start Walkthrough` - Jump to the first step
- `Virgil: Next Step` - Go to next step
- `Virgil: Previous Step` - Go to previous step
- `Virgil: Refresh Walkthrough` - Reload the JSON file

## Walkthrough JSON Schema

```json
{
  "title": "Authentication System Overview",
  "description": "A walkthrough of how auth works",
  "author": "username",
  "created": "2025-01-21T12:00:00Z",
  "context": {
    "type": "pr-review",
    "pr": {
      "number": 123,
      "url": "https://github.com/org/repo/pull/123"
    }
  },
  "overview": {
    "purpose": "What this walkthrough covers",
    "scope": "Areas/files involved"
  },
  "steps": [
    {
      "id": 1,
      "title": "Entry point - Login handler",
      "description": "Detailed explanation...",
      "locations": [
        {
          "path": "src/auth/login.ts",
          "startLine": 10,
          "endLine": 45
        }
      ],
      "notes": ["Important observation"]
    }
  ],
  "summary": {
    "keyTakeaways": ["Main point 1", "Main point 2"],
    "recommendation": "approve"
  }
}
```

### Context Types

- `pr-review` - Pull request review with recommendation
- `tour` - General codebase exploration
- `tutorial` - Focused learning path

### Recommendations (for PR reviews)

- `approve` - Changes look good
- `request-changes` - Changes needed before merge
- `comment` - General feedback, no blocking issues
- `none` - No recommendation

## Project Structure

```
virgil/
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
├── src/
│   ├── extension.ts      # Entry point, activation
│   ├── types.ts          # TypeScript interfaces
│   ├── WalkthroughProvider.ts  # Sidebar tree view
│   ├── StepDetailPanel.ts      # Step detail webview
│   └── HighlightManager.ts     # Code highlighting
├── media/
│   └── panel.css         # Webview styles
└── out/                  # Compiled JavaScript
```

## License

MIT
