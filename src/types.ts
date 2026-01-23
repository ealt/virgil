export interface Comment {
  id: string;
  author: string;
  body: string;
}

export interface WalkthroughStep {
  id: number;
  title: string;
  body?: string;
  location?: string; // format: "path:start-end,start-end" for head/current file
  base_location?: string; // format: "path:start-end,start-end" for base file (requires base ref)
  comments?: Comment[];
}

export interface Repository {
  remote?: string; // git remote URL
  commit?: string; // git commit SHA (head state)

  // Optional base reference for diff mode (pick ONE, or omit for point-in-time mode)
  baseCommit?: string; // Explicit commit SHA
  baseBranch?: string; // Branch name (e.g., "main") - resolved at runtime
  pr?: number; // PR number - base is PR's base branch
}

export interface Walkthrough {
  title: string;
  description?: string;
  repository?: Repository;
  metadata?: Record<string, unknown>;
  steps: WalkthroughStep[];
}

// Normalize a git remote URL for comparison
// Handles: SSH vs HTTPS, .git suffix, trailing slashes
export function normalizeRemoteUrl(url: string): string {
  let normalized = url.trim().toLowerCase();

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Remove .git suffix
  normalized = normalized.replace(/\.git$/, '');

  // Convert SSH format to HTTPS-like for comparison
  // git@github.com:org/repo -> github.com/org/repo
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    normalized = `${sshMatch[1]}/${sshMatch[2]}`;
  }

  // Remove protocol prefix for comparison
  // https://github.com/org/repo -> github.com/org/repo
  normalized = normalized.replace(/^(https?:\/\/|git:\/\/)/, '');

  // Remove authentication info if present
  // user@github.com/org/repo -> github.com/org/repo
  normalized = normalized.replace(/^[^@]+@/, '');

  return normalized;
}

// Parsed location for internal use
export interface ParsedLocation {
  path: string;
  ranges: { startLine: number; endLine: number }[];
}

// Utility to parse location string
export function parseLocation(location: string): ParsedLocation | null {
  // Format: "path:start-end,start-end" or "path:line"
  const colonIndex = location.lastIndexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const path = location.substring(0, colonIndex);
  const rangesStr = location.substring(colonIndex + 1);

  const ranges: { startLine: number; endLine: number }[] = [];

  for (const rangeStr of rangesStr.split(',')) {
    const trimmed = rangeStr.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        ranges.push({ startLine: start, endLine: end });
      }
    } else {
      const line = parseInt(trimmed, 10);
      if (!isNaN(line)) {
        ranges.push({ startLine: line, endLine: line });
      }
    }
  }

  if (ranges.length === 0) {
    return null;
  }

  return { path, ranges };
}

// View mode for diff steps
export type ViewMode = 'diff' | 'head' | 'base';

// Step type based on location fields
export type StepType = 'point-in-time' | 'base-only' | 'diff' | 'informational';

// Determine the step type based on location fields
export function getStepType(step: WalkthroughStep): StepType {
  const hasLocation = !!step.location;
  const hasBaseLocation = !!step.base_location;

  if (hasLocation && hasBaseLocation) {
    return 'diff';
  } else if (hasLocation) {
    return 'point-in-time';
  } else if (hasBaseLocation) {
    return 'base-only';
  }
  return 'informational';
}
