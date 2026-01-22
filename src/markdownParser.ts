import * as fs from 'fs';
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';
import { Walkthrough, WalkthroughStep, Repository, parseLocation } from './types';

export interface ParseResult {
  walkthrough: Walkthrough;
  warnings: string[];
}

/**
 * Infers repository information from git state
 */
export function inferRepositoryInfo(workspaceRoot?: string): Repository | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  let remote: string | undefined;
  let commit: string | undefined;

  try {
    remote = execSync('git remote get-url origin', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (!remote) {
      remote = undefined;
    }
  } catch {
    // Not a git repo or no origin remote
  }

  try {
    commit = execSync('git rev-parse HEAD', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (!commit) {
      commit = undefined;
    }
  } catch {
    // Not a git repo
  }

  if (!remote && !commit) {
    return undefined;
  }

  return { remote, commit };
}

/**
 * Parses a location link from markdown link format
 * Format: [text (10-20)](file.ts) or [text (10-20,33-45)](file.ts)
 * Returns the location string in format: file.ts:10-20,33-45
 */
function parseLocationLink(linkText: string, linkUrl: string): string | null {
  // Extract line numbers from link text: "text (10-20,33-45)" -> "10-20,33-45"
  const match = linkText.match(/\(([^)]+)\)/);
  if (!match) {
    return null;
  }

  const lineNumbersStr = match[1].trim();
  if (!lineNumbersStr) {
    return null;
  }

  // Parse ranges: "10-20,33-45" or "10" or "10-10"
  const ranges: string[] = [];
  for (const rangeStr of lineNumbersStr.split(',')) {
    const trimmed = rangeStr.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(s => s.trim());
      if (start && end && !isNaN(parseInt(start, 10)) && !isNaN(parseInt(end, 10))) {
        ranges.push(`${start}-${end}`);
      } else {
        return null; // Invalid range format
      }
    } else {
      // Single line: "10" -> "10-10"
      const line = trimmed;
      if (line && !isNaN(parseInt(line, 10))) {
        ranges.push(`${line}-${line}`);
      } else {
        return null; // Invalid line number
      }
    }
  }

  if (ranges.length === 0) {
    return null;
  }

  // Combine: file.ts:10-20,33-45
  return `${linkUrl}:${ranges.join(',')}`;
}

/**
 * Extracts location from a markdown link if it matches the location format
 */
interface LocationLinkResult {
  location: string;
  isBase: boolean;
}

/**
 * Extracts location from a markdown link if it matches the location format
 * Returns both the location string and whether it's a base location
 */
function extractLocationFromLink(line: string): LocationLinkResult | null {
  // Match markdown link: [text](url)
  const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!linkMatch) {
    return null;
  }

  const linkText = linkMatch[1];
  const linkUrl = linkMatch[2];

  // Check if link text contains line numbers in parentheses
  if (!linkText.includes('(') || !linkText.includes(')')) {
    return null;
  }

  // Check if this is a base location link (starts with "Base" case-insensitive)
  const isBase = /^base\s*\(/i.test(linkText.trim());

  // Parse the location
  const location = parseLocationLink(linkText, linkUrl);
  if (!location) {
    return null;
  }

  return { location, isBase };
}

/**
 * Parses a markdown walkthrough into a Walkthrough object
 */
export function parseMarkdownWalkthrough(
  markdown: string,
  workspaceRoot?: string
): ParseResult {
  const warnings: string[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  // Extract title from first # heading
  let title = '';
  while (i < lines.length && !title) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    }
    i++;
  }

  if (!title) {
    title = 'Untitled Walkthrough';
    warnings.push('No title found (first # heading), using "Untitled Walkthrough"');
  }

  // Parse YAML frontmatter (allow after title with blank lines)
  let metadata: Record<string, unknown> | undefined;
  let repositoryFromFrontmatter: Repository | undefined;
  let frontmatterEnd = i;

  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }

  if (i < lines.length && lines[i].trim() === '---') {
    i++; // Skip opening ---
    const frontmatterLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      frontmatterLines.push(lines[i]);
      i++;
    }
    if (i < lines.length && lines[i].trim() === '---') {
      frontmatterEnd = i + 1;
      i++; // Skip closing ---
      try {
        const frontmatterText = frontmatterLines.join('\n');
        if (frontmatterText.trim()) {
          const frontmatterData = yaml.load(frontmatterText) as Record<string, unknown>;

          // Extract repository fields if present
          if (frontmatterData.remote || frontmatterData.commit ||
              frontmatterData.baseBranch || frontmatterData.baseCommit || frontmatterData.pr) {
            repositoryFromFrontmatter = {
              remote: typeof frontmatterData.remote === 'string' ? frontmatterData.remote : undefined,
              commit: typeof frontmatterData.commit === 'string' ? frontmatterData.commit : undefined,
              baseBranch: typeof frontmatterData.baseBranch === 'string' ? frontmatterData.baseBranch : undefined,
              baseCommit: typeof frontmatterData.baseCommit === 'string' ? frontmatterData.baseCommit : undefined,
              pr: typeof frontmatterData.pr === 'number' ? frontmatterData.pr : undefined
            };
          }

          // Remove repository fields from metadata
          const { remote, commit, baseBranch, baseCommit, pr, ...rest } = frontmatterData;
          if (Object.keys(rest).length > 0) {
            metadata = rest;
          }
        }
      } catch (error) {
        warnings.push(`Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push('YAML frontmatter not properly closed (missing closing ---)');
    }
  }

  // Skip empty lines after frontmatter
  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }

  // Extract description (everything until first ## heading)
  const descriptionLines: string[] = [];
  while (i < lines.length && !lines[i].trim().startsWith('## ')) {
    descriptionLines.push(lines[i]);
    i++;
  }

  const description = descriptionLines.join('\n').trim() || undefined;

  // Extract steps
  const steps: WalkthroughStep[] = [];
  let stepId = 1;

  while (i < lines.length) {
    // Find next ## heading
    if (!lines[i].trim().startsWith('## ')) {
      i++;
      continue;
    }

    const stepTitle = lines[i].trim().substring(3).trim(); // Remove "## "
    i++; // Move past heading

    // Skip empty lines after heading
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }

    // Check for location links immediately after heading
    // Can have up to 2 links: one for head location, one for base location
    let location: string | null = null;
    let base_location: string | null = null;

    // Process up to 2 location links (in any order)
    for (let linkCount = 0; linkCount < 2 && i < lines.length; linkCount++) {
      const currentLine = lines[i].trim();
      if (!currentLine) {
        break; // Empty line ends location link section
      }

      const locationLink = extractLocationFromLink(currentLine);
      if (locationLink) {
        // Validate the location format
        if (parseLocation(locationLink.location)) {
          if (locationLink.isBase) {
            if (base_location) {
              warnings.push(`Multiple base location links in step "${stepTitle}". Using first one.`);
            } else {
              base_location = locationLink.location;
            }
          } else {
            if (location) {
              warnings.push(`Multiple location links in step "${stepTitle}". Using first one.`);
            } else {
              location = locationLink.location;
            }
          }
          i++; // Skip location link line
        } else {
          warnings.push(`Invalid location format in step "${stepTitle}": ${locationLink.location}`);
          break;
        }
      } else {
        break; // Not a location link, end of location section
      }

      // Skip empty lines between location links
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
    }

    // Skip any remaining empty lines after location links
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }

    // Extract step body (everything until next ## heading or end)
    const bodyLines: string[] = [];
    while (i < lines.length && !lines[i].trim().startsWith('## ')) {
      bodyLines.push(lines[i]);
      i++;
    }

    const body = bodyLines.join('\n').trim() || undefined;

    // Check for location links in body (should warn)
    if (body) {
      const bodyLinkMatch = body.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (bodyLinkMatch) {
        for (const link of bodyLinkMatch) {
          const extracted = extractLocationFromLink(link);
          if (extracted) {
            const linkType = extracted.isBase ? 'Base location' : 'Location';
            warnings.push(`${linkType} link found in step body for "${stepTitle}": ${link}. Only location links immediately after the step title are used.`);
          }
        }
      }
    }

    steps.push({
      id: stepId++,
      title: stepTitle,
      body,
      location: location || undefined,
      base_location: base_location || undefined
    });
  }

  if (steps.length === 0) {
    warnings.push('No steps found (no ## headings)');
  }

  // Get repository info (from frontmatter or infer from git)
  const repository = repositoryFromFrontmatter || inferRepositoryInfo(workspaceRoot);

  const walkthrough: Walkthrough = {
    title,
    description,
    repository,
    metadata,
    steps
  };

  return {
    walkthrough,
    warnings
  };
}
