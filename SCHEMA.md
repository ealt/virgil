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
      "location": "path:start-end (optional)"
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

### Step

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Step identifier |
| `title` | string | Yes | Step name |
| `body` | string | No | Explanation text |
| `location` | string | No | File location (see format below) |

### Location Format

```
path:startLine-endLine
```

Examples:
- `src/auth.ts:10-45` - lines 10 to 45
- `src/auth.ts:10` - single line 10
- `src/auth.ts:10-45,100-120` - multiple ranges

Line numbers are 1-indexed.

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
      "body": "This PR migrates from session-based auth to JWT tokens.\n\n- Affects 12 files\n- Backward compatible"
    },
    {
      "id": 2,
      "title": "JWT utility module",
      "body": "Handles token generation and validation.\n\n- Uses RS256 signing\n- Tokens expire in 15 minutes",
      "location": "src/auth/jwt.ts:1-45"
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
      "body": "Implementation looks good.\n\n- Approve\n- Consider token rotation later"
    }
  ]
}
```

## Notes

- Steps with `location` open files and highlight code
- Steps without `location` are informational (overview, summary, etc.)
- Use `metadata` for any custom fields (PR numbers, recommendations, tags, etc.)
- The `body` field supports plain text with newlines for formatting

## TypeScript Interface

```typescript
interface Repository {
  remote?: string;
  commit?: string;
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
}
```
