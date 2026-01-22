# Walkthrough JSON Schema

This document defines the schema for `.walkthrough.json` files used by the Virgil extension.

## File Naming

Files must end with `.walkthrough.json`. Examples:

- `architecture.walkthrough.json`
- `pr-123.walkthrough.json`
- `onboarding.walkthrough.json`

## Schema

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "repository": {
    "remote": "git remote URL (optional)",
    "commit": "git commit SHA (optional)"
  },
  "metadata": { "key": "value" },
  "steps": [
    {
      "id": 1,
      "title": "string (required)",
      "body": "string (optional)",
      "location": "path:start-end (optional)",
      "comments": [
        {
          "id": "string (required)",
          "author": "string (required)",
          "body": "string (required)"
        }
      ]
    }
  ]
}
```

## Fields

### Root

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Walkthrough name |
| `description` | string | No | Brief summary |
| `repository` | object | No | Git repository info (see below) |
| `metadata` | object | No | Freeform key-value pairs |
| `steps` | array | Yes | List of steps |

### Repository

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `remote` | string | No | Git remote URL (e.g., `https://github.com/org/repo`) |
| `commit` | string | No | Git commit SHA for the codebase state |

When `repository.remote` is specified, the extension will only show the walkthrough if the current workspace's git remote matches. This allows walkthrough files to be portable (e.g., stored in a shared location) while only appearing for the relevant repository.

URL matching is normalized to handle variations:

- SSH vs HTTPS (`git@github.com:org/repo` ↔ `https://github.com/org/repo`)
- With or without `.git` suffix
- Case-insensitive comparison

When `repository.commit` is specified, the extension will warn users if their current commit doesn't match, helping ensure they're viewing the walkthrough with the correct codebase state.

### Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Step identifier (typically sequential: 1, 2, 3, ...) |
| `title` | string | Yes | Step name |
| `body` | string | No | Explanation text (supports Markdown) |
| `location` | string | No | File location (see format below) |
| `comments` | array | No | User comments on this step (see Comment below) |

The `body` field supports **Markdown formatting**, including:

- Headers (`#`, `##`, `###`)
- Bold (`**text**`) and italic (`*text*`)
- Code blocks with syntax highlighting (use language identifier: ` ```typescript`)
- Inline code (`` `code` ``)
- Lists (ordered and unordered)
- Links (`[text](url)`)
- Blockquotes (`> text`)

### Comment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (auto-generated when added via UI) |
| `author` | string | Yes | Comment author (from git config `user.name`) |
| `body` | string | Yes | Comment text (supports Markdown) |

Comments can be added to steps through the extension's UI. The comment `body` field also supports Markdown formatting, same as step `body`.

### Location Format

```
path:startLine-endLine
```

Examples:

- `src/auth.ts:10-45` - lines 10 to 45
- `src/auth.ts:10` - single line 10
- `src/auth.ts:10-45,100-120` - multiple ranges (comma-separated)

Line numbers are **1-indexed** (first line is 1, not 0).

When a step has a `location`, the extension will:

- Open the file in the editor
- Highlight the specified line ranges
- Show the location as a clickable link in the detail panel

## Example

```json
{
  "title": "Authentication Refactor",
  "description": "Review of JWT implementation",
  "repository": {
    "remote": "https://github.com/acme/backend",
    "commit": "a1b2c3d4e5f6..."
  },
  "metadata": {
    "pr": 123,
    "recommendation": "approve",
    "author": "jane"
  },
  "steps": [
    {
      "id": 1,
      "title": "Overview",
      "body": "This PR migrates from session-based auth to JWT tokens.\n\n**Changes:**\n- Affects 12 files\n- Backward compatible\n\nSee the [full diff](https://github.com/acme/backend/pull/123) for details."
    },
    {
      "id": 2,
      "title": "JWT utility module",
      "body": "Handles token generation and validation.\n\n**Key features:**\n- Uses RS256 signing\n- Tokens expire in 15 minutes\n\n```typescript\nconst token = generateToken(payload);\n```",
      "location": "src/auth/jwt.ts:1-45",
      "comments": [
        {
          "id": "a1b2c3",
          "author": "bob",
          "body": "Should we add rate limiting here?"
        }
      ]
    },
    {
      "id": 3,
      "title": "Token validation",
      "body": "Shows both the validator and where it's called.",
      "location": "src/auth/jwt.ts:50-75,120-135"
    },
    {
      "id": 4,
      "title": "Summary",
      "body": "Implementation looks good.\n\n- ✅ Approve\n- 💡 Consider token rotation later"
    }
  ]
}
```

## Notes

- Steps with `location` open files and highlight code automatically
- Steps without `location` are informational (overview, summary, etc.)
- Use `metadata` for any custom fields (PR numbers, recommendations, tags, etc.)
- The `body` field supports Markdown for rich formatting
- Comments are persisted to the JSON file when added through the extension UI
- Multiple walkthrough files can coexist in a workspace; use `repository.remote` to scope them to specific repositories

## Markdown Format

You can write walkthroughs in Markdown format and convert them to JSON using the `virgil.convertMarkdown` command. This makes it easier to write and maintain walkthroughs, especially for longer documents.

### Structure

```markdown
# Walkthrough Title

---
metadata_key: metadata_value
remote: git@github.com:org/repo.git
commit: abc123...
---

Description text (optional, everything between frontmatter and first ## heading)

## First Step Title

[View code (10-20)](/src/file.ts)

Step body text here.

## Second Step Title

[Multiple ranges (10-20,33-45)](/src/file.ts)

Step body text.
```

### Components

1. **Title**: First `#` heading becomes the walkthrough title
2. **Frontmatter**: YAML between `---` delimiters contains:
   - `metadata` fields (any key-value pairs)
   - `remote`: Git remote URL (optional)
   - `commit`: Git commit SHA (optional)
3. **Description**: Text between frontmatter and first `##` heading
4. **Steps**: Each `##` heading starts a new step

### Location Links

Location links specify which code to highlight for a step. They must appear **immediately after the step title** (on the line following `## Step Title`).

**Format**: `[link text (10-20)](/file.ts)`

- **File path** in the URL (prefix with `/` to resolve from repo root)
- **Line numbers** in parentheses in the link text:
  - `(10-20)` - Single range
  - `(10-20,33-45)` - Multiple ranges
  - `(10)` or `(10-10)` - Single line

**Examples:**
- `[View code (10-20)](/src/auth.ts)` → `src/auth.ts:10-20`
- `[Multiple ranges (10-20,33-45)](/src/file.ts)` → `src/file.ts:10-20,33-45`

**Notes:**
- Location links are **optional** - steps without them are informational
- Only one location link per step (immediately after the title)
- If a location link appears elsewhere in the step body, it will be ignored

### Converting to JSON

Use the `virgil.convertMarkdown` command:

1. Open a markdown file (or have it active in the editor)
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. Select or confirm the output location
4. The JSON file will be created with repository info inferred from git

**Repository info**: If not specified in frontmatter, the converter will automatically infer:
- `remote` from `git remote get-url origin`
- `commit` from `git rev-parse HEAD`

### Example

See `docs/developer-guide.md` for a complete example of a walkthrough written in Markdown format.

## TypeScript Interface

For reference, here are the TypeScript interfaces used by the extension:

```typescript
interface Repository {
  remote?: string;
  commit?: string;
}

interface Comment {
  id: string;
  author: string;
  body: string;
}

interface Walkthrough {
  title: string;
  description?: string;
  repository?: Repository;
  metadata?: Record<string, unknown>;
  steps: WalkthroughStep[];
}

interface WalkthroughStep {
  id: number;
  title: string;
  body?: string;
  location?: string;
  comments?: Comment[];
}
```
