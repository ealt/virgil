import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseLocation } from './types';
import { WalkthroughProvider } from './WalkthroughProvider';
import { StepDetailPanel } from './StepDetailPanel';
import { HighlightManager } from './HighlightManager';
import { parseMarkdownWalkthrough } from './markdownParser';

let walkthroughProvider: WalkthroughProvider | undefined;
let highlightManager: HighlightManager | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Virgil extension is now active');

  highlightManager = new HighlightManager();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

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
            'Markdown': ['md', 'markdown']
          },
          defaultUri: vscode.Uri.file(currentWorkspaceRoot)
        });

        if (!fileUri || fileUri.length === 0) {
          return; // User cancelled
        }

        markdownFile = fileUri[0].fsPath;
      }

      if (!markdownFile) {
        return;
      }

      try {
        // Read markdown file
        const markdownContent = fs.readFileSync(markdownFile, 'utf-8');

        // Parse markdown
        const result = parseMarkdownWalkthrough(markdownContent, currentWorkspaceRoot);

        // Show warnings if any
        if (result.warnings.length > 0) {
          const warningMessage = `Conversion completed with ${result.warnings.length} warning(s):\n${result.warnings.join('\n')}`;
          await vscode.window.showWarningMessage(warningMessage, 'Continue', 'Cancel');
        }

        // Determine output file path
        const markdownBasename = path.basename(markdownFile, path.extname(markdownFile));
        const defaultOutputPath = path.join(currentWorkspaceRoot, `${markdownBasename}.walkthrough.json`);

        // Prompt for output location
        const outputUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultOutputPath),
          filters: {
            'Walkthrough JSON': ['walkthrough.json']
          },
          saveLabel: 'Save Walkthrough'
        });

        if (!outputUri) {
          return; // User cancelled
        }

        // Write JSON file
        const jsonContent = JSON.stringify(result.walkthrough, null, 2);
        fs.writeFileSync(outputUri.fsPath, jsonContent, 'utf-8');

        vscode.window.showInformationMessage(`Walkthrough converted successfully: ${path.basename(outputUri.fsPath)}`);

        // Refresh walkthrough provider if it exists and the output file is in the workspace root
        const outputPath = outputUri.fsPath;
        if (outputPath.startsWith(currentWorkspaceRoot) && outputPath.endsWith('.walkthrough.json')) {
          walkthroughProvider?.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to convert markdown: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  if (!workspaceRoot) {
    return;
  }

  // Find walkthrough file (*.walkthrough.json)
  const findWalkthroughFile = (): string | undefined => {
    const files = fs.readdirSync(workspaceRoot);
    const walkthroughFile = files.find(f => f.endsWith('.walkthrough.json'));
    return walkthroughFile ? path.join(workspaceRoot, walkthroughFile) : undefined;
  };

  // Initialize provider
  walkthroughProvider = new WalkthroughProvider(workspaceRoot);

  // Register tree view
  const treeView = vscode.window.createTreeView('virgilWalkthrough', {
    treeDataProvider: walkthroughProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);

  // Set context for keybindings
  vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', !!findWalkthroughFile());

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.start', () => {
      if (walkthroughProvider) {
        walkthroughProvider.goToStep(0);
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.next', () => {
      if (walkthroughProvider) {
        walkthroughProvider.nextStep();
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.prev', () => {
      if (walkthroughProvider) {
        walkthroughProvider.prevStep();
        showCurrentStep();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.goToStep', (stepIndex: number) => {
      if (walkthroughProvider) {
        walkthroughProvider.goToStep(stepIndex);
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
      if (!walkthroughProvider) {
        return;
      }

      const available = walkthroughProvider.getAvailableWalkthroughs();
      if (available.length === 0) {
        vscode.window.showInformationMessage('No walkthrough files found');
        return;
      }

      const currentFile = walkthroughProvider.getCurrentFile();
      const items = available.map(file => ({
        label: file,
        description: file === currentFile ? '(current)' : undefined
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a walkthrough'
      });

      if (selected) {
        walkthroughProvider.setWalkthroughFile(selected.label);
        highlightManager?.clearAll();
        // Show first step of newly selected walkthrough
        walkthroughProvider.goToStep(0);
        showCurrentStep();
        checkCommitMismatch();
        checkGitUserName();
      }
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
          placeHolder: 'Your Name'
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
        vscode.window.showInformationMessage(`Checked out commit ${commit.substring(0, 7)}. You are now in detached HEAD state.`);
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
          preserveFocus: false
        });

        // Go to first range
        const firstRange = parsed.ranges[0];
        const start = new vscode.Position(firstRange.startLine - 1, 0);
        const end = new vscode.Position(firstRange.endLine - 1, doc.lineAt(firstRange.endLine - 1).text.length);

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

  // Watch for walkthrough file changes
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '*.walkthrough.json')
  );

  fileWatcher.onDidChange(() => {
    walkthroughProvider?.refresh();
    vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', true);
  });

  fileWatcher.onDidCreate(() => {
    walkthroughProvider?.refresh();
    vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', true);
    vscode.window.showInformationMessage('Walkthrough detected! Click on steps in the Virgil sidebar to begin.');
  });

  fileWatcher.onDidDelete(() => {
    walkthroughProvider?.refresh();
    highlightManager?.clearAll();
    vscode.commands.executeCommand('setContext', 'virgilWalkthroughActive', false);
  });

  context.subscriptions.push(fileWatcher);

  // Handle tree view selection
  treeView.onDidChangeSelection(async (e) => {
    const selected = e.selection[0];
    if (selected && selected.stepIndex !== undefined) {
      walkthroughProvider?.goToStep(selected.stepIndex);
      await showCurrentStep();
    }
  });

  // Auto-show first step if walkthrough exists
  if (findWalkthroughFile() && walkthroughProvider) {
    const walkthrough = walkthroughProvider.getWalkthrough();
    if (walkthrough && walkthrough.steps.length > 0) {
      walkthroughProvider.goToStep(0);
      showCurrentStep();
      checkCommitMismatch();
      checkGitUserName();
    }
  }

  async function showCurrentStep() {
    if (!walkthroughProvider || !highlightManager || !workspaceRoot) {
      return;
    }

    const walkthrough = walkthroughProvider.getWalkthrough();
    const currentIndex = walkthroughProvider.getCurrentStepIndex();

    if (!walkthrough || currentIndex < 0 || currentIndex >= walkthrough.steps.length) {
      return;
    }

    const step = walkthrough.steps[currentIndex];

    // Clear previous highlights
    highlightManager.clearAll();

    // If step has a location, open the file and highlight
    if (step.location) {
      const parsed = parseLocation(step.location);
      if (parsed) {
        const fullPath = path.join(workspaceRoot, parsed.path);

        try {
          const doc = await vscode.workspace.openTextDocument(fullPath);
          const editor = await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true
          });

          // Go to first range
          const firstRange = parsed.ranges[0];
          const start = new vscode.Position(firstRange.startLine - 1, 0);
          const end = new vscode.Position(firstRange.endLine - 1, doc.lineAt(firstRange.endLine - 1).text.length);

          editor.selection = new vscode.Selection(start, start);
          editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);

          // Highlight all ranges
          for (const range of parsed.ranges) {
            highlightManager.highlightRange(editor, range.startLine, range.endLine);
          }
        } catch (error) {
          // File not found - still show the panel
        }
      }
    }

    // Show step detail panel
    StepDetailPanel.show(
      context.extensionUri,
      walkthrough,
      step,
      currentIndex,
      walkthrough.steps.length
    );
  }
}

export function deactivate() {
  highlightManager?.clearAll();
  StepDetailPanel.currentPanel?.dispose();
  fileWatcher?.dispose();
}
