import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Walkthrough, WalkthroughStep, Comment, parseLocation, getStepType } from './types';

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
  private workspaceCommit: string | undefined;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceRemote = this.getGitRemote();
    this.workspaceCommit = this.getGitCommit();
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

  private getGitCommit(): string | undefined {
    try {
      const commit = execSync('git rev-parse HEAD', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return commit || undefined;
    } catch {
      // Not a git repo
      return undefined;
    }
  }

  refreshGitState(): void {
    this.workspaceCommit = this.getGitCommit();
  }

  hasCommitMismatch(): boolean {
    if (!this.walkthrough?.repository?.commit) {
      return false; // No commit specified in walkthrough
    }
    if (!this.workspaceCommit) {
      return false; // Can't determine current commit
    }
    // Compare first 7 chars (short SHA) to handle partial matches
    const walkthroughCommit = this.walkthrough.repository.commit.substring(0, 40);
    const currentCommit = this.workspaceCommit.substring(0, 40);
    return walkthroughCommit !== currentCommit;
  }

  getCommitMismatchInfo(): { expected: string; current: string } | null {
    if (!this.hasCommitMismatch()) {
      return null;
    }
    return {
      expected: this.walkthrough!.repository!.commit!,
      current: this.workspaceCommit!
    };
  }

  getWalkthroughCommit(): string | undefined {
    return this.walkthrough?.repository?.commit;
  }

  isWorkingTreeDirty(): boolean {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return status.length > 0;
    } catch {
      return false;
    }
  }

  checkoutCommit(commit: string): { success: boolean; error?: string } {
    try {
      execSync(`git checkout ${commit}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.workspaceCommit = this.getGitCommit();
      this._onDidChangeTreeData.fire();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  stashChanges(): { success: boolean; error?: string } {
    try {
      execSync('git stash', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  refresh(): void {
    this.loadWalkthrough();
    this._onDidChangeTreeData.fire();
  }

  getAvailableWalkthroughs(): string[] {
    const walkthroughFiles: string[] = [];

    try {
      // Check for .walkthrough.json at root
      const rootWalkthroughPath = path.join(this.workspaceRoot, '.walkthrough.json');
      if (fs.existsSync(rootWalkthroughPath)) {
        walkthroughFiles.push('.walkthrough.json');
      }
    } catch {
      // Ignore errors
    }

    try {
      // Check for all .json files in walkthroughs/ directory
      const walkthroughsDir = path.join(this.workspaceRoot, 'walkthroughs');
      if (fs.existsSync(walkthroughsDir) && fs.statSync(walkthroughsDir).isDirectory()) {
        const files = fs.readdirSync(walkthroughsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        for (const jsonFile of jsonFiles) {
          walkthroughFiles.push(path.join('walkthroughs', jsonFile));
        }
      }
    } catch {
      // Ignore errors
    }

    return walkthroughFiles;
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

  hasGitUserName(): boolean {
    try {
      const name = execSync('git config user.name', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return name.length > 0;
    } catch {
      return false;
    }
  }

  getGitUserName(): string {
    try {
      const name = execSync('git config user.name', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      return name || 'Anonymous';
    } catch {
      return 'Anonymous';
    }
  }

  setGitUserName(name: string): { success: boolean; error?: string } {
    try {
      execSync(`git config user.name "${name.replace(/"/g, '\\"')}"`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  addComment(stepIndex: number, body: string): boolean {
    if (!this.walkthrough || !this.currentFile) {
      return false;
    }

    if (stepIndex < 0 || stepIndex >= this.walkthrough.steps.length) {
      return false;
    }

    const step = this.walkthrough.steps[stepIndex];
    if (!step.comments) {
      step.comments = [];
    }

    const comment: Comment = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      author: this.getGitUserName(),
      body: body
    };

    step.comments.push(comment);

    // Save to file
    try {
      const walkthroughPath = path.join(this.workspaceRoot, this.currentFile);
      fs.writeFileSync(walkthroughPath, JSON.stringify(this.walkthrough, null, 2));
      this._onDidChangeTreeData.fire();
      return true;
    } catch (error) {
      vscode.window.showErrorMessage('Failed to save comment');
      return false;
    }
  }

  getTreeItem(element: WalkthroughTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WalkthroughTreeItem): Thenable<WalkthroughTreeItem[]> {
    if (!this.walkthrough) {
      const available = this.getAvailableWalkthroughs();
      if (available.length === 0) {
        const selectItem = new WalkthroughTreeItem(
          '$(folder-opened) Select a walkthrough file...',
          vscode.TreeItemCollapsibleState.None
        );
        selectItem.command = {
          command: 'virgil.selectWalkthrough',
          title: 'Select Walkthrough'
        };
        selectItem.iconPath = new vscode.ThemeIcon('folder-opened');
        selectItem.tooltip = 'Select a walkthrough file (JSON or Markdown)';
        selectItem.description = 'No walkthrough files found';
        return Promise.resolve([selectItem]);
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
      selectItem.tooltip = 'Select a walkthrough file (JSON or Markdown)';
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

    // File selector (always show to allow selecting/adding walkthroughs)
    const available = this.getAvailableWalkthroughs();
    const fileItem = new WalkthroughTreeItem(
      this.currentFile || 'Select walkthrough',
      vscode.TreeItemCollapsibleState.None
    );
    if (available.length > 1) {
      fileItem.description = `(${available.length} available)`;
    } else if (available.length === 1) {
      fileItem.description = '(1 available)';
    } else {
      fileItem.description = '(0 available)';
    }
    fileItem.iconPath = new vscode.ThemeIcon('files');
    fileItem.command = {
      command: 'virgil.selectWalkthrough',
      title: 'Select Walkthrough'
    };
    fileItem.tooltip = available.length > 1
      ? 'Click to switch walkthrough or select a file'
      : 'Click to select a walkthrough file (JSON or Markdown)';
    items.push(fileItem);

    // Title as header (with warning if commit mismatch)
    const hasMismatch = this.hasCommitMismatch();
    const titleItem = new WalkthroughTreeItem(
      this.walkthrough.title,
      vscode.TreeItemCollapsibleState.None
    );
    if (hasMismatch) {
      const mismatchInfo = this.getCommitMismatchInfo();
      titleItem.description = '⚠️ commit mismatch';
      titleItem.tooltip = `Walkthrough expects commit ${mismatchInfo?.expected.substring(0, 7)}...\nCurrent commit: ${mismatchInfo?.current.substring(0, 7)}...\n\nCode may have changed since this walkthrough was created.`;
      titleItem.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    } else {
      if (this.walkthrough.description) {
        titleItem.description = this.walkthrough.description;
      }
      titleItem.iconPath = new vscode.ThemeIcon('book');
    }
    items.push(titleItem);

    // Check if repository has a base reference configured
    const hasBaseRef = !!(
      this.walkthrough.repository?.baseCommit ||
      this.walkthrough.repository?.baseBranch ||
      this.walkthrough.repository?.pr
    );

    // Steps
    this.walkthrough.steps.forEach((step, index) => {
      const isCurrent = index === this.currentStepIndex;
      const stepType = getStepType(step);

      const stepItem = new WalkthroughTreeItem(
        `${step.id}. ${step.title}`,
        vscode.TreeItemCollapsibleState.None,
        index
      );

      if (isCurrent) {
        stepItem.iconPath = new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('charts.green'));
        stepItem.description = '(current)';
      } else {
        // Set icon based on step type
        switch (stepType) {
          case 'diff':
            stepItem.iconPath = new vscode.ThemeIcon('git-compare');
            if (!hasBaseRef) {
              stepItem.description = '⚠️ no base ref';
            }
            break;
          case 'base-only':
            stepItem.iconPath = new vscode.ThemeIcon('history', new vscode.ThemeColor('charts.red'));
            if (!hasBaseRef) {
              stepItem.description = '⚠️ no base ref';
            }
            break;
          case 'point-in-time':
            stepItem.iconPath = new vscode.ThemeIcon('file-code');
            break;
          case 'informational':
          default:
            stepItem.iconPath = new vscode.ThemeIcon('note');
            break;
        }
      }

      items.push(stepItem);
    });

    return items;
  }
}
