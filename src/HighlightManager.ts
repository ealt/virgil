import * as vscode from 'vscode';

export type HighlightColor = 'standard' | 'diffHead' | 'diffBase';

interface ColorConfig {
  backgroundColor: string;
  borderColor: string;
  overviewRulerColor: string;
}

/**
 * Converts a hex color to rgba format.
 * Supports both 6-digit (#RRGGBB) and 8-digit (#RRGGBBAA) formats.
 * If alpha is provided separately, it overrides any alpha in the hex string.
 */
function hexToRgba(hex: string, alpha?: number): string {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle 8-digit hex (with alpha)
  if (cleanHex.length === 8) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const a = alpha !== undefined ? alpha : parseInt(cleanHex.substring(6, 8), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Handle 6-digit hex (no alpha)
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const a = alpha !== undefined ? alpha : 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Invalid format, return default
  return 'rgba(0, 0, 0, 0)';
}

/**
 * Reads color configuration from VS Code settings
 */
function getColorConfig(colorType: HighlightColor): ColorConfig {
  const config = vscode.workspace.getConfiguration('virgil');

  // Default values (matching original colors converted to hex)
  const defaults: Record<HighlightColor, ColorConfig> = {
    standard: {
      backgroundColor: 'rgba(86, 156, 214, 0.1)',
      borderColor: 'rgba(86, 156, 214, 0.6)',
      overviewRulerColor: 'rgba(86, 156, 214, 0.8)',
    },
    diffHead: {
      backgroundColor: 'rgba(72, 180, 97, 0.15)',
      borderColor: 'rgba(72, 180, 97, 0.6)',
      overviewRulerColor: 'rgba(72, 180, 97, 0.8)',
    },
    diffBase: {
      backgroundColor: 'rgba(220, 80, 80, 0.15)',
      borderColor: 'rgba(220, 80, 80, 0.6)',
      overviewRulerColor: 'rgba(220, 80, 80, 0.8)',
    },
  };

  const defaultConfig = defaults[colorType];

  // Read individual properties from config
  const bgHex = config.get<string>(`highlights.${colorType}.backgroundColor`);
  const borderHex = config.get<string>(`highlights.${colorType}.borderColor`);
  const rulerHex = config.get<string>(`highlights.${colorType}.overviewRulerColor`);

  return {
    backgroundColor: bgHex ? hexToRgba(bgHex) : defaultConfig.backgroundColor,
    borderColor: borderHex ? hexToRgba(borderHex) : defaultConfig.borderColor,
    overviewRulerColor: rulerHex ? hexToRgba(rulerHex) : defaultConfig.overviewRulerColor,
  };
}

export class HighlightManager {
  private decorationTypes: Map<HighlightColor, vscode.TextEditorDecorationType> = new Map();
  private activeDecorations: Map<string, { color: HighlightColor; ranges: vscode.Range[] }> =
    new Map();
  private configChangeListener: vscode.Disposable | undefined;

  constructor() {
    this.createDecorationTypes();

    // Listen for configuration changes
    this.configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('virgil.highlights')) {
        this.recreateDecorationTypes();
      }
    });
  }

  private createDecorationTypes(): void {
    // Dispose existing decoration types
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();

    // Create decoration types for each color from configuration
    const colorTypes: HighlightColor[] = ['standard', 'diffHead', 'diffBase'];
    for (const color of colorTypes) {
      const config = getColorConfig(color);
      this.decorationTypes.set(
        color,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          borderWidth: '0 0 0 3px',
          borderStyle: 'solid',
          isWholeLine: true,
          overviewRulerColor: config.overviewRulerColor,
          overviewRulerLane: vscode.OverviewRulerLane.Center,
        })
      );
    }
  }

  private recreateDecorationTypes(): void {
    // Store current active decorations
    const currentDecorations = new Map(this.activeDecorations);

    // Recreate decoration types with new colors
    this.createDecorationTypes();

    // Reapply decorations to all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.toString();
      const decorationData = currentDecorations.get(filePath);
      if (decorationData) {
        const decorationType = this.decorationTypes.get(decorationData.color);
        if (decorationType) {
          editor.setDecorations(decorationType, decorationData.ranges);
        }
      }
    }

    // Update active decorations map
    this.activeDecorations = currentDecorations;
  }

  public highlightRange(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    color: HighlightColor = 'standard'
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
    const decorationData =
      this.activeDecorations.get(filePath) || this.activeDecorations.get(normalizedPath);

    if (decorationData) {
      // Find editor and clear decorations
      const editor = vscode.window.visibleTextEditors.find(
        (e) =>
          e.document.uri.toString() === filePath ||
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
    this.configChangeListener?.dispose();
  }
}
