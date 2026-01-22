import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Walkthrough } from './types';
import { WalkthroughProvider } from './WalkthroughProvider';
import { StepDetailPanel } from './StepDetailPanel';
import { HighlightManager } from './HighlightManager';

let walkthroughProvider: WalkthroughProvider | undefined;
let highlightManager: HighlightManager | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Virgil extension is now active');

  highlightManager = new HighlightManager();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
    showCollapseAll: true
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
        vscode.window.showInformationMessage(`Loaded: ${selected.label}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virgil.openLocation', async (filePath: string, startLine: number, endLine: number) => {
      await openFileAtLocation(workspaceRoot, filePath, startLine, endLine);
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

  // Load walkthrough if it exists
  if (findWalkthroughFile()) {
    vscode.window.showInformationMessage('Virgil walkthrough loaded. Select a step from the sidebar to begin.');
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

    // Open first location and highlight all
    if (step.locations.length > 0) {
      const firstLoc = step.locations[0];
      await openFileAtLocation(workspaceRoot, firstLoc.path, firstLoc.startLine, firstLoc.endLine);

      // Highlight all locations
      for (const loc of step.locations) {
        const fullPath = path.join(workspaceRoot, loc.path);
        const uri = vscode.Uri.file(fullPath);

        // Find if document is open
        const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === fullPath);
        if (doc) {
          const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === fullPath);
          if (editor) {
            highlightManager.highlightRange(editor, loc.startLine, loc.endLine);
          }
        }
      }
    }

    // Show step detail panel
    StepDetailPanel.createOrShow(context.extensionUri, step, currentIndex, walkthrough.steps.length);
  }

  async function openFileAtLocation(root: string, filePath: string, startLine: number, endLine: number) {
    const fullPath = path.join(root, filePath);

    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false
      });

      // Convert to 0-indexed
      const start = new vscode.Position(startLine - 1, 0);
      const end = new vscode.Position(endLine - 1, doc.lineAt(endLine - 1).text.length);

      editor.selection = new vscode.Selection(start, start);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);

      // Apply highlight
      if (highlightManager) {
        highlightManager.highlightRange(editor, startLine, endLine);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
    }
  }
}

export function deactivate() {
  highlightManager?.clearAll();
  StepDetailPanel.currentPanel?.dispose();
  fileWatcher?.dispose();
}
