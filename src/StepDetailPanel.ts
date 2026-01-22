import * as vscode from 'vscode';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import { Walkthrough, WalkthroughStep, parseLocation, ViewMode, StepType } from './types';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

// Configure marked with syntax highlighting
const markedInstance = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return code;
    }
  })
);

markedInstance.setOptions({
  breaks: true,  // Convert \n to <br>
});

export interface DiffModeOptions {
  stepType: StepType;
  viewMode: ViewMode;
  baseCommit?: string;
  headCommit?: string;
  error?: string;
}

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
    totalSteps: number,
    diffOptions?: DiffModeOptions
  ): void {
    const panel = StepDetailPanel.getOrCreate(extensionUri);
    panel.render(walkthrough, step, currentIndex, totalSteps, diffOptions);
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
          case 'setViewMode':
            vscode.commands.executeCommand('virgil.setViewMode', message.mode);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private render(
    walkthrough: Walkthrough,
    step: WalkthroughStep,
    currentIndex: number,
    totalSteps: number,
    diffOptions?: DiffModeOptions
  ): void {
    this.panel.title = `${step.id}. ${step.title}`;
    this.panel.webview.html = this.getHtml(walkthrough, step, currentIndex, totalSteps, diffOptions);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  private getHtml(
    walkthrough: Walkthrough,
    step: WalkthroughStep,
    currentIndex: number,
    totalSteps: number,
    diffOptions?: DiffModeOptions
  ): string {
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === totalSteps - 1;
    const stepType = diffOptions?.stepType || 'point-in-time';
    const viewMode = diffOptions?.viewMode || 'diff';

    // Parse locations if present
    const parsedLocation = step.location ? parseLocation(step.location) : null;
    const parsedBaseLocation = step.base_location ? parseLocation(step.base_location) : null;

    // Build location display
    let locationHtml = '';
    if (diffOptions?.error) {
      // Show error message
      locationHtml = `
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <span>${this.escapeHtml(diffOptions.error)}</span>
        </div>
        ${parsedLocation ? `
          <div class="location fallback" onclick="openLocation('${step.location}')">
            <span class="location-label">View Current File:</span>
            <span class="location-path">${parsedLocation.path}</span>
            <span class="location-lines">:${parsedLocation.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',')}</span>
          </div>
        ` : ''}
      `;
    } else if (stepType === 'diff') {
      // Diff mode with 3-way toggle
      locationHtml = `
        <div class="view-toggle">
          <span class="toggle-label">View:</span>
          <button class="toggle-btn ${viewMode === 'diff' ? 'active' : ''}" onclick="setViewMode('diff')">Diff</button>
          <button class="toggle-btn head ${viewMode === 'head' ? 'active' : ''}" onclick="setViewMode('head')">Head</button>
          <button class="toggle-btn base ${viewMode === 'base' ? 'active' : ''}" onclick="setViewMode('base')">Base</button>
        </div>
        <div class="location-info">
          ${viewMode === 'diff' || viewMode === 'head' ? `
            <div class="location head-location">
              <span class="location-indicator head">●</span>
              <span class="location-path">${parsedLocation?.path || ''}</span>
              <span class="location-lines">:${parsedLocation?.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',') || ''}</span>
            </div>
          ` : ''}
          ${viewMode === 'diff' || viewMode === 'base' ? `
            <div class="location base-location">
              <span class="location-indicator base">●</span>
              <span class="location-path">${parsedBaseLocation?.path || ''}</span>
              <span class="location-lines">:${parsedBaseLocation?.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',') || ''}</span>
              <span class="location-suffix">(base)</span>
            </div>
          ` : ''}
        </div>
      `;
    } else if (stepType === 'base-only') {
      // Base-only step
      locationHtml = parsedBaseLocation ? `
        <div class="location base-only" onclick="openLocation('${step.base_location}')">
          <span class="location-indicator base">●</span>
          <span class="location-path">${parsedBaseLocation.path}</span>
          <span class="location-lines">:${parsedBaseLocation.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',')}</span>
          <span class="location-suffix">(base)</span>
        </div>
      ` : '';
    } else if (stepType === 'point-in-time') {
      // Point-in-time step (existing behavior)
      locationHtml = parsedLocation ? `
        <div class="location" onclick="openLocation('${step.location}')">
          <span class="location-path">${parsedLocation.path}</span>
          <span class="location-lines">:${parsedLocation.ranges.map(r => r.startLine === r.endLine ? r.startLine : `${r.startLine}-${r.endLine}`).join(',')}</span>
        </div>
      ` : '';
    }

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
    }

    /* View toggle for diff mode */
    .view-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toggle-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .toggle-btn {
      padding: 4px 12px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 4px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .toggle-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .toggle-btn.active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .toggle-btn.head.active {
      background-color: rgba(72, 180, 97, 0.8);
      border-color: rgba(72, 180, 97, 0.8);
    }
    .toggle-btn.base.active {
      background-color: rgba(220, 80, 80, 0.8);
      border-color: rgba(220, 80, 80, 0.8);
    }

    /* Location display */
    .location-info {
      margin-bottom: 16px;
    }
    .location {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .location:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .location:last-child {
      margin-bottom: 0;
    }
    .location-indicator {
      margin-right: 8px;
      font-size: 10px;
    }
    .location-indicator.head {
      color: rgba(72, 180, 97, 1);
    }
    .location-indicator.base {
      color: rgba(220, 80, 80, 1);
    }
    .location-path {
      color: var(--vscode-textLink-foreground);
    }
    .location-lines {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .location-suffix {
      margin-left: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    .location.base-only {
      border-left: 3px solid rgba(220, 80, 80, 0.6);
    }
    .location.fallback {
      opacity: 0.8;
    }
    .location-label {
      margin-right: 8px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    /* Error message */
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background-color: rgba(220, 80, 80, 0.1);
      border: 1px solid rgba(220, 80, 80, 0.3);
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--vscode-errorForeground);
    }
    .error-icon {
      font-size: 16px;
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
    /* Markdown styles */
    .markdown-content {
      line-height: 1.6;
    }
    .markdown-content p {
      margin: 0 0 12px 0;
    }
    .markdown-content p:last-child {
      margin-bottom: 0;
    }
    .markdown-content code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: 0.9em;
    }
    .markdown-content pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 12px 0;
    }
    .markdown-content pre code {
      padding: 0;
      background: none;
      font-size: 0.85em;
    }
    .markdown-content ul, .markdown-content ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    .markdown-content li {
      margin: 4px 0;
    }
    .markdown-content blockquote {
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      margin: 12px 0;
      padding: 4px 12px;
      color: var(--vscode-textBlockQuote-foreground);
    }
    .markdown-content a {
      color: var(--vscode-textLink-foreground);
    }
    .markdown-content a:hover {
      color: var(--vscode-textLink-activeForeground);
    }
    .markdown-content strong {
      font-weight: 600;
    }
    .markdown-content h1, .markdown-content h2, .markdown-content h3 {
      margin: 16px 0 8px 0;
      font-weight: 600;
    }
    .markdown-content h1 { font-size: 1.4em; }
    .markdown-content h2 { font-size: 1.2em; }
    .markdown-content h3 { font-size: 1.1em; }
    /* Syntax highlighting - VS Code compatible colors */
    .hljs-keyword { color: var(--vscode-debugTokenExpression-name, #569cd6); }
    .hljs-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
    .hljs-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
    .hljs-comment { color: var(--vscode-descriptionForeground, #6a9955); font-style: italic; }
    .hljs-function { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
    .hljs-class { color: var(--vscode-symbolIcon-classForeground, #4ec9b0); }
    .hljs-variable { color: var(--vscode-debugTokenExpression-value, #9cdcfe); }
    .hljs-operator { color: var(--vscode-foreground, #d4d4d4); }
    .hljs-punctuation { color: var(--vscode-foreground, #d4d4d4); }
    .hljs-property { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
    .hljs-attr { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
    .hljs-tag { color: var(--vscode-debugTokenExpression-name, #569cd6); }
    .hljs-name { color: var(--vscode-debugTokenExpression-name, #569cd6); }
    .hljs-selector-tag { color: var(--vscode-debugTokenExpression-name, #d7ba7d); }
    .hljs-selector-class { color: var(--vscode-debugTokenExpression-name, #d7ba7d); }
    .hljs-built_in { color: var(--vscode-symbolIcon-functionForeground, #4ec9b0); }
    .hljs-literal { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
    .hljs-params { color: var(--vscode-foreground, #9cdcfe); }
    .hljs-title { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
    .hljs-title.function_ { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
    .hljs-title.class_ { color: var(--vscode-symbolIcon-classForeground, #4ec9b0); }
  </style>
</head>
<body>
  <div class="header">
    <span class="step-counter">Step ${currentIndex + 1} of ${totalSteps}</span>
  </div>

  <h1 class="title">${this.escapeHtml(step.title)}</h1>

  ${metadataHtml}

  ${locationHtml}

  ${step.body ? `<div class="body markdown-content">${this.renderMarkdown(step.body)}</div>` : ''}

  <div class="comments-section">
    <div class="comments-header">
      <span class="comments-title">Comments${step.comments?.length ? ` (${step.comments.length})` : ''}</span>
    </div>
    ${step.comments && step.comments.length > 0
      ? step.comments.map(comment => `
        <div class="comment">
          <div class="comment-author">${this.escapeHtml(comment.author)}</div>
          <div class="comment-body markdown-content">${this.renderMarkdown(comment.body)}</div>
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

    function setViewMode(mode) {
      vscode.postMessage({ command: 'setViewMode', mode: mode });
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

  private renderMarkdown(text: string): string {
    // Use a custom renderer to disable HTML tags
    const renderer = new markedInstance.Renderer();
    renderer.html = () => ''; // Strip raw HTML

    return markedInstance.parse(text, { renderer }) as string;
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
