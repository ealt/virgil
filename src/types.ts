export interface WalkthroughStep {
  id: number;
  title: string;
  body?: string;
  location?: string; // format: "path:start-end,start-end"
}

export interface Walkthrough {
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  steps: WalkthroughStep[];
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
      const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
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
