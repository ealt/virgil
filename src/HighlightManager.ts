import * as vscode from 'vscode';

export type HighlightColor = 'blue' | 'green' | 'red';

interface ColorConfig {
  backgroundColor: string;
  borderColor: string;
  overviewRulerColor: string;
}

const COLOR_CONFIGS: Record<HighlightColor, ColorConfig> = {
  blue: {
    backgroundColor: 'rgba(86, 156, 214, 0.1)',
    borderColor: 'rgba(86, 156, 214, 0.6)',
    overviewRulerColor: 'rgba(86, 156, 214, 0.8)'
  },
  green: {
    backgroundColor: 'rgba(72, 180, 97, 0.15)',
    borderColor: 'rgba(72, 180, 97, 0.6)',
    overviewRulerColor: 'rgba(72, 180, 97, 0.8)'
  },
  red: {
    backgroundColor: 'rgba(220, 80, 80, 0.15)',
    borderColor: 'rgba(220, 80, 80, 0.6)',
    overviewRulerColor: 'rgba(220, 80, 80, 0.8)'
  }
};

export class HighlightManager {
  private decorationTypes: Map<HighlightColor, vscode.TextEditorDecorationType> = new Map();
  private activeDecorations: Map<string, { color: HighlightColor; ranges: vscode.Range[] }> = new Map();

  constructor() {
    // Create decoration types for each color
    for (const color of Object.keys(COLOR_CONFIGS) as HighlightColor[]) {
      const config = COLOR_CONFIGS[color];
      this.decorationTypes.set(color, vscode.window.createTextEditorDecorationType({
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        borderWidth: '0 0 0 3px',
        borderStyle: 'solid',
        isWholeLine: true,
        overviewRulerColor: config.overviewRulerColor,
        overviewRulerLane: vscode.OverviewRulerLane.Center
      }));
    }
  }

  public highlightRange(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    color: HighlightColor = 'blue'
  ): void {
    const filePath = editor.document.uri.toString();

    // Convert to 0-indexed
    const start = new vscode.Position(startLine - 1, 0);
    const end = new vscode.Position(endLine - 1, editor.document.lineAt(endLine - 1).text.length);
    const range = new vscode.Range(start, end);

    // Get existing data for this file
    const existing = this.activeDecorations.get(filePath);

    if (existing && existing.color === color) {
      // Same color - add to existing ranges
      existing.ranges.push(range);
    } else {
      // Different color or first decoration - clear any existing and start fresh
      if (existing) {
        this.clearFile(filePath);
      }
      this.activeDecorations.set(filePath, { color, ranges: [range] });
    }

    // Apply decorations
    const decorationType = this.decorationTypes.get(color);
    const decorationData = this.activeDecorations.get(filePath);
    if (decorationType && decorationData) {
      editor.setDecorations(decorationType, decorationData.ranges);
    }
  }

  public clearFile(filePath: string): void {
    // Also handle URI strings
    const normalizedPath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    const decorationData = this.activeDecorations.get(filePath) || this.activeDecorations.get(normalizedPath);

    if (decorationData) {
      // Find editor and clear decorations
      const editor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === filePath ||
             e.document.uri.fsPath === filePath ||
             e.document.uri.toString() === normalizedPath
      );

      if (editor) {
        const decorationType = this.decorationTypes.get(decorationData.color);
        if (decorationType) {
          editor.setDecorations(decorationType, []);
        }
      }

      this.activeDecorations.delete(filePath);
      this.activeDecorations.delete(normalizedPath);
    }
  }

  public clearAll(): void {
    // Clear decorations from all visible editors for all colors
    for (const editor of vscode.window.visibleTextEditors) {
      for (const decorationType of this.decorationTypes.values()) {
        editor.setDecorations(decorationType, []);
      }
    }

    this.activeDecorations.clear();
  }

  public refreshEditor(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.toString();
    const decorationData = this.activeDecorations.get(filePath);

    if (decorationData && decorationData.ranges.length > 0) {
      const decorationType = this.decorationTypes.get(decorationData.color);
      if (decorationType) {
        editor.setDecorations(decorationType, decorationData.ranges);
      }
    }
  }

  public dispose(): void {
    this.clearAll();
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }
}
