import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseLocation, ViewMode, getStepType, MarkdownViewMode, isMarkdownFile } from './types';
import { WalkthroughProvider } from './WalkthroughProvider';
import { StepDetailPanel } from './StepDetailPanel';
import { HighlightManager, HighlightColor } from './HighlightManager';
import { parseMarkdownWalkthrough } from './markdownParser';
import { DiffContentProvider } from './DiffContentProvider';
import { DiffResolver } from './DiffResolver';
import { MarkdownHighlightProvider } from './MarkdownHighlightProvider';

let walkthroughProvider: WalkthroughProvider | undefined;
let highlightManager: HighlightManager | undefined;
let fileWatchers: vscode.FileSystemWatcher[] = [];
let diffContentProvider: DiffContentProvider | undefined;
let diffResolver: DiffResolver | undefined;
let currentViewMode: ViewMode = 'diff';
let currentMarkdownViewMode: MarkdownViewMode = 'rendered';

function getDefaultViewMode(): ViewMode {
  const config = vscode.workspace.getConfiguration('virgil.view');
  return (config.get<ViewMode>('defaultDiffViewMode', 'diff') as ViewMode) || 'diff';
}

function getDefaultMarkdownViewMode(): MarkdownViewMode {
  const config = vscode.workspace.getConfiguration('virgil.view');
  return (
    (config.get<MarkdownViewMode>('defaultMarkdownViewMode', 'rendered') as MarkdownViewMode) ||
    'rendered'
  );
}

function shouldAutoShowFirstStep(): boolean {
  const config = vscode.workspace.getConfiguration('virgil.view');
  return config.get<boolean>('autoShowFirstStep', true);
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Virgil extension is now active');

  highlightManager = new HighlightManager();

  // Initialize view modes from configuration
  currentViewMode = getDefaultViewMode();
  currentMarkdownViewMode = getDefaultMarkdownViewMode();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Shared helper function to convert markdown to JSON in walkthroughs/ directory
  async function convertMarkdownToWalkthrough(
    markdownFilePath: string,
    workspaceRoot: string
  ): Promise<string | null> {
    try {
      // Read markdown file
      const markdownContent = fs.readFileSync(markdownFilePath, 'utf-8');

      // Parse markdown
      const result = parseMarkdownWalkthrough(markdownContent, workspaceRoot);

      // Show warnings if any
      if (result.warnings.length > 0) {
        const warningMessage = `Conversion completed with ${result.warnings.length} warning(s):\n${result.warnings.join('\n')}`;
        const choice = await vscode.window.showWarningMessage(warningMessage, 'Continue', 'Cancel');
        if (choice !== 'Continue') {
          return null; // User cancelled
        }
      }

      // Ensure walkthroughs directory exists
      const walkthroughsDir = path.join(workspaceRoot, 'walkthroughs');
      if (!fs.existsSync(walkthroughsDir)) {
        fs.mkdirSync(walkthroughsDir, { recursive: true });
      }

      // Determine output file path in walkthroughs/ directory
      const markdownBasename = path.basename(markdownFilePath, path.extname(markdownFilePath));
      const outputPath = path.join(walkthroughsDir, `${markdownBasename}.json`);

      // Write JSON file
      const jsonContent = JSON.stringify(result.walkthrough, null, 2);
      fs.writeFileSync(outputPath, jsonContent, 'utf-8');

      // Return relative path from workspace root
      return path.relative(workspaceRoot, outputPath);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to convert markdown: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  // Register convertMarkdown command early so it's available even without workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.convertMarkdown', async (uri?: vscode.Uri) => {
      const currentWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!currentWorkspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      // Prefer the target from context menu (Explorer/editor)
      const activeEditor = vscode.window.activeTextEditor;
      let markdownFile: string | undefined;

      if (uri?.fsPath) {
        const ext = path.extname(uri.fsPath).toLowerCase();
        if (ext === '.md' || ext === '.markdown') {
          markdownFile = uri.fsPath;
        } else {
          vscode.window.showErrorMessage('Selected file is not a Markdown file.');
          return;
        }
      } else if (activeEditor && activeEditor.document.languageId === 'markdown') {
        // Use currently open markdown file
        markdownFile = activeEditor.document.uri.fsPath;
      } else {
        // Prompt user to select a markdown file
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: 'Select Markdown File',
          filters: {
            Markdown: ['md', 'markdown'],
          },
          defaultUri: vscode.Uri.file(currentWorkspaceRoot),
        });

        if (!fileUri || fileUri.length === 0) {
          return; // User cancelled
        }

        markdownFile = fileUri[0].fsPath;
      }

      if (!markdownFile) {
        return;
      }

      const relativePath = await convertMarkdownToWalkthrough(markdownFile, currentWorkspaceRoot);
      if (relativePath) {
        vscode.window.showInformationMessage(`Walkthrough converted successfully: ${relativePath}`);
        // Refresh walkthrough provider
        walkthroughProvider?.refresh();
      }
    })
  );

  if (!workspaceRoot) {
    return;
  }

  // Initialize diff support
  diffContentProvider = new DiffContentProvider(workspaceRoot);
  diffResolver = new DiffResolver(workspaceRoot);

  // Register content provider for git files
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('virgil-git', diffContentProvider)
  );

  // Register content provider for markdown preview with highlighting
  const markdownHighlightProvider = new MarkdownHighlightProvider(
    workspaceRoot,
    diffContentProvider
  );
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      'virgil-md-preview',
      markdownHighlightProvider
    )
  );

  // Find walkthrough file (.walkthrough.json at root or any .json in walkthroughs/)
  const findWalkthroughFile = (): string | undefined => {
    // Check for .walkthrough.json at root
    const rootWalkthroughPath = path.join(workspaceRoot, '.walkthrough.json');
    if (fs.existsSync(rootWalkthroughPath)) {
      return rootWalkthroughPath;
    }

    // Check for any .json file in walkthroughs/ directory
    const walkthroughsDir = path.join(workspaceRoot, 'walkthroughs');
    if (fs.existsSync(walkthroughsDir) && fs.statSync(walkthroughsDir).isDirectory()) {
      try {
        const files = fs.readdirSync(walkthroughsDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        if (jsonFile) {
          return path.join(walkthroughsDir, jsonFile);
        }
      } catch {
        // Ignore errors
      }
    }

    return undefined;
  };

  // Initialize provider
  walkthroughProvider = new WalkthroughProvider(workspaceRoot);

  // Register tree view
  const treeView = vscode.window.createTreeView('virgilWalkthrough', {
    treeDataProvider: walkthroughProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView);

  // Set context for keybindings
  vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', !!findWalkthroughFile());

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.start', () => {
      if (walkthroughProvider) {
        walkthroughProvider.goToStep(0);
        currentViewMode = getDefaultViewMode(); // Reset to default view mode
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.next', () => {
      if (walkthroughProvider) {
        walkthroughProvider.nextStep();
        currentViewMode = getDefaultViewMode(); // Reset to default view mode on step change
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.prev', () => {
      if (walkthroughProvider) {
        walkthroughProvider.prevStep();
        currentViewMode = getDefaultViewMode(); // Reset to default view mode on step change
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.goToParent', () => {
      if (walkthroughProvider) {
        if (walkthroughProvider.goToParent()) {
          currentViewMode = getDefaultViewMode();
          showCurrentStep();
        } else {
          vscode.window.showInformationMessage('No parent step available');
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.nextSibling', () => {
      if (walkthroughProvider) {
        if (walkthroughProvider.goToNextSibling()) {
          currentViewMode = getDefaultViewMode();
          showCurrentStep();
        } else {
          vscode.window.showInformationMessage('No next sibling step available');
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.prevSibling', () => {
      if (walkthroughProvider) {
        if (walkthroughProvider.goToPrevSibling()) {
          currentViewMode = getDefaultViewMode();
          showCurrentStep();
        } else {
          vscode.window.showInformationMessage('No previous sibling step available');
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.goToStep', (stepIndex: number) => {
      if (walkthroughProvider) {
        walkthroughProvider.goToStep(stepIndex);
        currentViewMode = getDefaultViewMode(); // Reset to default view mode
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.refresh', () => {
      if (walkthroughProvider) {
        walkthroughProvider.refresh();
        vscode.window.showInformationMessage('Walkthrough refreshed');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.selectWalkthrough', async () => {
      if (!walkthroughProvider || !workspaceRoot) {
        return;
      }

      const available = walkthroughProvider.getAvailableWalkthroughs();
      const currentFile = walkthroughProvider.getCurrentFile();

      const items = available.map((file) => ({
        label: file,
        description: file === currentFile ? '(current)' : undefined,
      }));

      // Add "Select file..." option
      items.push({
        label: '$(folder-opened) Select file...',
        description: 'Browse for a JSON or Markdown file',
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a walkthrough',
      });

      if (!selected) {
        return;
      }

      // Handle "Select file..." option
      if (selected.label === '$(folder-opened) Select file...') {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: 'Select Walkthrough File (JSON or Markdown)',
          filters: {
            'All Supported': ['json', 'md', 'markdown'],
            JSON: ['json'],
            Markdown: ['md', 'markdown'],
            'All Files': ['*'],
          },
          defaultUri: vscode.Uri.file(workspaceRoot),
        });

        if (!fileUri || fileUri.length === 0) {
          return; // User cancelled
        }

        const selectedFilePath = fileUri[0].fsPath;
        const ext = path.extname(selectedFilePath).toLowerCase();

        // If markdown file, convert it first
        if (ext === '.md' || ext === '.markdown') {
          const relativePath = await convertMarkdownToWalkthrough(selectedFilePath, workspaceRoot);
          if (!relativePath) {
            return; // Conversion failed or was cancelled
          }
          // Use the converted file
          walkthroughProvider.setWalkthroughFile(relativePath);
        } else if (ext === '.json') {
          // For JSON files, validate it's a walkthrough and use it
          try {
            const content = fs.readFileSync(selectedFilePath, 'utf-8');
            const walkthrough = JSON.parse(content);
            // Basic validation - check if it has required fields
            if (!walkthrough.title || !Array.isArray(walkthrough.steps)) {
              vscode.window.showErrorMessage(
                'Selected file does not appear to be a valid walkthrough JSON file.'
              );
              return;
            }
            // Use the file directly (relative path from workspace root)
            const relativePath = path.relative(workspaceRoot, selectedFilePath);
            walkthroughProvider.setWalkthroughFile(relativePath);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to read or parse JSON file: ${error instanceof Error ? error.message : String(error)}`
            );
            return;
          }
        } else {
          vscode.window.showErrorMessage('Selected file must be a JSON or Markdown file.');
          return;
        }
      } else {
        // Regular selection from available walkthroughs
        walkthroughProvider.setWalkthroughFile(selected.label);
      }

      highlightManager?.clearAll();
      currentViewMode = getDefaultViewMode(); // Reset view mode
      // Show first step of newly selected walkthrough
      walkthroughProvider.goToStep(0);
      showCurrentStep();
      checkCommitMismatch();
      checkGitUserName();
    })
  );

  // View mode command for diff steps
  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.setViewMode', (mode: ViewMode) => {
      if (!walkthroughProvider) {
        return;
      }

      const walkthrough = walkthroughProvider.getWalkthrough();
      const currentIndex = walkthroughProvider.getCurrentStepIndex();
      if (!walkthrough || currentIndex < 0) {
        return;
      }

      const step = walkthrough.steps[currentIndex];
      const stepType = getStepType(step);

      // Only allow view mode changes for diff steps
      if (stepType !== 'diff') {
        return;
      }

      currentViewMode = mode;
      showCurrentStep();
    })
  );

  // Markdown view mode command (raw vs rendered)
  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.setMarkdownViewMode', (mode: MarkdownViewMode) => {
      if (!walkthroughProvider) {
        return;
      }

      currentMarkdownViewMode = mode;
      showCurrentStep();
    })
  );

  // Check for commit mismatch and show warning
  async function checkCommitMismatch() {
    if (!walkthroughProvider) {
      return;
    }

    walkthroughProvider.refreshGitState();
    const mismatchInfo = walkthroughProvider.getCommitMismatchInfo();
    if (mismatchInfo) {
      const choice = await vscode.window.showWarningMessage(
        `This walkthrough was created for commit ${mismatchInfo.expected.substring(0, 7)}. You're on ${mismatchInfo.current.substring(0, 7)}. Code may have changed.`,
        'Checkout',
        'Ignore'
      );

      if (choice === 'Checkout') {
        vscode.commands.executeCommand('virgil.checkoutCommit');
      }
    }
  }

  // Check for missing git user name and prompt to set it
  async function checkGitUserName() {
    if (!walkthroughProvider) {
      return;
    }

    if (!walkthroughProvider.hasGitUserName()) {
      const choice = await vscode.window.showWarningMessage(
        'Git user.name is not configured. Comments will be attributed to "Anonymous".',
        'Set Name',
        'Ignore'
      );

      if (choice === 'Set Name') {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter your name for git config',
          placeHolder: 'Your Name',
        });

        if (name) {
          const result = walkthroughProvider.setGitUserName(name);
          if (result.success) {
            vscode.window.showInformationMessage(`Git user.name set to "${name}"`);
          } else {
            vscode.window.showErrorMessage(`Failed to set git user.name: ${result.error}`);
          }
        }
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.checkoutCommit', async () => {
      if (!walkthroughProvider) {
        return;
      }

      const commit = walkthroughProvider.getWalkthroughCommit();
      if (!commit) {
        vscode.window.showInformationMessage('This walkthrough does not specify a commit.');
        return;
      }

      // Check for uncommitted changes
      if (walkthroughProvider.isWorkingTreeDirty()) {
        const choice = await vscode.window.showWarningMessage(
          'You have uncommitted changes. Stash them before checking out?',
          'Stash & Checkout',
          'Cancel'
        );

        if (choice === 'Stash & Checkout') {
          const stashResult = walkthroughProvider.stashChanges();
          if (!stashResult.success) {
            vscode.window.showErrorMessage(`Failed to stash changes: ${stashResult.error}`);
            return;
          }
          vscode.window.showInformationMessage('Changes stashed.');
        } else {
          return;
        }
      }

      // Checkout the commit
      const result = walkthroughProvider.checkoutCommit(commit);
      if (result.success) {
        vscode.window.showInformationMessage(
          `Checked out commit ${commit.substring(0, 7)}. You are now in detached HEAD state.`
        );
        walkthroughProvider.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to checkout: ${result.error}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.submitComment', async (text: string) => {
      if (!walkthroughProvider || !text) {
        return;
      }

      const currentIndex = walkthroughProvider.getCurrentStepIndex();
      if (currentIndex < 0) {
        return;
      }

      const success = walkthroughProvider.addComment(currentIndex, text);
      if (success) {
        showCurrentStep(); // Refresh the panel to show the new comment
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.openLocation', async (location: string) => {
      const parsed = parseLocation(location);
      if (!parsed) {
        return;
      }

      const fullPath = path.join(workspaceRoot, parsed.path);

      try {
        const doc = await vscode.workspace.openTextDocument(fullPath);
        const editor = await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        });

        // Go to first range
        const firstRange = parsed.ranges[0];
        const start = new vscode.Position(firstRange.startLine - 1, 0);
        const end = new vscode.Position(
          firstRange.endLine - 1,
          doc.lineAt(firstRange.endLine - 1).text.length
        );

        editor.selection = new vscode.Selection(start, start);
        editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);

        // Highlight all ranges
        highlightManager?.clearAll();
        for (const range of parsed.ranges) {
          highlightManager?.highlightRange(editor, range.startLine, range.endLine);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Could not open file: ${parsed.path}`);
      }
    })
  );

  // Watch for walkthrough file changes (both .walkthrough.json at root and walkthroughs/*.json)
  const watcherPatterns = [
    new vscode.RelativePattern(workspaceRoot, '.walkthrough.json'),
    new vscode.RelativePattern(workspaceRoot, 'walkthroughs/*.json'),
  ];

  // Create watchers for both patterns
  fileWatchers = watcherPatterns.map((pattern) => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(() => {
      walkthroughProvider?.refresh();
      vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', true);
      // Auto-show first step if setting is enabled and walkthrough exists
      if (shouldAutoShowFirstStep() && walkthroughProvider) {
        const walkthrough = walkthroughProvider.getWalkthrough();
        if (walkthrough && walkthrough.steps.length > 0) {
          walkthroughProvider.goToStep(0);
          showCurrentStep();
        }
      }
    });

    watcher.onDidCreate(() => {
      walkthroughProvider?.refresh();
      vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', true);
      if (shouldAutoShowFirstStep() && walkthroughProvider) {
        const walkthrough = walkthroughProvider.getWalkthrough();
        if (walkthrough && walkthrough.steps.length > 0) {
          walkthroughProvider.goToStep(0);
          showCurrentStep();
          checkCommitMismatch();
          checkGitUserName();
        }
      } else {
        vscode.window.showInformationMessage(
          'Walkthrough detected! Click on steps in the Virgil sidebar to begin.'
        );
      }
    });

    watcher.onDidDelete(() => {
      walkthroughProvider?.refresh();
      highlightManager?.clearAll();
      const hasWalkthrough = !!findWalkthroughFile();
      vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', hasWalkthrough);
    });

    return watcher;
  });

  fileWatchers.forEach((watcher) => context.subscriptions.push(watcher));

  // Handle tree view selection
  treeView.onDidChangeSelection(async (e) => {
    const selected = e.selection[0];
    if (selected && selected.stepIndex !== undefined) {
      walkthroughProvider?.goToStep(selected.stepIndex);
      currentViewMode = getDefaultViewMode(); // Reset view mode on step selection
      await showCurrentStep();
    }
  });

  // Auto-show first step if walkthrough exists and setting is enabled
  if (shouldAutoShowFirstStep() && findWalkthroughFile() && walkthroughProvider) {
    const walkthrough = walkthroughProvider.getWalkthrough();
    if (walkthrough && walkthrough.steps.length > 0) {
      walkthroughProvider.goToStep(0);
      showCurrentStep();
      checkCommitMismatch();
      checkGitUserName();
    }
  }

  async function showCurrentStep() {
    if (!walkthroughProvider || !highlightManager || !workspaceRoot || !diffResolver) {
      return;
    }

    const walkthrough = walkthroughProvider.getWalkthrough();
    const currentIndex = walkthroughProvider.getCurrentStepIndex();
    const totalSteps = walkthroughProvider.getTotalSteps();
    const step = walkthroughProvider.getCurrentStep();

    if (!walkthrough || currentIndex < 0 || !step) {
      return;
    }
    const stepType = getStepType(step);

    // Clear previous highlights
    highlightManager.clearAll();

    // Resolve base commit if needed
    const baseResult = diffResolver.resolveBase(walkthrough.repository);
    const headCommit = walkthrough.repository?.commit || diffResolver.getHeadCommit();

    // Build step anchor map for step links
    const stepAnchorMap = walkthroughProvider.getStepAnchorMap();

    // Build hierarchical navigation options
    const navOptions = {
      canGoToParent: walkthroughProvider.canGoToParent(),
      canGoToPrevSibling: walkthroughProvider.canGoToPrevSibling(),
      canGoToNextSibling: walkthroughProvider.canGoToNextSibling(),
    };

    // Handle based on step type
    if (stepType === 'diff') {
      // Diff mode: 3-way toggle
      if (!baseResult.commit) {
        // Show error in panel - no base reference configured
        StepDetailPanel.show(
          context.extensionUri,
          walkthrough,
          step,
          currentIndex,
          totalSteps,
          {
            stepType,
            viewMode: currentViewMode,
            error: 'No base reference specified. Add baseCommit, baseBranch, or pr to repository.',
            markdownViewMode: currentMarkdownViewMode,
          },
          stepAnchorMap,
          navOptions
        );
        return;
      }

      switch (currentViewMode) {
        case 'diff':
          await showDiff(step.location!, step.base_location!, baseResult.commit, headCommit);
          break;
        case 'head':
          await showFile(step.location!, headCommit, 'diffHead');
          break;
        case 'base':
          await showFile(step.base_location!, baseResult.commit, 'diffBase');
          break;
      }
    } else if (stepType === 'point-in-time') {
      // Point-in-time mode (unchanged behavior)
      await showFile(step.location!, headCommit, 'standard');
    } else if (stepType === 'base-only') {
      // Base-only mode
      if (!baseResult.commit) {
        StepDetailPanel.show(
          context.extensionUri,
          walkthrough,
          step,
          currentIndex,
          totalSteps,
          {
            stepType,
            viewMode: currentViewMode,
            error: 'No base reference specified. Add baseCommit, baseBranch, or pr to repository.',
            markdownViewMode: currentMarkdownViewMode,
          },
          stepAnchorMap,
          navOptions
        );
        return;
      }
      await showFile(step.base_location!, baseResult.commit, 'diffBase');
    }
    // informational steps have no file to show

    // Show step detail panel
    StepDetailPanel.show(
      context.extensionUri,
      walkthrough,
      step,
      currentIndex,
      totalSteps,
      {
        stepType,
        viewMode: currentViewMode,
        baseCommit: baseResult.commit || undefined,
        headCommit: headCommit || undefined,
        markdownViewMode: currentMarkdownViewMode,
      },
      stepAnchorMap,
      navOptions
    );
  }

  async function showFile(location: string, commit: string | null, color: HighlightColor) {
    if (!highlightManager) {
      return;
    }

    const parsed = parseLocation(location);
    if (!parsed) {
      return;
    }

    try {
      // Create URI first (needed for both markdown preview and regular editor)
      let uri: vscode.Uri;
      if (commit && diffContentProvider) {
        uri = DiffContentProvider.createUri(commit, parsed.path);
      } else {
        const fullPath = path.join(workspaceRoot!, parsed.path);
        uri = vscode.Uri.file(fullPath);
      }

      // For markdown files in 'rendered' mode, use VS Code's built-in preview with highlighting
      if (isMarkdownFile(parsed.path) && currentMarkdownViewMode === 'rendered') {
        const highlightedUri = MarkdownHighlightProvider.createUri(
          parsed.path,
          parsed.ranges,
          color,
          commit ?? undefined
        );
        await vscode.commands.executeCommand('markdown.showPreview', highlightedUri);
        return;
      }

      // Open in text editor with highlighting (for non-markdown or 'raw' mode)
      const doc = await vscode.workspace.openTextDocument(uri);

      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true,
      });

      // Go to first range
      const firstRange = parsed.ranges[0];
      const start = new vscode.Position(firstRange.startLine - 1, 0);
      const endLine = Math.min(firstRange.endLine, doc.lineCount);
      const end = new vscode.Position(endLine - 1, doc.lineAt(endLine - 1).text.length);

      editor.selection = new vscode.Selection(start, start);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);

      // Highlight all ranges
      for (const range of parsed.ranges) {
        const clampedEnd = Math.min(range.endLine, doc.lineCount);
        highlightManager.highlightRange(editor, range.startLine, clampedEnd, color);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Could not open file: ${errorMessage}`);
    }
  }

  async function showDiff(
    headLocation: string,
    baseLocation: string,
    baseCommit: string,
    headCommit: string | null
  ) {
    const headParsed = parseLocation(headLocation);
    const baseParsed = parseLocation(baseLocation);

    if (!headParsed || !baseParsed) {
      return;
    }

    try {
      // Create URIs for diff view
      const baseUri = DiffContentProvider.createUri(baseCommit, baseParsed.path);

      let headUri: vscode.Uri;
      if (headCommit) {
        headUri = DiffContentProvider.createUri(headCommit, headParsed.path);
      } else {
        // Use current workspace file
        headUri = vscode.Uri.file(path.join(workspaceRoot!, headParsed.path));
      }

      // Open diff editor
      const title = `${baseParsed.path} (${baseCommit.substring(0, 7)}) ↔ ${headParsed.path}`;
      await vscode.commands.executeCommand('vscode.diff', baseUri, headUri, title);

      // Note: We can't easily highlight in diff view, but the diff itself provides context
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Could not open diff: ${errorMessage}`);
    }
  }
}

export function deactivate() {
  highlightManager?.clearAll();
  StepDetailPanel.currentPanel?.dispose();
  fileWatchers.forEach((watcher) => watcher.dispose());
  diffContentProvider?.dispose();
}
