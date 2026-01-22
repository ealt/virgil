import * as vscode from 'vscode';
import { Walkthrough, WalkthroughStep } from './types';

export class StepDetailPanel {
  public static currentPanel: StepDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  public static showStep(extensionUri: vscode.Uri, step: WalkthroughStep, currentIndex: number, totalSteps: number): void {
    const panel = StepDetailPanel.getOrCreate(extensionUri);
    panel.showStepContent(step, currentIndex, totalSteps);
  }

  public static showOverview(extensionUri: vscode.Uri, walkthrough: Walkthrough): void {
    const panel = StepDetailPanel.getOrCreate(extensionUri);
    panel.showOverviewContent(walkthrough);
  }

  public static showSummary(extensionUri: vscode.Uri, walkthrough: Walkthrough): void {
    const panel = StepDetailPanel.getOrCreate(extensionUri);
    panel.showSummaryContent(walkthrough);
  }

  private static getOrCreate(extensionUri: vscode.Uri): StepDetailPanel {
    if (!StepDetailPanel.currentPanel) {
      StepDetailPanel.currentPanel = new StepDetailPanel(extensionUri);
    }
    return StepDetailPanel.currentPanel;
  }

  private constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;

    this.panel = vscode.window.createWebviewPanel(
      'virgilStepDetail',
      'Virgil: Step Details',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'next':
            vscode.commands.executeCommand('virgil.next');
            break;
          case 'prev':
            vscode.commands.executeCommand('virgil.prev');
            break;
          case 'start':
            vscode.commands.executeCommand('virgil.start');
            break;
          case 'openLocation':
            vscode.commands.executeCommand(
              'virgil.openLocation',
              message.path,
              message.startLine,
              message.endLine
            );
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private showStepContent(step: WalkthroughStep, currentIndex: number, totalSteps: number): void {
    this.panel.title = `Step ${currentIndex + 1}: ${step.title}`;
    this.panel.webview.html = this.getStepHtml(step, currentIndex, totalSteps);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private showOverviewContent(walkthrough: Walkthrough): void {
    this.panel.title = `Overview: ${walkthrough.title}`;
    this.panel.webview.html = this.getOverviewHtml(walkthrough);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private showSummaryContent(walkthrough: Walkthrough): void {
    this.panel.title = `Summary: ${walkthrough.title}`;
    this.panel.webview.html = this.getSummaryHtml(walkthrough);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private getBaseStyles(): string {
    return `
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: var(--vscode-editor-foreground);
    }
    .description {
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
    .section {
      margin-bottom: 20px;
    }
    h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--vscode-descriptionForeground);
    }
    .item {
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .location {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .location:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .location-icon { margin-right: 8px; }
    .location-path { color: var(--vscode-textLink-foreground); flex: 1; }
    .location-lines { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .notes-list, .takeaways-list {
      margin: 0;
      padding-left: 20px;
    }
    .notes-list li, .takeaways-list li {
      margin-bottom: 6px;
      color: var(--vscode-editor-foreground);
    }
    .recommendation {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .recommendation.approve { background-color: #28a745; color: white; }
    .recommendation.request-changes { background-color: #dc3545; color: white; }
    .recommendation.comment { background-color: #6c757d; color: white; }
    .navigation {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    button {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      transition: background-color 0.15s;
    }
    button:hover:not(:disabled) { background-color: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover:not(:disabled) { background-color: var(--vscode-button-secondaryHoverBackground); }
    `;
  }

  private getOverviewHtml(walkthrough: Walkthrough): string {
    const contextHtml = walkthrough.context ? `
      <div class="section">
        <h3>Context</h3>
        <div class="item">
          <strong>Type:</strong> ${this.escapeHtml(walkthrough.context.type)}
          ${walkthrough.context.pr ? `<br><strong>PR:</strong> <a href="${walkthrough.context.pr.url}">#${walkthrough.context.pr.number}</a>` : ''}
        </div>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Overview</title>
  <style>${this.getBaseStyles()}</style>
</head>
<body>
  <div class="header">
    <span class="label">Overview</span>
  </div>

  <h1 class="title">${this.escapeHtml(walkthrough.title)}</h1>
  <p class="description">${this.escapeHtml(walkthrough.description)}</p>

  <div class="section">
    <h3>Purpose</h3>
    <div class="item">${this.escapeHtml(walkthrough.overview.purpose)}</div>
  </div>

  <div class="section">
    <h3>Scope</h3>
    <div class="item">${this.escapeHtml(walkthrough.overview.scope)}</div>
  </div>

  ${contextHtml}

  <div class="section">
    <h3>Details</h3>
    <div class="item">
      <strong>Author:</strong> ${this.escapeHtml(walkthrough.author)}<br>
      <strong>Created:</strong> ${new Date(walkthrough.created).toLocaleDateString()}<br>
      <strong>Steps:</strong> ${walkthrough.steps.length}
    </div>
  </div>

  <div class="navigation">
    <button onclick="vscode.postMessage({command: 'start'})">
      Start Walkthrough →
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
  }

  private getSummaryHtml(walkthrough: Walkthrough): string {
    const recClass = walkthrough.summary.recommendation || 'none';
    const recHtml = walkthrough.summary.recommendation && walkthrough.summary.recommendation !== 'none' ? `
      <div class="section">
        <h3>Recommendation</h3>
        <span class="recommendation ${recClass}">${walkthrough.summary.recommendation}</span>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Summary</title>
  <style>${this.getBaseStyles()}</style>
</head>
<body>
  <div class="header">
    <span class="label">Summary</span>
  </div>

  <h1 class="title">${this.escapeHtml(walkthrough.title)}</h1>

  <div class="section">
    <h3>Key Takeaways</h3>
    <ul class="takeaways-list">
      ${walkthrough.summary.keyTakeaways.map(t => `<li>${this.escapeHtml(t)}</li>`).join('')}
    </ul>
  </div>

  ${recHtml}

  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
  }

  private getStepHtml(step: WalkthroughStep, currentIndex: number, totalSteps: number): string {
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'panel.css')
    );

    const locationsHtml = step.locations.map(loc => `
      <div class="location" onclick="openLocation('${loc.path}', ${loc.startLine}, ${loc.endLine})">
        <span class="location-icon">📄</span>
        <span class="location-path">${loc.path}</span>
        <span class="location-lines">:${loc.startLine}-${loc.endLine}</span>
      </div>
    `).join('');

    const notesHtml = step.notes && step.notes.length > 0
      ? `
        <div class="notes-section">
          <h3>Notes</h3>
          <ul class="notes-list">
            ${step.notes.map(note => `<li>${this.escapeHtml(note)}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    const isFirst = currentIndex === 0;
    const isLast = currentIndex === totalSteps - 1;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Step Details</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .step-counter {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: var(--vscode-editor-foreground);
    }

    .description {
      margin-bottom: 20px;
      white-space: pre-wrap;
    }

    .locations-section, .notes-section {
      margin-bottom: 20px;
    }

    h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--vscode-descriptionForeground);
    }

    .location {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .location:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .location-icon {
      margin-right: 8px;
    }

    .location-path {
      color: var(--vscode-textLink-foreground);
      flex: 1;
    }

    .location-lines {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .notes-list {
      margin: 0;
      padding-left: 20px;
    }

    .notes-list li {
      margin-bottom: 6px;
      color: var(--vscode-editor-foreground);
    }

    .navigation {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    button {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      transition: background-color 0.15s;
    }

    button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="step-counter">Step ${currentIndex + 1} of ${totalSteps}</span>
  </div>

  <h1 class="title">${this.escapeHtml(step.title)}</h1>

  <div class="description">${this.escapeHtml(step.description)}</div>

  <div class="locations-section">
    <h3>Locations</h3>
    ${locationsHtml}
  </div>

  ${notesHtml}

  <div class="navigation">
    <button class="secondary" onclick="navigate('prev')" ${isFirst ? 'disabled' : ''}>
      ← Previous
    </button>
    <button onclick="navigate('next')" ${isLast ? 'disabled' : ''}>
      Next →
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function navigate(direction) {
      vscode.postMessage({ command: direction });
    }

    function openLocation(path, startLine, endLine) {
      vscode.postMessage({
        command: 'openLocation',
        path: path,
        startLine: startLine,
        endLine: endLine
      });
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }

  public dispose(): void {
    StepDetailPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
