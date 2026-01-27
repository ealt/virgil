# VS Code Marketplace Publishing Setup

This guide covers the setup required to publish the Virgil extension to the VS Code Marketplace.

## Prerequisites

### 1. Publisher Account

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account (or create one)
3. Create a new organization if you don't have one
4. Go to [Marketplace Management](https://marketplace.visualstudio.com/manage)
5. Create a publisher account:
   - Click "Create Publisher"
   - Choose a unique publisher ID (e.g., `ealt`)
   - Fill in your publisher details
   - Accept the Marketplace Publisher Agreement

### 2. Personal Access Token (PAT)

1. Go to [Azure DevOps User Settings](https://dev.azure.com/_usersSettings/tokens)
2. Click "New Token"
3. Configure the token:
   - **Name**: `VS Code Extension Publishing` (or similar)
   - **Organization**: Select your organization
   - **Expiration**: Choose appropriate expiration (90 days, 1 year, or custom)
   - **Scopes**: Select **Marketplace (Manage)**
4. Click "Create"
5. **Copy the token immediately** - you won't be able to see it again!

### 3. GitHub Repository Secret

1. Go to your GitHub repository: `https://github.com/ealt/virgil`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Configure the secret:
   - **Name**: `VSCE_PAT`
   - **Value**: Paste your Personal Access Token from step 2
5. Click **Add secret**

## Verification Checklist

Before publishing, verify:

- [ ] Publisher account created at <https://marketplace.visualstudio.com/manage>
- [ ] Personal Access Token created with "Marketplace (Manage)" scope
- [ ] `VSCE_PAT` secret added to GitHub repository settings
- [ ] Publisher ID in `package.json` matches your publisher account ID
- [ ] Version in `package.json` is correct and follows semantic versioning
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] All CI checks are passing
- [ ] Extension has been tested in Extension Development Host
- [ ] Icon file (`icon.png`) exists and is valid
- [ ] README.md images use HTTPS (if any external images)
- [ ] No SVG icons in package.json (only PNG/JPG allowed)

## Publishing Methods

### Method 1: Automated Release (Recommended)

This is the standard release workflow using the staging branch:

1. **Prepare release on `develop` branch:**

   ```bash
   git checkout develop
   npm run version:bump <version>
   # Review and update CHANGELOG.md with release notes
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare release v0.2.0"
   git push origin develop
   ```

2. **Create PR: `develop` → `main`**
   - Go to GitHub and create a pull request
   - Title: "Release v0.2.0" (or similar)
   - Review the changes
   - Merge the PR

3. **Automated release process:**
   - The `release-on-merge.yml` workflow automatically:
     - Detects the version bump
     - Creates git tag `v<version>`
     - Pushes the tag (triggers `release.yml`)
   - The `release.yml` workflow:
     - Creates a GitHub release
     - Attaches the VSIX file
     - Generates release notes
   - The `publish.yml` workflow:
     - Automatically publishes to the marketplace

### Method 2: Manual Publishing (via GitHub Actions)

If you need to publish manually (e.g., re-publish an existing version):

1. Go to GitHub Actions: <https://github.com/ealt/virgil/actions/workflows/publish.yml>

2. Click "Run workflow"
   - Select branch: `main`
   - Enter version: `0.2.0` (must match package.json)
   - Click "Run workflow"

3. Monitor the workflow run - it will:
   - Verify version matches
   - Run all quality checks (lint, type-check, build, format-check)
   - Publish to marketplace using `VSCE_PAT` secret

### Method 3: Manual Tagging (Fallback)

If the automated workflow fails, you can manually create a tag:

1. Ensure version is bumped on `main` branch

2. Create and push a git tag:

   ```bash
   git checkout main
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. The `release.yml` workflow will:
   - Create a GitHub release
   - Attach the VSIX file
   - Generate release notes

4. The `publish.yml` workflow will automatically trigger on release publication and publish to the marketplace

### Method 3: Local Publishing (for testing)

For testing purposes, you can publish locally:

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Login (first time only)
vsce login <publisher-id>

# Publish
vsce publish
```

**Note**: Local publishing requires the PAT to be set up in your environment or you'll be prompted for it.

## Troubleshooting

### "VSCE_PAT secret is not set"

- Verify the secret exists in GitHub repository settings
- Ensure the secret name is exactly `VSCE_PAT` (case-sensitive)
- Check that the workflow has access to secrets (should work by default)

### "Publisher not found" or "Unauthorized"

- Verify your publisher ID in `package.json` matches your Azure DevOps publisher account
- Ensure your PAT has "Marketplace (Manage)" scope
- Check that your PAT hasn't expired

### "Version already exists"

- The marketplace doesn't allow publishing the same version twice
- Bump the version in `package.json` and try again
- Use `npm run version:bump` to automate this

### Workflow fails on version verification

- Ensure the version in `package.json` matches the input version (for manual dispatch)
- For release-triggered publishing, ensure the tag version (without `v` prefix) matches `package.json`

## Post-Publishing

After successful publishing:

1. The extension will appear in the marketplace within a few minutes
2. Users can install it via:
   - VS Code Extensions view: Search for "Virgil"
   - Command line: `code --install-extension ealt.virgil-walkthroughs`
3. Update the README.md marketplace badge link if needed
4. Announce the release on your preferred channels

## Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace Management](https://marketplace.visualstudio.com/manage)
- [Azure DevOps PAT Creation](https://dev.azure.com/_usersSettings/tokens)
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
