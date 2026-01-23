import * as vscode from 'vscode';
import { execSync } from 'child_process';

/**
 * Provides content from git commits for virtual documents.
 * URI scheme: virgil-git
 * URI format: virgil-git:///<commit>/<file-path>
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  private workspaceRoot: string;
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this._onDidChange.event;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Creates a URI for a file at a specific commit
   */
  public static createUri(commit: string, filePath: string): vscode.Uri {
    // Normalize path to remove leading slashes
    const normalizedPath = filePath.replace(/^\/+/, '');
    return vscode.Uri.parse(`virgil-git:///${commit}/${normalizedPath}`);
  }

  /**
   * Parses a virgil-git URI to extract commit and file path
   */
  public static parseUri(uri: vscode.Uri): { commit: string; filePath: string } | null {
    if (uri.scheme !== 'virgil-git') {
      return null;
    }

    // URI format: virgil-git:///<commit>/<file-path>
    const pathParts = uri.path.split('/').filter((p) => p);
    if (pathParts.length < 2) {
      return null;
    }

    const commit = pathParts[0];
    const filePath = pathParts.slice(1).join('/');

    return { commit, filePath };
  }

  /**
   * Provides the content of a file at a specific git commit
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    const parsed = DiffContentProvider.parseUri(uri);
    if (!parsed) {
      throw new Error(`Invalid virgil-git URI: ${uri.toString()}`);
    }

    const { commit, filePath } = parsed;

    try {
      const content = execSync(`git show ${commit}:${filePath}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large files
      });
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('does not exist') || errorMessage.includes('fatal: path')) {
        throw new Error(`File "${filePath}" does not exist at commit ${commit.substring(0, 7)}`);
      }
      if (errorMessage.includes('unknown revision') || errorMessage.includes('bad revision')) {
        throw new Error(`Invalid commit reference: ${commit}`);
      }
      throw new Error(`Failed to retrieve file content: ${errorMessage}`);
    }
  }

  /**
   * Checks if a file exists at a specific commit
   */
  public fileExistsAtCommit(commit: string, filePath: string): boolean {
    try {
      execSync(`git cat-file -e ${commit}:${filePath}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the content of a file at a specific commit
   * Returns null if the file doesn't exist
   */
  public getFileContent(commit: string, filePath: string): string | null {
    try {
      return execSync(`git show ${commit}:${filePath}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  }

  public dispose(): void {
    this._onDidChange.dispose();
  }
}
