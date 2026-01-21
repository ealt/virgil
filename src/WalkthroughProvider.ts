import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Walkthrough, WalkthroughStep } from './types';

export class WalkthroughTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly stepIndex?: number,
    public readonly itemType?: 'overview' | 'step' | 'summary' | 'location'
  ) {
    super(label, collapsibleState);

    if (itemType === 'step' && stepIndex !== undefined) {
      this.command = {
        command: 'virgil.goToStep',
        title: 'Go to Step',
        arguments: [stepIndex]
      };
      this.contextValue = 'step';
    }
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

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.loadWalkthrough();
  }

  refresh(): void {
    this.loadWalkthrough();
    this._onDidChangeTreeData.fire();
  }

  getAvailableWalkthroughs(): string[] {
    try {
      const files = fs.readdirSync(this.workspaceRoot);
      return files.filter(f => f.endsWith('.walkthrough.json'));
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
    // Use current file if set, otherwise find first available
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
      // Show available walkthroughs to select
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
      // Root level
      return Promise.resolve(this.getRootItems());
    }

    // Child items
    if (element.itemType === 'overview') {
      return Promise.resolve(this.getOverviewItems());
    }

    if (element.itemType === 'summary') {
      return Promise.resolve(this.getSummaryItems());
    }

    if (element.itemType === 'step' && element.stepIndex !== undefined) {
      return Promise.resolve(this.getStepDetails(element.stepIndex));
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
    titleItem.description = this.walkthrough.description;
    titleItem.iconPath = new vscode.ThemeIcon('book');
    items.push(titleItem);

    // Overview section
    const overviewItem = new WalkthroughTreeItem(
      'Overview',
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      'overview'
    );
    overviewItem.iconPath = new vscode.ThemeIcon('info');
    items.push(overviewItem);

    // Steps
    this.walkthrough.steps.forEach((step, index) => {
      const isCurrent = index === this.currentStepIndex;
      const stepItem = new WalkthroughTreeItem(
        `${index + 1}. ${step.title}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        index,
        'step'
      );

      if (isCurrent) {
        stepItem.iconPath = new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('charts.green'));
        stepItem.description = '(current)';
      } else {
        stepItem.iconPath = new vscode.ThemeIcon('circle-outline');
      }

      items.push(stepItem);
    });

    // Summary section
    const summaryItem = new WalkthroughTreeItem(
      'Summary',
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      'summary'
    );
    summaryItem.iconPath = new vscode.ThemeIcon('checklist');
    items.push(summaryItem);

    return items;
  }

  private getOverviewItems(): WalkthroughTreeItem[] {
    if (!this.walkthrough) {
      return [];
    }

    const items: WalkthroughTreeItem[] = [];

    // Purpose
    const purposeItem = new WalkthroughTreeItem(
      'Purpose',
      vscode.TreeItemCollapsibleState.None
    );
    purposeItem.description = this.walkthrough.overview.purpose;
    purposeItem.tooltip = this.walkthrough.overview.purpose;
    items.push(purposeItem);

    // Scope
    const scopeItem = new WalkthroughTreeItem(
      'Scope',
      vscode.TreeItemCollapsibleState.None
    );
    scopeItem.description = this.walkthrough.overview.scope;
    scopeItem.tooltip = this.walkthrough.overview.scope;
    items.push(scopeItem);

    // Context if available
    if (this.walkthrough.context) {
      const contextItem = new WalkthroughTreeItem(
        'Type',
        vscode.TreeItemCollapsibleState.None
      );
      contextItem.description = this.walkthrough.context.type;

      if (this.walkthrough.context.pr) {
        const prItem = new WalkthroughTreeItem(
          `PR #${this.walkthrough.context.pr.number}`,
          vscode.TreeItemCollapsibleState.None
        );
        prItem.tooltip = this.walkthrough.context.pr.url;
        items.push(prItem);
      }

      items.push(contextItem);
    }

    return items;
  }

  private getStepDetails(stepIndex: number): WalkthroughTreeItem[] {
    if (!this.walkthrough || stepIndex >= this.walkthrough.steps.length) {
      return [];
    }

    const step = this.walkthrough.steps[stepIndex];
    const items: WalkthroughTreeItem[] = [];

    // Locations
    step.locations.forEach((loc) => {
      const locItem = new WalkthroughTreeItem(
        `${path.basename(loc.path)}:${loc.startLine}-${loc.endLine}`,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        'location'
      );
      locItem.description = loc.path;
      locItem.iconPath = new vscode.ThemeIcon('file-code');
      locItem.command = {
        command: 'virgil.openLocation',
        title: 'Open Location',
        arguments: [loc.path, loc.startLine, loc.endLine]
      };
      locItem.tooltip = `${loc.path} (lines ${loc.startLine}-${loc.endLine})`;
      items.push(locItem);
    });

    // Notes
    if (step.notes && step.notes.length > 0) {
      step.notes.forEach((note, i) => {
        const noteItem = new WalkthroughTreeItem(
          note,
          vscode.TreeItemCollapsibleState.None
        );
        noteItem.iconPath = new vscode.ThemeIcon('note');
        noteItem.tooltip = note;
        items.push(noteItem);
      });
    }

    return items;
  }

  private getSummaryItems(): WalkthroughTreeItem[] {
    if (!this.walkthrough) {
      return [];
    }

    const items: WalkthroughTreeItem[] = [];

    // Key takeaways
    this.walkthrough.summary.keyTakeaways.forEach((takeaway, i) => {
      const item = new WalkthroughTreeItem(
        takeaway,
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon('lightbulb');
      item.tooltip = takeaway;
      items.push(item);
    });

    // Recommendation
    if (this.walkthrough.summary.recommendation && this.walkthrough.summary.recommendation !== 'none') {
      const recItem = new WalkthroughTreeItem(
        `Recommendation: ${this.walkthrough.summary.recommendation}`,
        vscode.TreeItemCollapsibleState.None
      );

      const iconMap: Record<string, string> = {
        'approve': 'check',
        'request-changes': 'request-changes',
        'comment': 'comment'
      };
      recItem.iconPath = new vscode.ThemeIcon(iconMap[this.walkthrough.summary.recommendation] || 'info');
      items.push(recItem);
    }

    return items;
  }
}
