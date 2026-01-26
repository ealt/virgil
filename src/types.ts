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
  parentId?: number; // References parent step's id, undefined = top-level
}

// Tree node for hierarchical step display
export interface StepTreeNode {
  step: WalkthroughStep;
  children: StepTreeNode[];
}

// Build tree structure from flat steps with parentId
export function buildStepTree(steps: WalkthroughStep[]): StepTreeNode[] {
  // Create a map of step id to tree node
  const nodeMap = new Map<number, StepTreeNode>();
  const roots: StepTreeNode[] = [];

  // First pass: create all nodes
  for (const step of steps) {
    nodeMap.set(step.id, { step, children: [] });
  }

  // Second pass: build tree structure
  for (const step of steps) {
    const node = nodeMap.get(step.id)!;
    if (step.parentId !== undefined) {
      const parent = nodeMap.get(step.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// Flatten tree back to array in depth-first order (for navigation)
export function flattenStepTree(nodes: StepTreeNode[]): WalkthroughStep[] {
  const result: WalkthroughStep[] = [];

  function traverse(nodeList: StepTreeNode[]) {
    for (const node of nodeList) {
      result.push(node.step);
      traverse(node.children);
    }
  }

  traverse(nodes);
  return result;
}

// Navigation context for hierarchical step navigation
export interface StepNavigationContext {
  parentIndex: number | null;
  nextSiblingIndex: number | null;
  prevSiblingIndex: number | null;
}

// Build navigation map for O(1) hierarchical navigation lookup
export function buildNavigationMap(
  tree: StepTreeNode[],
  flatSteps: WalkthroughStep[]
): Map<number, StepNavigationContext> {
  const map = new Map<number, StepNavigationContext>();

  // Create a lookup from step id to flat index
  const idToIndex = new Map<number, number>();
  flatSteps.forEach((step, index) => {
    idToIndex.set(step.id, index);
  });

  function traverse(nodes: StepTreeNode[], parentIndex: number | null) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const currentIndex = idToIndex.get(node.step.id);
      if (currentIndex === undefined) continue;

      const prevSibling = i > 0 ? nodes[i - 1] : null;
      const nextSibling = i < nodes.length - 1 ? nodes[i + 1] : null;

      map.set(currentIndex, {
        parentIndex,
        prevSiblingIndex: prevSibling ? (idToIndex.get(prevSibling.step.id) ?? null) : null,
        nextSiblingIndex: nextSibling ? (idToIndex.get(nextSibling.step.id) ?? null) : null,
      });

      // Recurse into children with current node as parent
      if (node.children.length > 0) {
        traverse(node.children, currentIndex);
      }
    }
  }

  traverse(tree, null);
  return map;
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

// View mode for markdown files (single-state view)
export type MarkdownViewMode = 'raw' | 'rendered';

// Step type based on location fields
export type StepType = 'point-in-time' | 'base-only' | 'diff' | 'informational';

// Check if a file path is a markdown file
export function isMarkdownFile(filePath: string): boolean {
  return /\.(md|markdown)$/i.test(filePath);
}

// Get the appropriate icon ID for a file path based on its extension
export function getFileTypeIcon(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() || '';

  const iconMap: Record<string, string> = {
    // Markdown
    'md': 'markdown',
    'markdown': 'markdown',
    // JSON
    'json': 'json',
    'jsonc': 'json',
    'json5': 'json',
    // Python
    'py': 'python',
    'pyw': 'python',
    'pyi': 'python',
    // Ruby
    'rb': 'ruby',
    'rake': 'ruby',
    'gemspec': 'ruby',
    // Plain text
    'txt': 'file-text',
    'text': 'file-text',
    // Media/images
    'png': 'file-media',
    'jpg': 'file-media',
    'jpeg': 'file-media',
    'gif': 'file-media',
    'svg': 'file-media',
    'webp': 'file-media',
    'ico': 'file-media',
    'bmp': 'file-media',
    // PDF
    'pdf': 'file-pdf',
    // Archives
    'zip': 'file-zip',
    'tar': 'file-zip',
    'gz': 'file-zip',
    'tgz': 'file-zip',
    '7z': 'file-zip',
    'rar': 'file-zip',
    // Notebooks
    'ipynb': 'notebook',
  };

  return iconMap[ext] || 'file-code';
}

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
