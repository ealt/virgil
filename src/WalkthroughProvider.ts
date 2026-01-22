import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Walkthrough, WalkthroughStep, parseLocation, normalizeRemoteUrl } from './types';

export class WalkthroughTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly stepIndex?: number
  ) {
    super(label, collapsibleState);
  }
}

export class WalkthroughProvider implements vscode.TreeDataProvider<WalkthroughTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WalkthroughTreeItem | undefined | null | void> =
    new vscode.EventEmitter<WalkthroughTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WalkthroughTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private walkthrough: Walkthrough | undefined;
  private currentStepIndex: number = -1;
  private workspaceRoot: string;
  private currentFile: string | undefined;
  private workspaceRemote: string | undefined;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceRemote = this.getGitRemote();
    this.loadWalkthrough();
  }

  private getGitRemote(): string | undefined {
    try {
      const remote = execSync('git remote get-url origin', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return remote || undefined;
    } catch {
      // Not a git repo or no origin remote
      return undefined;
    }
  }

  refresh(): void {
    this.loadWalkthrough();
    this._onDidChangeTreeData.fire();
  }

  getAvailableWalkthroughs(): string[] {
    try {
      const files = fs.readdirSync(this.workspaceRoot);
      const walkthroughFiles = files.filter(f => f.endsWith('.walkthrough.json'));

      // Filter to only show walkthroughs that match this repo (or have no repo specified)
      return walkthroughFiles.filter(filename => {
        try {
          const filePath = path.join(this.workspaceRoot, filename);
          const content = fs.readFileSync(filePath, 'utf-8');
          const walkthrough = JSON.parse(content) as Walkthrough;

          // No repository specified - show for any repo
          if (!walkthrough.repository?.remote) {
            return true;
          }

          // No workspace remote - can't match, but show anyway for non-git workspaces
          if (!this.workspaceRemote) {
            return true;
          }

          // Compare normalized URLs
          const walkthroughRemote = normalizeRemoteUrl(walkthrough.repository.remote);
          const workspaceRemote = normalizeRemoteUrl(this.workspaceRemote);
          return walkthroughRemote === workspaceRemote;
        } catch {
          // If we can't parse the file, include it and let loadWalkthrough handle the error
          return true;
        }
      });
    } catch {
      return [];
    }
  }

  getCurrentFile(): string | undefined {
    return this.currentFile;
  }

  setWalkthroughFile(filename: string): void {
    this.currentFile = filename;
    this.currentStepIndex = -1;
    this.loadWalkthrough();
    this._onDidChangeTreeData.fire();
  }

  private loadWalkthrough(): void {
    let walkthroughFile = this.currentFile;

    if (!walkthroughFile) {
      const files = this.getAvailableWalkthroughs();
      walkthroughFile = files[0];
    }

    if (!walkthroughFile) {
      this.walkthrough = undefined;
      this.currentFile = undefined;
      return;
    }

    const walkthroughPath = path.join(this.workspaceRoot, walkthroughFile);

    if (!fs.existsSync(walkthroughPath)) {
      this.walkthrough = undefined;
      this.currentFile = undefined;
      return;
    }

    try {
      const content = fs.readFileSync(walkthroughPath, 'utf-8');
      this.walkthrough = JSON.parse(content) as Walkthrough;
      this.currentFile = walkthroughFile;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to parse ${walkthroughFile}`);
      this.walkthrough = undefined;
      this.currentFile = undefined;
    }
  }

  getWalkthrough(): Walkthrough | undefined {
    return this.walkthrough;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  goToStep(index: number): void {
    if (this.walkthrough && index >= 0 && index < this.walkthrough.steps.length) {
      this.currentStepIndex = index;
      this._onDidChangeTreeData.fire();
    }
  }

  nextStep(): void {
    if (this.walkthrough && this.currentStepIndex < this.walkthrough.steps.length - 1) {
      this.currentStepIndex++;
      this._onDidChangeTreeData.fire();
    }
  }

  prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: WalkthroughTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WalkthroughTreeItem): Thenable<WalkthroughTreeItem[]> {
    if (!this.walkthrough) {
      const available = this.getAvailableWalkthroughs();
      if (available.length === 0) {
        return Promise.resolve([
          new WalkthroughTreeItem(
            'No *.walkthrough.json files found',
            vscode.TreeItemCollapsibleState.None
          )
        ]);
      }
      const selectItem = new WalkthroughTreeItem(
        'Select a walkthrough...',
        vscode.TreeItemCollapsibleState.None
      );
      selectItem.command = {
        command: 'virgil.selectWalkthrough',
        title: 'Select Walkthrough'
      };
      selectItem.iconPath = new vscode.ThemeIcon('folder-opened');
      return Promise.resolve([selectItem]);
    }

    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    return Promise.resolve([]);
  }

  private getRootItems(): WalkthroughTreeItem[] {
    if (!this.walkthrough) {
      return [];
    }

    const items: WalkthroughTreeItem[] = [];

    // File selector (if multiple walkthroughs available)
    const available = this.getAvailableWalkthroughs();
    if (available.length > 1) {
      const fileItem = new WalkthroughTreeItem(
        this.currentFile || 'Select walkthrough',
        vscode.TreeItemCollapsibleState.None
      );
      fileItem.description = `(${available.length} available)`;
      fileItem.iconPath = new vscode.ThemeIcon('files');
      fileItem.command = {
        command: 'virgil.selectWalkthrough',
        title: 'Select Walkthrough'
      };
      fileItem.tooltip = 'Click to switch walkthrough';
      items.push(fileItem);
    }

    // Title as header
    const titleItem = new WalkthroughTreeItem(
      this.walkthrough.title,
      vscode.TreeItemCollapsibleState.None
    );
    if (this.walkthrough.description) {
      titleItem.description = this.walkthrough.description;
    }
    titleItem.iconPath = new vscode.ThemeIcon('book');
    items.push(titleItem);

    // Steps
    this.walkthrough.steps.forEach((step, index) => {
      const isCurrent = index === this.currentStepIndex;
      const hasLocation = !!step.location;

      const stepItem = new WalkthroughTreeItem(
        `${step.id}. ${step.title}`,
        vscode.TreeItemCollapsibleState.None,
        index
      );

      if (isCurrent) {
        stepItem.iconPath = new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('charts.green'));
        stepItem.description = '(current)';
      } else if (hasLocation) {
        stepItem.iconPath = new vscode.ThemeIcon('file-code');
      } else {
        stepItem.iconPath = new vscode.ThemeIcon('note');
      }

      items.push(stepItem);
    });

    return items;
  }
}
