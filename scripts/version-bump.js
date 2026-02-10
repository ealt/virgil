#!/usr/bin/env node

/**
 * Version bump script for Virgil extension
 * 
 * Updates version in package.json and CHANGELOG.md
 * 
 * Usage:
 *   node scripts/version-bump.js <version>
 *   node scripts/version-bump.js 0.2.0
 *   node scripts/version-bump.js patch
 *   node scripts/version-bump.js minor
 *   node scripts/version-bump.js major
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

// Get version argument
const versionArg = process.argv[2];

if (!versionArg) {
  console.error('Error: Version argument required');
  console.error('Usage: node scripts/version-bump.js <version>');
  console.error('  Examples:');
  console.error('    node scripts/version-bump.js 0.2.0');
  console.error('    node scripts/version-bump.js patch');
  console.error('    node scripts/version-bump.js minor');
  console.error('    node scripts/version-bump.js major');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Calculate new version
let newVersion;
if (versionArg === 'patch' || versionArg === 'minor' || versionArg === 'major') {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (versionArg) {
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
  }
} else {
  // Validate version format (basic semver check)
  if (!/^\d+\.\d+\.\d+/.test(versionArg)) {
    console.error(`Error: Invalid version format: ${versionArg}`);
    console.error('Version must be in format: X.Y.Z (e.g., 0.2.0)');
    process.exit(1);
  }
  newVersion = versionArg;
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ Updated package.json`);

// Update CHANGELOG.md
const changelog = fs.readFileSync(changelogPath, 'utf8');
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

// Replace [Unreleased] section with new version
const unreleasedPattern = /## \[Unreleased\]/;
if (!unreleasedPattern.test(changelog)) {
  console.error('Error: Could not find [Unreleased] section in CHANGELOG.md');
  process.exit(1);
}

// Add new version section after [Unreleased]
const newChangelog = changelog.replace(
  /## \[Unreleased\]/,
  `## [Unreleased]

### Added

-

### Changed

-

### Deprecated

-

### Removed

-

### Fixed

-

### Security

-

## [${newVersion}] - ${today}`
);

// Update the version link at the bottom
const versionLinkPattern = new RegExp(
  `\\[Unreleased\\]: https://github\\.com/[^/]+/[^/]+/compare/v[^.]+\\.\\.[^.]+\\.\\.\\.HEAD`
);
const newVersionLink = `[Unreleased]: https://github.com/ealt/virgil/compare/v${newVersion}...HEAD\n[${newVersion}]: https://github.com/ealt/virgil/releases/tag/v${newVersion}`;

let updatedChangelog = newChangelog;
if (versionLinkPattern.test(updatedChangelog)) {
  updatedChangelog = updatedChangelog.replace(
    versionLinkPattern,
    newVersionLink
  );
} else {
  // If pattern doesn't match, append the link
  updatedChangelog = updatedChangelog.trim() + '\n\n' + newVersionLink + '\n';
}

fs.writeFileSync(changelogPath, updatedChangelog);
console.log(`✓ Updated CHANGELOG.md`);

console.log(`\n✓ Version bumped successfully to ${newVersion}`);
console.log('\nNext steps:');
console.log(`  1. Review CHANGELOG.md and add release notes for ${newVersion}`);
console.log(`  2. Commit changes: git add package.json CHANGELOG.md`);
console.log(`  3. Commit: git commit -m "chore: bump version to ${newVersion}"`);
console.log(`  4. Create tag: git tag v${newVersion}`);
console.log(`  5. Push: git push origin main --tags`);
