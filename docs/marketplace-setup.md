# Marketplace Publishing Setup

This guide covers the setup required to publish the Virgil extension to both the VS Code Marketplace and Open VSX Marketplace.

## VS Code Marketplace Setup

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

## Open VSX Marketplace Setup

### 1. Create Account

1. Go to [Open VSX](https://open-vsx.org/)
2. Click "Log In" and sign in with your GitHub account
3. Authorize the Open VSX application

### 2. Create Namespace

1. Go to your [User Settings](https://open-vsx.org/user-settings/namespaces)
2. Click "Create a New Namespace"
3. Enter your namespace name (should match your publisher ID, e.g., `ealt`)
4. Click "Create Namespace"

### 3. Personal Access Token

1. Go to [Access Tokens](https://open-vsx.org/user-settings/tokens)
2. Click "Generate New Token"
3. Enter a description (e.g., `GitHub Actions Publishing`)
4. Click "Generate Token"
5. **Copy the token immediately** - you won't be able to see it again!

### 4. GitHub Repository Secret

1. Go to your GitHub repository: `https://github.com/ealt/virgil`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Configure the secret:
   - **Name**: `OVSX_PAT`
   - **Value**: Paste your Personal Access Token from step 3
5. Click **Add secret**

## Required GitHub Secrets Summary

| Secret | Purpose | Setup URL |
|--------|---------|-----------|
| `VSCE_PAT` | VS Code Marketplace token | https://dev.azure.com/_usersSettings/tokens |
| `OVSX_PAT` | Open VSX token | https://open-vsx.org/user-settings/tokens |

## Verification Checklist

Before publishing, verify:

- [ ] VS Code Marketplace publisher account created at https://marketplace.visualstudio.com/manage
- [ ] VS Code Personal Access Token created with "Marketplace (Manage)" scope
- [ ] `VSCE_PAT` secret added to GitHub repository settings
- [ ] Open VSX account created at https://open-vsx.org/
- [ ] Open VSX namespace created matching your publisher ID
- [ ] Open VSX Personal Access Token created
- [ ] `OVSX_PAT` secret added to GitHub repository settings
- [ ] Publisher ID in `package.json` matches your publisher account ID
- [ ] Version in `package.json` is correct and follows semantic versioning
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] All CI checks are passing
- [ ] Extension has been tested in Extension Development Host
- [ ] Icon file (`icon.png`) exists and is valid
- [ ] README.md images use HTTPS (if any external images)
- [ ] No SVG icons in package.json (only PNG/JPG allowed)

## Publishing Methods

### Method 1: Manual Publishing (via GitHub Actions)

1. Update version in `package.json`:
   ```bash
   npm run version:bump <version>
   # Or manually edit package.json
   ```

2. Update `CHANGELOG.md` with release notes

3. Commit and push:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare for release v0.2.0"
   git push origin main
   ```

4. Go to GitHub Actions: https://github.com/ealt/virgil/actions/workflows/publish.yml

5. Click "Run workflow"
   - Select branch: `main`
   - Enter version: `0.2.0` (must match package.json)
   - Click "Run workflow"

6. Monitor the workflow run - it will:
   - Verify version matches
   - Run all quality checks (lint, type-check, build, format-check)
   - Publish to marketplace using `VSCE_PAT` secret

### Method 2: Publishing via Release

1. Follow steps 1-3 from Method 1

2. Create and push a git tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. The `release.yml` workflow will:
   - Create a GitHub release
   - Attach the VSIX file
   - Generate release notes

4. The `publish.yml` workflow will automatically trigger on release publication and publish to both marketplaces

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

### "VSCE_PAT secret is not set" / "OVSX_PAT secret is not set"

- Verify the secret exists in GitHub repository settings
- Ensure the secret name is exactly `VSCE_PAT` or `OVSX_PAT` (case-sensitive)
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

1. The extension will appear in the marketplaces within a few minutes
2. Users can install it via:
   - **VS Code**: Extensions view → Search for "Virgil"
   - **VS Code CLI**: `code --install-extension ealt.virgil-walkthroughs`
   - **VSCodium/Open VSX compatible editors**: Search for "Virgil" in the extensions view
3. Verify publication at:
   - https://marketplace.visualstudio.com/items?itemName=ealt.virgil-walkthroughs
   - https://open-vsx.org/extension/ealt/virgil-walkthroughs
4. Update the README.md marketplace badge links if needed
5. Announce the release on your preferred channels

## Resources

### VS Code Marketplace
- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace Management](https://marketplace.visualstudio.com/manage)
- [Azure DevOps PAT Creation](https://dev.azure.com/_usersSettings/tokens)
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)

### Open VSX
- [Open VSX Registry](https://open-vsx.org/)
- [Open VSX Wiki](https://github.com/eclipse/openvsx/wiki)
- [Publishing Extensions to Open VSX](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
