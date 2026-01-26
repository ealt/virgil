import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Walkthrough,
  WalkthroughStep,
  Comment,
  getStepType,
  StepTreeNode,
  buildStepTree,
  flattenStepTree,
  StepNavigationContext,
  buildNavigationMap,
  getFileTypeIcon,
} from './types';

export class WalkthroughTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly stepIndex?: number,
    public readonly node?: StepTreeNode
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
  private stepTree: StepTreeNode[] = [];
  private flatSteps: WalkthroughStep[] = [];
  private navigationMap: Map<number, StepNavigationContext> = new Map();

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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
      current: this.workspaceCommit!,
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
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
      this.stepTree = [];
      this.flatSteps = [];
      this.navigationMap = new Map();
      return;
    }

    const walkthroughPath = path.join(this.workspaceRoot, walkthroughFile);

    if (!fs.existsSync(walkthroughPath)) {
      this.walkthrough = undefined;
      this.currentFile = undefined;
      this.stepTree = [];
      this.flatSteps = [];
      this.navigationMap = new Map();
      return;
    }

    try {
      const content = fs.readFileSync(walkthroughPath, 'utf-8');
      this.walkthrough = JSON.parse(content) as Walkthrough;
      this.currentFile = walkthroughFile;

      // Build tree structure from flat steps
      this.stepTree = buildStepTree(this.walkthrough.steps);
      // Flatten tree in depth-first order for navigation
      this.flatSteps = flattenStepTree(this.stepTree);
      // Build navigation map for hierarchical navigation
      this.navigationMap = buildNavigationMap(this.stepTree, this.flatSteps);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to parse ${walkthroughFile}`);
      this.walkthrough = undefined;
      this.currentFile = undefined;
      this.stepTree = [];
      this.flatSteps = [];
      this.navigationMap = new Map();
    }
  }

  getWalkthrough(): Walkthrough | undefined {
    return this.walkthrough;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  goToStep(index: number): void {
    if (this.walkthrough && index >= 0 && index < this.flatSteps.length) {
      this.currentStepIndex = index;
      this._onDidChangeTreeData.fire();
    }
  }

  nextStep(): void {
    if (this.walkthrough && this.currentStepIndex < this.flatSteps.length - 1) {
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

  // Get total number of steps (for navigation)
  getTotalSteps(): number {
    return this.flatSteps.length;
  }

  // Get step at current index
  getCurrentStep(): WalkthroughStep | undefined {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.flatSteps.length) {
      return this.flatSteps[this.currentStepIndex];
    }
    return undefined;
  }

  /**
   * Generates a slug from a step title (GitHub-style anchor)
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .trim();
  }

  /**
   * Returns a map from anchor slug to step index for step linking
   */
  getStepAnchorMap(): Map<string, number> {
    const map = new Map<string, number>();
    this.flatSteps.forEach((step, index) => {
      const anchor = this.slugify(step.title);
      if (!map.has(anchor)) {
        map.set(anchor, index);
      }
      // Note: Duplicate anchors use first match (same as markdown behavior)
    });
    return map;
  }

  // Hierarchical navigation methods

  canGoToParent(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    return nav?.parentIndex !== null && nav?.parentIndex !== undefined;
  }

  canGoToNextSibling(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    return nav?.nextSiblingIndex !== null && nav?.nextSiblingIndex !== undefined;
  }

  canGoToPrevSibling(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    return nav?.prevSiblingIndex !== null && nav?.prevSiblingIndex !== undefined;
  }

  goToParent(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    if (nav?.parentIndex !== null && nav?.parentIndex !== undefined) {
      this.currentStepIndex = nav.parentIndex;
      this._onDidChangeTreeData.fire();
      return true;
    }
    return false;
  }

  goToNextSibling(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    if (nav?.nextSiblingIndex !== null && nav?.nextSiblingIndex !== undefined) {
      this.currentStepIndex = nav.nextSiblingIndex;
      this._onDidChangeTreeData.fire();
      return true;
    }
    return false;
  }

  goToPrevSibling(): boolean {
    const nav = this.navigationMap.get(this.currentStepIndex);
    if (nav?.prevSiblingIndex !== null && nav?.prevSiblingIndex !== undefined) {
      this.currentStepIndex = nav.prevSiblingIndex;
      this._onDidChangeTreeData.fire();
      return true;
    }
    return false;
  }

  hasGitUserName(): boolean {
    try {
      const name = execSync('git config user.name', {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
        stdio: ['pipe', 'pipe', 'pipe'],
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
      body: body,
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
          title: 'Select Walkthrough',
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
        title: 'Select Walkthrough',
      };
      selectItem.iconPath = new vscode.ThemeIcon('folder-opened');
      selectItem.tooltip = 'Select a walkthrough file (JSON or Markdown)';
      return Promise.resolve([selectItem]);
    }

    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    // Return children from the tree node
    if (element.node?.children?.length) {
      return Promise.resolve(element.node.children.map((child) => this.createStepTreeItem(child)));
    }

    return Promise.resolve([]);
  }

  private createStepTreeItem(node: StepTreeNode): WalkthroughTreeItem {
    const step = node.step;
    // Find the index of this step in the flat array for navigation
    const stepIndex = this.flatSteps.findIndex((s) => s.id === step.id);
    const isCurrent = stepIndex === this.currentStepIndex;
    const stepType = getStepType(step);

    // Check if repository has a base reference configured
    const hasBaseRef = !!(
      this.walkthrough?.repository?.baseCommit ||
      this.walkthrough?.repository?.baseBranch ||
      this.walkthrough?.repository?.pr
    );

    // Determine collapsible state based on children
    const hasChildren = node.children.length > 0;
    const collapsibleState = hasChildren
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;

    const stepItem = new WalkthroughTreeItem(
      `${step.id}. ${step.title}`,
      collapsibleState,
      stepIndex,
      node
    );

    if (isCurrent) {
      stepItem.iconPath = new vscode.ThemeIcon(
        'arrow-right',
        new vscode.ThemeColor('charts.green')
      );
      stepItem.description = '(current)';
    } else {
      // Get file-type specific icon
      const locationPath = step.location?.split(':')[0] || step.base_location?.split(':')[0];
      const fileIcon = locationPath ? getFileTypeIcon(locationPath) : 'file-code';

      // Set icon based on step type
      switch (stepType) {
        case 'diff':
          // Use file icon for recognized types, otherwise git-compare
          stepItem.iconPath = new vscode.ThemeIcon(
            fileIcon !== 'file-code' ? fileIcon : 'git-compare'
          );
          if (!hasBaseRef) {
            stepItem.description = '⚠️ no base ref';
          }
          break;
        case 'base-only':
          stepItem.iconPath = new vscode.ThemeIcon(
            fileIcon !== 'file-code' ? fileIcon : 'history',
            fileIcon === 'file-code' ? new vscode.ThemeColor('charts.red') : undefined
          );
          if (!hasBaseRef) {
            stepItem.description = '⚠️ no base ref';
          }
          break;
        case 'point-in-time':
          stepItem.iconPath = new vscode.ThemeIcon(fileIcon);
          break;
        case 'informational':
        default:
          stepItem.iconPath = new vscode.ThemeIcon('note');
          break;
      }
    }

    return stepItem;
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
      title: 'Select Walkthrough',
    };
    fileItem.tooltip =
      available.length > 1
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
      titleItem.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('editorWarning.foreground')
      );
    } else {
      if (this.walkthrough.description) {
        titleItem.description = this.walkthrough.description;
      }
      titleItem.iconPath = new vscode.ThemeIcon('book');
    }
    items.push(titleItem);

    // Steps - use tree structure for hierarchical display
    for (const node of this.stepTree) {
      items.push(this.createStepTreeItem(node));
    }

    return items;
  }
}
