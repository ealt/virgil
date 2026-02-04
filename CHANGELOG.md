# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-02-03

### Added

- Automated release workflows for publishing to Microsoft and Open VS Code marketplaces
- Markdown conversion test suite with golden files
- Test script for validating markdown to walkthrough JSON conversions

## [0.1.1] - 2026-02-04

### Changed

- Updated package name to avoid marketplace name conflicts

## [0.1.0] - 2026-01-26

### Added

- Initial release of Virgil extension
- Interactive code walkthroughs with step-by-step navigation
- Code highlighting for walkthrough steps
- Diff mode for comparing changes between commits
- Markdown to JSON walkthrough conversion
- Comments support for walkthrough steps
- Repository scoping and commit awareness
- Multiple navigation methods (sidebar, keyboard shortcuts, detail panel)
- Markdown file rendering toggle (Raw/Rendered) for steps referencing `.md` files
- Hierarchical navigation commands: Go to Parent (`Cmd+Shift+\`), Next Sibling (`Cmd+Option+]`), Previous Sibling (`Cmd+Option+[`)
- File type-specific icons for steps in the sidebar (markdown, json, python, ruby, images, PDFs, archives, notebooks)
- Setting `virgil.view.showHierarchicalNavigation` to control visibility of parent/sibling navigation buttons in the step panel (default: `false`)

[Unreleased]: https://github.com/ealt/virgil/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/ealt/virgil/releases/tag/v0.1.2
[0.1.1]: https://github.com/ealt/virgil/releases/tag/v0.1.1
[0.1.0]: https://github.com/ealt/virgil/releases/tag/v0.1.0
