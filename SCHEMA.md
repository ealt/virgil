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
| `metadata` | object | No | Freeform key-value pairs |
| `steps` | array | Yes | List of steps |

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
interface Walkthrough {
  title: string;
  description?: string;
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
