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

Thank you for contributing to Virgil! 🎉
