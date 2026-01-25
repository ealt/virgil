#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const hookSource = path.join(__dirname, '..', '.githooks', 'pre-commit');
const hookDest = path.join(__dirname, '..', '.git', 'hooks', 'pre-commit');

// Only set up hooks if .git directory exists (i.e., we're in a git repo)
if (fs.existsSync(path.join(__dirname, '..', '.git')) && fs.existsSync(hookSource)) {
  // Ensure .git/hooks directory exists
  const hooksDir = path.dirname(hookDest);
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // Copy the hook
  fs.copyFileSync(hookSource, hookDest);
  fs.chmodSync(hookDest, '755');
  console.log('Git hooks installed successfully');
} else if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
  console.log('Not a git repository, skipping git hook installation');
}
