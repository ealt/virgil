# Contributing to Virgil

Thank you for your interest in contributing to Virgil! This guide will help you get started.

## Getting Started

### 1. Fork the Repository

1. Click the "Fork" button on the top right of the [Virgil repository](https://github.com/ealt/virgil)
2. This creates a copy of the repository in your GitHub account

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/virgil.git
cd virgil
```

### 3. Add Upstream Remote

Add the original repository as a remote to keep your fork in sync:

```bash
git remote add upstream https://github.com/ealt/virgil.git
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Compile the Extension

```bash
npm run compile
```

## Development Workflow

### Creating a Feature Branch

1. **Sync your fork** with the main repository:

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

2. **Create a new branch** for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

1. Make your changes to the code
2. **Pre-commit hooks** will automatically run (installed via `npm install`):
   - ESLint will check and auto-fix code style issues
   - Prettier will format your code
3. Commit your changes:

   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

### Testing Your Changes

1. Run the extension in development mode:

   ```bash
   npm run watch
   ```

2. Press `F5` in VS Code/Cursor to launch Extension Development Host
3. Test your changes in the new window

### Submitting a Pull Request

1. **Push your branch** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**:
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template with:
     - Description of changes
     - Type of change (bug fix, feature, etc.)
     - Testing performed
     - Related issues (if any)

3. **Wait for CI checks** to pass:
   - Lint checks
   - Type checking
   - Build verification
   - Format checking

4. **Address review feedback**:
   - Make requested changes
   - Push additional commits to your branch
   - The PR will automatically update

## Releasing

Releases are automated when version bumps are pushed to main (via PR merge or direct push).

### Version Bump Commands

```bash
npm run version:bump patch   # 0.1.0 → 0.1.1 (bug fixes)
npm run version:bump minor   # 0.1.0 → 0.2.0 (new features, backwards compatible)
npm run version:bump major   # 0.1.0 → 1.0.0 (breaking changes)
npm run version:bump 1.2.3   # Set exact version
```

This updates both `package.json` and `CHANGELOG.md`.

### Release Workflow

1. Create your feature branch and make changes
2. Run `npm run version:bump <type>` to bump the version
3. Edit `CHANGELOG.md` to add release notes under the new version
4. Commit: `git commit -m "chore: bump version to X.Y.Z"`
5. Open PR and merge to main

When merged, the CI will automatically:
- Create a git tag (vX.Y.Z)
- Create a GitHub release with the VSIX
- Publish to VS Code Marketplace
- Publish to Open VSX Marketplace

### When to Bump Versions

- **patch**: Bug fixes, documentation updates, minor improvements
- **minor**: New features that don't break existing functionality
- **major**: Breaking changes (API changes, removed features, etc.)

## Code Style Guidelines

- Follow the existing code style
- Use TypeScript strict mode
- Run `npm run lint` before committing
- Run `npm run format` to format code
- Write clear commit messages

## Pull Request Guidelines

- **Small, focused PRs** are easier to review
- **Update documentation** if you change functionality
- **Add tests** if applicable (testing framework to be added)
- **Reference issues** in your PR description (e.g., "Closes #123")
- **Ensure all CI checks pass** before requesting review

## Getting Help

- Open an issue for questions or discussions
- Check existing issues and PRs for similar work
- Review the [Development Guide](docs/development.md) for architecture details

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Please review `CODE_OF_CONDUCT.md` for full guidelines and reporting information

Thank you for contributing to Virgil! 🎉
