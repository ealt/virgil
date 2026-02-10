#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

const repoRoot = path.join(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  fail('package.json not found');
}

const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

if (!manifest.name || !manifest.publisher || !manifest.version) {
  fail('package.json is missing name, publisher, or version');
}

if (!manifest.main) {
  fail('package.json is missing main');
}

const mainPath = path.join(repoRoot, manifest.main);
if (!fs.existsSync(mainPath)) {
  fail(`Extension entrypoint not found at ${manifest.main}. Run npm run compile first.`);
}

console.log('Smoke test passed');
