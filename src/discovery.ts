import * as fs from 'fs';
import * as path from 'path';

/** Directories to skip during recursive walkthrough discovery. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  '.next',
  '.cache',
  'build',
  'coverage',
  '.vscode',
]);

/**
 * Recursively discover walkthrough files under `rootDir`.
 *
 * Matches:
 *   - Any `.walkthrough.json` file at any depth
 *   - Any `.json` file inside a directory named `walkthroughs` at any depth
 *
 * Returns paths relative to `rootDir`, sorted alphabetically.
 */
export function discoverWalkthroughFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }

        if (entry.name === 'walkthroughs') {
          // Collect JSON files directly inside this walkthroughs directory
          const walkthroughsDir = path.join(dir, entry.name);
          try {
            const files = fs.readdirSync(walkthroughsDir);
            for (const f of files) {
              if (f.endsWith('.json')) {
                results.push(path.relative(rootDir, path.join(walkthroughsDir, f)));
              }
            }
          } catch {
            // Ignore unreadable directories
          }
        }

        // Continue recursing into all non-skipped directories (including walkthroughs/)
        walk(path.join(dir, entry.name));
      } else if (entry.name === '.walkthrough.json') {
        results.push(path.relative(rootDir, path.join(dir, entry.name)));
      }
    }
  }

  walk(rootDir);
  results.sort();
  return results;
}
