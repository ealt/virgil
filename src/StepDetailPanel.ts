import * as vscode from 'vscode';
import { Walkthrough, WalkthroughStep, parseLocation } from './types';

export class StepDetailPanel {
  public static currentPanel: StepDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  public static show(
    extensionUri: vscode.Uri,
    walkthrough: Walkthrough,
    step: WalkthroughStep,
    currentIndex: number,
    totalSteps: number
  ): void {
    const panel = StepDetailPanel.getOrCreate(extensionUri);
    panel.render(walkthrough, step, currentIndex, totalSteps);
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
      'Virgil',
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
            vscode.commands.executeCommand('virgil.openLocation', message.location);
            break;
          case 'submitComment':
            vscode.commands.executeCommand('virgil.submitComment', message.text);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private render(walkthrough: Walkthrough, step: WalkthroughStep, currentIndex: number, totalSteps: number): void {
    this.panel.title = `${step.id}. ${step.title}`;
    this.panel.webview.html = this.getHtml(walkthrough, step, currentIndex, totalSteps);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private getHtml(walkthrough: Walkthrough, step: WalkthroughStep, currentIndex: number, totalSteps: number): string {
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === totalSteps - 1;

    // Parse location if present
    const parsedLocation = step.location ? parseLocation(step.location) : null;

    const locationHtml = parsedLocation ? `
      <div class="location" onclick="openLocation('${step.location}')">
        <span class="location-path">${parsedLocation.path}</span>
        <span class="location-lines">:${parsedLocation.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',')}</span>
      </div>
    ` : '';

    // Render metadata if this is the first step and metadata exists
    const metadataHtml = currentIndex === 0 && walkthrough.metadata && Object.keys(walkthrough.metadata).length > 0 ? `
      <div class="metadata">
        ${Object.entries(walkthrough.metadata).map(([key, value]) =>
          `<span class="metadata-item"><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(String(value))}</span>`
        ).join('')}
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>${step.title}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
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
    .metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      font-size: 12px;
    }
    .metadata-item {
      color: var(--vscode-descriptionForeground);
    }
    .body {
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
    .location {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 20px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .location:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .location-path {
      color: var(--vscode-textLink-foreground);
    }
    .location-lines {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
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
    .comments-section {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .comments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .comments-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
    }
    .add-comment-btn {
      flex: none;
      padding: 4px 12px;
      font-size: 12px;
    }
    .comment {
      padding: 10px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .comment-author {
      font-weight: 600;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 4px;
    }
    .comment-body {
      font-size: 13px;
      white-space: pre-wrap;
    }
    .no-comments {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      margin-bottom: 12px;
    }
    .comment-form {
      margin-top: 12px;
    }
    .comment-input {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      resize: vertical;
      box-sizing: border-box;
    }
    .comment-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    .comment-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .comment-form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .submit-comment-btn {
      flex: none;
      padding: 6px 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="step-counter">Step ${currentIndex + 1} of ${totalSteps}</span>
  </div>

  <h1 class="title">${this.escapeHtml(step.title)}</h1>

  ${metadataHtml}

  ${locationHtml}

  ${step.body ? `<div class="body">${this.escapeHtml(step.body)}</div>` : ''}

  <div class="comments-section">
    <div class="comments-header">
      <span class="comments-title">Comments${step.comments?.length ? ` (${step.comments.length})` : ''}</span>
    </div>
    ${step.comments && step.comments.length > 0
      ? step.comments.map(comment => `
        <div class="comment">
          <div class="comment-author">${this.escapeHtml(comment.author)}</div>
          <div class="comment-body">${this.escapeHtml(comment.body)}</div>
        </div>
      `).join('')
      : '<div class="no-comments">No comments yet</div>'
    }
    <div class="comment-form">
      <textarea id="commentInput" class="comment-input" placeholder="Add a comment..."></textarea>
      <div class="comment-form-actions">
        <button class="submit-comment-btn" onclick="submitComment()">Add Comment</button>
      </div>
    </div>
  </div>

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

    function openLocation(location) {
      vscode.postMessage({ command: 'openLocation', location: location });
    }

    function submitComment() {
      const input = document.getElementById('commentInput');
      const text = input.value.trim();
      if (text) {
        vscode.postMessage({ command: 'submitComment', text: text });
        input.value = '';
      }
    }

    // Allow Ctrl+Enter / Cmd+Enter to submit
    document.getElementById('commentInput').addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        submitComment();
      }
    });
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
