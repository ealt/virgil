#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const hookSource = path.join(repoRoot, '.githooks', 'pre-commit');
const gitEntryPath = path.join(repoRoot, '.git');

function resolveHooksDir() {
  if (!fs.existsSync(gitEntryPath)) {
    return null;
  }

  const gitEntryStats = fs.statSync(gitEntryPath);
  if (gitEntryStats.isDirectory()) {
    return path.join(gitEntryPath, 'hooks');
  }

  if (gitEntryStats.isFile()) {
    const gitFileContent = fs.readFileSync(gitEntryPath, 'utf-8').trim();
    const match = gitFileContent.match(/^gitdir:\s*(.+)$/i);
    if (!match) {
      return null;
    }

    const gitDir = path.resolve(repoRoot, match[1]);
    return path.join(gitDir, 'hooks');
  }

  return null;
}

const hooksDir = resolveHooksDir();

if (hooksDir && fs.existsSync(hookSource)) {
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookDest = path.join(hooksDir, 'pre-commit');
  fs.copyFileSync(hookSource, hookDest);
  fs.chmodSync(hookDest, '755');
  console.log('Git hooks installed successfully');
} else if (!hooksDir) {
  console.log('Not a git repository, skipping git hook installation');
}
