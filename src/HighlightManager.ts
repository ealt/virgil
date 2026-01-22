import * as vscode from 'vscode';

export class HighlightManager {
  private decorationType: vscode.TextEditorDecorationType;
  private activeDecorations: Map<string, vscode.Range[]> = new Map();

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(86, 156, 214, 0.1)',
      borderColor: 'rgba(86, 156, 214, 0.6)',
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      isWholeLine: true,
      overviewRulerColor: 'rgba(86, 156, 214, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Center
    });
  }

  public highlightRange(editor: vscode.TextEditor, startLine: number, endLine: number): void {
    const filePath = editor.document.uri.fsPath;

    // Convert to 0-indexed
    const start = new vscode.Position(startLine - 1, 0);
    const end = new vscode.Position(endLine - 1, editor.document.lineAt(endLine - 1).text.length);
    const range = new vscode.Range(start, end);

    // Get existing ranges for this file or create new array
    const existingRanges = this.activeDecorations.get(filePath) || [];
    existingRanges.push(range);
    this.activeDecorations.set(filePath, existingRanges);

    // Apply all decorations for this editor
    editor.setDecorations(this.decorationType, existingRanges);
  }

  public clearFile(filePath: string): void {
    this.activeDecorations.delete(filePath);

    // Find editor and clear decorations
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.fsPath === filePath
    );

    if (editor) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  public clearAll(): void {
    // Clear decorations from all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decorationType, []);
    }

    this.activeDecorations.clear();
  }

  public refreshEditor(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const ranges = this.activeDecorations.get(filePath);

    if (ranges && ranges.length > 0) {
      editor.setDecorations(this.decorationType, ranges);
    }
  }

  public dispose(): void {
    this.clearAll();
    this.decorationType.dispose();
  }
}
