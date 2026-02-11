import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HighlightColor } from './HighlightManager';
import { DiffContentProvider } from './DiffContentProvider';

/**
 * Highlight styles for markdown preview (matching HighlightManager colors)
 */
const HIGHLIGHT_STYLES: Record<HighlightColor, string> = {
  standard:
    'background-color: rgba(86, 156, 214, 0.15); border-left: 3px solid rgba(86, 156, 214, 0.6); padding: 4px 8px; margin: 0 -8px;',
  diffHead:
    'background-color: rgba(72, 180, 97, 0.2); border-left: 3px solid rgba(72, 180, 97, 0.8); padding: 4px 8px; margin: 0 -8px;',
  diffBase:
    'background-color: rgba(220, 80, 80, 0.2); border-left: 3px solid rgba(220, 80, 80, 0.8); padding: 4px 8px; margin: 0 -8px;',
};

interface ParsedMarkdownUri {
  filePath: string;
  ranges: { startLine: number; endLine: number }[];
  color: HighlightColor;
  commit?: string;
}

/**
 * Provides markdown content with HTML highlighting injected for VS Code's markdown preview.
 * URI scheme: virgil-md-preview
 * URI format: virgil-md-preview:///<file-path>?ranges=10-45,100-120&color=blue&commit=abc123
 */
export class MarkdownHighlightProvider implements vscode.TextDocumentContentProvider {
  private workspaceRoot: string;
  private diffContentProvider: DiffContentProvider;
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this._onDidChange.event;

  constructor(workspaceRoot: string, diffContentProvider: DiffContentProvider) {
    this.workspaceRoot = workspaceRoot;
    this.diffContentProvider = diffContentProvider;
  }

  /**
   * Creates a URI for a markdown file with highlighting.
   * stepIndex is included in the path so each step gets a distinct URI; the built-in
   * markdown preview reuses the tab when the path is the same, so without this only
   * the first step's highlighting would appear when navigating between steps.
   */
  public static createUri(
    filePath: string,
    ranges: { startLine: number; endLine: number }[],
    color: HighlightColor,
    commit?: string,
    stepIndex?: number
  ): vscode.Uri {
    // Normalize path to remove leading slashes
    const normalizedPath = filePath.replace(/^\/+/, '');
    // Use step-specific path so preview does not reuse the same tab for different steps
    const pathWithStep =
      stepIndex !== undefined ? `step-${stepIndex}/${normalizedPath}` : normalizedPath;

    // Build query string
    const rangesStr = ranges.map((r) => `${r.startLine}-${r.endLine}`).join(',');
    let query = `ranges=${encodeURIComponent(rangesStr)}&color=${color}`;
    if (commit) {
      query += `&commit=${encodeURIComponent(commit)}`;
    }

    return vscode.Uri.parse(`virgil-md-preview:///${pathWithStep}?${query}`);
  }

  /**
   * Parses a virgil-md-preview URI to extract file path, ranges, color, and optional commit
   */
  public static parseUri(uri: vscode.Uri): ParsedMarkdownUri | null {
    if (uri.scheme !== 'virgil-md-preview') {
      return null;
    }

    // Extract file path from URI path (strip optional step-N/ prefix used for tab identity)
    const rawPath = uri.path.replace(/^\/+/, '');
    const stepPrefixMatch = rawPath.match(/^step-\d+\/(.*)$/);
    const filePath = stepPrefixMatch ? stepPrefixMatch[1] : rawPath;

    // Parse query parameters
    const query = new URLSearchParams(uri.query);

    // Parse ranges
    const rangesStr = query.get('ranges');
    if (!rangesStr) {
      return null;
    }

    const ranges: { startLine: number; endLine: number }[] = [];
    for (const rangeStr of rangesStr.split(',')) {
      const trimmed = rangeStr.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          ranges.push({ startLine: start, endLine: end });
        }
      }
    }

    if (ranges.length === 0) {
      return null;
    }

    // Parse color
    const colorStr = query.get('color');
    const color: HighlightColor =
      colorStr === 'standard' || colorStr === 'diffHead' || colorStr === 'diffBase'
        ? colorStr
        : 'standard';

    // Parse optional commit
    const commit = query.get('commit') || undefined;

    return { filePath, ranges, color, commit };
  }

  /**
   * Provides the markdown content with HTML highlighting injected
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    const parsed = MarkdownHighlightProvider.parseUri(uri);
    if (!parsed) {
      throw new Error(`Invalid virgil-md-preview URI: ${uri.toString()}`);
    }

    const { filePath, ranges, color, commit } = parsed;

    // Get the original content
    let content: string;
    if (commit) {
      // Get content from git commit
      const gitContent = this.diffContentProvider.getFileContent(commit, filePath);
      if (gitContent === null) {
        throw new Error(`File "${filePath}" does not exist at commit ${commit.substring(0, 7)}`);
      }
      content = gitContent;
    } else {
      // Get content from workspace
      const fullPath = path.join(this.workspaceRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File "${filePath}" does not exist in workspace`);
      }
      content = fs.readFileSync(fullPath, 'utf-8');
    }

    // Inject highlighting
    return this.injectHighlighting(content, ranges, color);
  }

  /**
   * Injects HTML div tags around specified line ranges for highlighting
   */
  private injectHighlighting(
    content: string,
    ranges: { startLine: number; endLine: number }[],
    color: HighlightColor
  ): string {
    const lines = content.split('\n');
    const style = HIGHLIGHT_STYLES[color];

    // Merge overlapping ranges and sort by startLine descending
    // (inject from bottom up to preserve line numbers)
    const mergedRanges = this.mergeAndSortRanges(ranges);

    // Inject highlighting from bottom to top
    for (const range of mergedRanges) {
      const startIdx = Math.max(0, range.startLine - 1); // Convert to 0-indexed
      const endIdx = Math.min(lines.length - 1, range.endLine - 1);

      // Insert closing tag after endLine (with blank line before it for markdown parsing)
      if (endIdx + 1 <= lines.length) {
        lines.splice(endIdx + 1, 0, '', '</div>');
      } else {
        lines.push('', '</div>');
      }

      // Insert opening tag before startLine (with blank line after it for markdown parsing)
      lines.splice(startIdx, 0, `<div style="${style}">`, '');
    }

    return lines.join('\n');
  }

  /**
   * Merges overlapping ranges and sorts them by startLine descending
   */
  private mergeAndSortRanges(
    ranges: { startLine: number; endLine: number }[]
  ): { startLine: number; endLine: number }[] {
    if (ranges.length === 0) {
      return [];
    }

    // Sort by startLine ascending first for merging
    const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);

    const merged: { startLine: number; endLine: number }[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      // Check if ranges overlap or are adjacent
      if (next.startLine <= current.endLine + 1) {
        // Merge: extend current range
        current.endLine = Math.max(current.endLine, next.endLine);
      } else {
        // No overlap: push current and start new
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    // Sort by startLine descending for bottom-up injection
    return merged.sort((a, b) => b.startLine - a.startLine);
  }

  public dispose(): void {
    this._onDidChange.dispose();
  }
}
