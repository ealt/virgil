import { execSync } from 'child_process';
import { Repository } from './types';

export interface BaseRefResult {
  commit: string | null;
  source: 'baseCommit' | 'baseBranch' | 'pr' | null;
  error?: string;
}

export interface ValidationWarning {
  type: 'multiple_base_refs' | 'invalid_base_ref' | 'missing_base_ref';
  message: string;
}

/**
 * Resolves and validates base references for diff mode
 */
export class DiffResolver {
  constructor(private workspaceRoot: string) {}

  /**
   * Resolves the base reference from repository config
   * Priority order: baseCommit > baseBranch > pr
   */
  public resolveBase(repository: Repository | undefined): BaseRefResult {
    if (!repository) {
      return { commit: null, source: null };
    }

    // Priority 1: Explicit commit SHA
    if (repository.baseCommit) {
      const validatedCommit = this.validateCommit(repository.baseCommit);
      if (validatedCommit) {
        return { commit: validatedCommit, source: 'baseCommit' };
      }
      return {
        commit: null,
        source: 'baseCommit',
        error: `Invalid base commit: ${repository.baseCommit}`,
      };
    }

    // Priority 2: Branch name
    if (repository.baseBranch) {
      const resolvedCommit = this.resolveBranch(repository.baseBranch);
      if (resolvedCommit) {
        return { commit: resolvedCommit, source: 'baseBranch' };
      }
      return {
        commit: null,
        source: 'baseBranch',
        error: `Cannot resolve branch: ${repository.baseBranch}`,
      };
    }

    // Priority 3: PR number
    if (repository.pr) {
      const baseCommit = this.resolvePRBase(repository.pr);
      if (baseCommit) {
        return { commit: baseCommit, source: 'pr' };
      }
      return {
        commit: null,
        source: 'pr',
        error: `Cannot determine base for PR #${repository.pr}`,
      };
    }

    return { commit: null, source: null };
  }

  /**
   * Validates that multiple base refs aren't specified
   * Returns warnings if more than one is set
   */
  public validateSingleBaseRef(repository: Repository | undefined): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!repository) {
      return warnings;
    }

    const refs: string[] = [];
    if (repository.baseCommit) refs.push('baseCommit');
    if (repository.baseBranch) refs.push('baseBranch');
    if (repository.pr) refs.push('pr');

    if (refs.length > 1) {
      warnings.push({
        type: 'multiple_base_refs',
        message: `Multiple base references specified (${refs.join(', ')}). Using ${refs[0]} (priority: baseCommit > baseBranch > pr).`,
      });
    }

    return warnings;
  }

  /**
   * Checks if a step requires a base reference but none is configured
   */
  public validateStepBaseRef(
    hasBaseLocation: boolean,
    repository: Repository | undefined
  ): ValidationWarning | null {
    if (!hasBaseLocation) {
      return null;
    }

    const result = this.resolveBase(repository);
    if (!result.commit) {
      return {
        type: 'missing_base_ref',
        message:
          'Step has base_location but no base reference is configured. Add baseCommit, baseBranch, or pr to repository.',
      };
    }

    return null;
  }

  /**
   * Validates a commit SHA exists in the repository
   */
  private validateCommit(commit: string): string | null {
    try {
      const fullSha = execSync(`git rev-parse --verify ${commit}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return fullSha || null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a branch name to its commit SHA
   */
  private resolveBranch(branch: string): string | null {
    try {
      // Try local branch first
      const commit = execSync(`git rev-parse --verify ${branch}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return commit || null;
    } catch {
      // Try remote branch
      try {
        const commit = execSync(`git rev-parse --verify origin/${branch}`, {
          cwd: this.workspaceRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return commit || null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Resolves a PR number to its base branch commit
   * Uses GitHub CLI if available, otherwise tries git merge-base
   */
  private resolvePRBase(prNumber: number): string | null {
    // Try using GitHub CLI
    try {
      const prInfo = execSync(`gh pr view ${prNumber} --json baseRefName -q .baseRefName`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (prInfo) {
        return this.resolveBranch(prInfo);
      }
    } catch {
      // gh CLI not available or failed
    }

    // Fallback: try to find merge-base with common default branches
    const defaultBranches = ['main', 'master', 'develop'];
    for (const branch of defaultBranches) {
      try {
        const mergeBase = execSync(`git merge-base HEAD ${branch}`, {
          cwd: this.workspaceRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (mergeBase) {
          return mergeBase;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Gets the current HEAD commit
   */
  public getHeadCommit(): string | null {
    try {
      return (
        execSync('git rev-parse HEAD', {
          cwd: this.workspaceRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim() || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Gets a short version of a commit SHA
   */
  public shortCommit(commit: string): string {
    return commit.substring(0, 7);
  }
}
