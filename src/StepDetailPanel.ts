import * as vscode from 'vscode';
import { WalkthroughStep } from './types';

export class StepDetailPanel {
  public static currentPanel: StepDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, step: WalkthroughStep, currentIndex: number, totalSteps: number): void {
    // If panel exists and is not disposed, reuse it
    if (StepDetailPanel.currentPanel) {
      StepDetailPanel.currentPanel.show(step, currentIndex, totalSteps);
      return;
    }

    // Create new panel
    StepDetailPanel.currentPanel = new StepDetailPanel(extensionUri);
    StepDetailPanel.currentPanel.show(step, currentIndex, totalSteps);
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

  private show(step: WalkthroughStep, currentIndex: number, totalSteps: number): void {
    this.panel.title = `Step ${currentIndex + 1}: ${step.title}`;
    this.panel.webview.html = this.getWebviewContent(step, currentIndex, totalSteps);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private getWebviewContent(step: WalkthroughStep, currentIndex: number, totalSteps: number): string {
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
