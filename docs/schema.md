# Walkthrough JSON Schema

This document defines the schema for walkthrough JSON files used by the Virgil extension.

## File Naming and Locations

Virgil discovers walkthrough files in two locations:

1. **Root location**: `.walkthrough.json` at the workspace root
   - Example: `.walkthrough.json`
   - This is the traditional location for a single walkthrough

2. **Walkthroughs directory**: Any `.json` file in the `walkthroughs/` directory at the workspace root
   - Examples: `walkthroughs/architecture.json`, `walkthroughs/pr-123.json`, `walkthroughs/onboarding.json`
   - This allows organizing multiple walkthroughs in a dedicated directory

**Note**: Files in the `walkthroughs/` directory do not need the `.walkthrough.json` suffix - any `.json` file is recognized. The extension automatically watches both locations for changes.

## Schema

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "repository": {
    "remote": "Git remote URL (optional)",
    "commit": "Git commit SHA (optional)"
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

| Field         | Type   | Required | Description                     |
| ------------- | ------ | -------- | ------------------------------- |
| `title`       | string | Yes      | Walkthrough name                |
| `description` | string | No       | Brief summary                   |
| `repository`  | object | No       | Git repository info (see below) |
| `metadata`    | object | No       | Freeform key-value pairs        |
| `steps`       | array  | Yes      | List of steps                   |

### Repository

| Field        | Type   | Required | Description                                          |
| ------------ | ------ | -------- | ---------------------------------------------------- |
| `remote`     | string | No       | Git remote URL (e.g., `https://github.com/org/repo`) |
| `commit`     | string | No       | Git commit SHA for the head/current state            |
| `baseCommit` | string | No       | Base commit SHA for diff mode                        |
| `baseBranch` | string | No       | Base branch name for diff mode (e.g., "main")        |
| `pr`         | number | No       | PR number - uses PR's base branch for diff mode      |

When `repository.remote` is specified, the extension will only show the walkthrough if the current workspace's Git remote matches. This allows walkthrough files to be portable (e.g., stored in a shared location) while only appearing for the relevant repository.

URL matching is normalized to handle variations:

- SSH vs HTTPS (`git@github.com:org/repo` ↔ `https://github.com/org/repo`)
- With or without `.git` suffix
- Case-insensitive comparison

When `repository.commit` is specified, the extension will warn users if their current commit doesn't match, helping ensure they're viewing the walkthrough with the correct codebase state.

#### Diff Mode Base References

For diff walkthroughs (comparing changes between two commits), specify ONE of:

- `baseCommit`: Explicit commit SHA to compare against
- `baseBranch`: Branch name (resolved at runtime to its current commit)
- `pr`: PR number (uses the PR's base branch)

**Priority order**: If multiple are specified, `baseCommit` takes precedence over `baseBranch`, which takes precedence over `pr`. A warning will be shown if multiple are specified.

### Step

| Field           | Type   | Required | Description                                                         |
| --------------- | ------ | -------- | ------------------------------------------------------------------- |
| `id`            | number | Yes      | Step identifier (typically sequential: 1, 2, 3, ...)                |
| `title`         | string | Yes      | Step name                                                           |
| `body`          | string | No       | Explanation text (supports Markdown)                                |
| `location`      | string | No       | File location for head/current file (see format below)              |
| `base_location` | string | No       | File location for base file (requires base reference in repository) |
| `parentId`      | number | No       | Parent step's id for hierarchical display (see below)               |
| `comments`      | array  | No       | User comments on this step (see Comment below)                      |

#### Hierarchical Steps

Steps can be organized hierarchically using the `parentId` field. When a step has a `parentId`, it appears as a child of the referenced step in the sidebar tree view.

- Steps without `parentId` appear at the top level
- Steps with `parentId` appear indented under their parent
- Parent steps are automatically expanded to show children
- Navigation (prev/next) traverses all steps in **depth-first order**

**Example tree structure:**

```
1. Introduction
2. Architecture
   3. Component A
   4. Component B
      5. Sub-component
6. Conclusion
```

In JSON:

```json
{
  "steps": [
    { "id": 1, "title": "Introduction" },
    { "id": 2, "title": "Architecture" },
    { "id": 3, "title": "Component A", "parentId": 2 },
    { "id": 4, "title": "Component B", "parentId": 2 },
    { "id": 5, "title": "Sub-component", "parentId": 4 },
    { "id": 6, "title": "Conclusion" }
  ]
}
```

Navigation order: 1 → 2 → 3 → 4 → 5 → 6 (depth-first)

#### Step Display Modes

| `location` | `base_location` | Mode          | Display                                                                                           |
| ---------- | --------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Yes        | No              | Point-in-time | Standard highlight (configurable, default: blue)                                                  |
| No         | Yes             | Base-only     | Diff base highlight (configurable, default: red)                                                  |
| Yes        | Yes             | Diff mode     | 3-way toggle: diff view / head (configurable, default: green) / base (configurable, default: red) |
| No         | No              | Informational | No code view (overview/summary steps)                                                             |

The `body` field supports **Markdown formatting**, including:

- Headers (`#`, `##`, `###`)
- Bold (`**text**`) and italic (`*text*`)
- Code blocks with syntax highlighting (use language identifier: ` ```typescript`)
- Inline code (`` `code` ``)
- Lists (ordered and unordered)
- Links (`[text](url)`)
- Blockquotes (`> text`)

### Step Links

You can link to other steps using standard markdown anchor syntax:

**Format:** `[link text](#step-title-as-anchor)`

**Examples:**

- `[see the overview](#welcome-to-virgil-development)` - links to step "Welcome to Virgil Development"
- `[architecture section](#extension-architecture)` - links to step "Extension Architecture"

**Anchor generation rules** (matches GitHub/CommonMark):

- Convert title to lowercase
- Replace spaces with hyphens
- Remove special characters except hyphens
- Example: `## JWT Validation` → `#jwt-validation`
- Example: `## 2. Authentication Flow` → `#2-authentication-flow`

**Behavior:**

- In raw markdown files (GitHub, VS Code preview): Links work as native section anchors
- In the Virgil extension: Links navigate to the matching step

**Notes:**

- If a step title matches multiple steps, the first match is used
- Invalid anchors are rendered with strikethrough styling

### Comment

| Field    | Type   | Required | Description                                          |
| -------- | ------ | -------- | ---------------------------------------------------- |
| `id`     | string | Yes      | Unique identifier (auto-generated when added via UI) |
| `author` | string | Yes      | Comment author (from git config `user.name`)         |
| `body`   | string | Yes      | Comment text (supports Markdown)                     |

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

````json
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
````

## Diff Walkthrough Example

For PR reviews or comparing changes, use `base_location` with a base reference:

```json
{
  "title": "PR Walkthrough: Authentication Refactor",
  "repository": {
    "remote": "git@github.com:org/repo.git",
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
      "title": "New helper function",
      "body": "This function was added (not in base):",
      "location": "src/auth/helpers.ts:1-20"
    },
    {
      "id": 4,
      "title": "Removed legacy code",
      "body": "This code was removed from main:",
      "base_location": "src/auth/legacy.ts:1-50"
    }
  ]
}
```

## Notes

- Steps with `location` open files and highlight code automatically
- Steps with `base_location` require a base reference (`baseCommit`, `baseBranch`, or `pr`) in repository
- Steps with both `location` and `base_location` show a 3-way toggle (Diff/Head/Base)
- Steps without any location are informational (overview, summary, etc.)
- Use `metadata` for any custom fields (PR numbers, recommendations, tags, etc.)
- The `body` field supports Markdown for rich formatting
- Comments are persisted to the JSON file when added through the extension UI
- Multiple walkthrough files can coexist in a workspace (in `walkthroughs/` directory or as `.walkthrough.json` at root)
- You can select walkthroughs via the "Select Walkthrough" command, which also allows selecting Markdown files for conversion

## Markdown Format

You can write walkthroughs in Markdown format and convert them to JSON using the `virgil.convertMarkdown` command. This makes it easier to write and maintain walkthroughs, especially for longer documents.

### Structure

```markdown
# Walkthrough Title

---

metadata_key: metadata_value
remote: git@github.com:org/repo.git
commit: abc123...
baseBranch: main

---

Description text (optional, everything between frontmatter and first ## heading)

## First Step Title

[View code (10-20)](/src/file.ts)

Step body text here.

## Second Step Title (Diff Mode)

[View code (10-20)](/src/file.ts)
[Base (10-15)](/src/file.ts)

Step body text showing changes.

## Third Step Title

[Multiple ranges (10-20,33-45)](/src/file.ts)

Step body text.
```

### Components

1. **Title**: First `#` heading becomes the walkthrough title
2. **Frontmatter**: YAML between `---` delimiters contains:
   - `metadata` fields (any key-value pairs)
   - `remote`: Git remote URL (optional)
   - `commit`: Git commit SHA for head state (optional)
   - `baseBranch`: Base branch for diff mode (optional)
   - `baseCommit`: Base commit SHA for diff mode (optional)
   - `pr`: PR number for diff mode (optional)
3. **Description**: Text between frontmatter and first `##` heading
4. **Steps**: Each `##` through `######` heading starts a new step

### Header Hierarchy (Sub-steps)

Use different header levels to create hierarchical step structures:

| Header   | Level | Relationship                 |
| -------- | ----- | ---------------------------- |
| `##`     | 2     | Top-level step               |
| `###`    | 3     | Child of most recent `##`    |
| `####`   | 4     | Child of most recent `###`   |
| `#####`  | 5     | Child of most recent `####`  |
| `######` | 6     | Child of most recent `#####` |

**Example:**

```markdown
## Architecture Overview

Introduction to the system.

### Frontend Components

How the frontend is organized.

#### React Components

Component structure details.

### Backend Services

Server-side architecture.

## Conclusion

Summary of the architecture.
```

This produces:

```
1. Architecture Overview
   2. Frontend Components
      3. React Components
   4. Backend Services
5. Conclusion
```

Each step gets a sequential `id` (1, 2, 3...) and child steps have `parentId` referencing their parent.

### Location Links

Location links specify which code to highlight for a step. They must appear **immediately after the step title** (on the line following `## Step Title`).

**Format**: `[link text (10-20)](/file.ts)`

- **File path** in the URL (prefix with `/` to resolve from repo root)
- **Line numbers** in parentheses in the link text:
  - `(10-20)` - Single range
  - `(10-20,33-45)` - Multiple ranges
  - `(10)` or `(10-10)` - Single line

**Examples:**

- `[View code (10-20)](/src/auth.ts)` → `location: "src/auth.ts:10-20"`
- `[Multiple ranges (10-20,33-45)](/src/file.ts)` → `location: "src/file.ts:10-20,33-45"`

### Base Location Links (Diff Mode)

For diff walkthroughs, add a second link starting with "Base" to specify the base file location:

**Format**: `[Base (10-15)](/file.ts)`

**Example step with both locations:**

```markdown
## JWT validation changes

[View code (15-45)](/src/auth/jwt.ts)
[Base (15-40)](/src/auth/jwt.ts)

This shows the changes to the JWT validation logic.
```

This creates a step with both `location` and `base_location`, enabling the 3-way toggle (Diff/Head/Base) in the viewer.

**Notes:**

- Location links are **optional** - steps without them are informational
- You can have one regular location link and one base location link per step
- Base location links require a base reference (`baseBranch`, `baseCommit`, or `pr`) in frontmatter
- If location links appear elsewhere in the step body, they will be ignored

### Converting to JSON

Use the `virgil.convertMarkdown` command:

1. Open a Markdown file (or have it active in the editor)
2. Run the command: `Virgil: Convert Markdown to Walkthrough`
3. The JSON file will be automatically created in the `walkthroughs/` directory with the same basename as the Markdown file
4. Repository info is inferred from Git if not specified in frontmatter

**Output location**: Converted JSON files are always saved to `walkthroughs/<basename>.json`. The `walkthroughs/` directory will be created automatically if it doesn't exist.

**Repository info**: If not specified in frontmatter, the converter will automatically infer:

- `remote` from `git remote get-url origin`
- `commit` from `git rev-parse HEAD`

### Example

See `docs/developer-guide.md` for a complete example of a walkthrough written in Markdown format.

## TypeScript Interface

For reference, here are the TypeScript interfaces used by the extension:

```typescript
interface Repository {
  remote?: string; // Git remote URL
  commit?: string; // Head commit SHA

  // Diff mode base references (pick ONE)
  baseCommit?: string; // Explicit base commit SHA
  baseBranch?: string; // Base branch name (resolved at runtime)
  pr?: number; // PR number (uses PR's base branch)
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
  location?: string; // Head/current file location
  base_location?: string; // Base file location (requires base reference)
  parentId?: number; // Parent step's id for hierarchical display
  comments?: Comment[];
}
```
