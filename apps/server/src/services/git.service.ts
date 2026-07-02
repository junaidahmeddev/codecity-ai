import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import { loadConfig } from '@codecity/shared-types';

const config = loadConfig();

export class GitService {
  private sandboxDir: string;

  constructor() {
    // Resolve sandbox relative to backend root
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.sandboxDir = path.resolve(__dirname, '../../../.sandbox');

    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }
  }

  /**
   * Securely clones a git repository into a temporary folder.
   * Centralized guardrails enforced (Section 3, Contract 4).
   */
  async cloneRepository(repoUrl: string, jobId: string): Promise<{ localPath: string; commitSha: string }> {
    // ── 1. Protocol Validation ─────────────────────────────
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(repoUrl);
    } catch (err) {
      throw new Error(`Invalid repository URL: "${repoUrl}"`);
    }

    if (!config.guardrails.allowedCloneProtocols.includes(parsedUrl.protocol)) {
      throw new Error(`Security Exception: Protocol "${parsedUrl.protocol}" is blocked.`);
    }

    // Block path traversal / symlink / local file injection attempts
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      throw new Error(`Security Exception: Local host clones are blocked.`);
    }

    const localPath = path.join(this.sandboxDir, jobId);
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    const git: SimpleGit = simpleGit();

    // ── 2. Clone execution with absolute timeout ───────────
    try {
      await Promise.race([
        git.clone(repoUrl, localPath, [
          '--depth=1', // Shallow clone to keep disk usage light
          '--no-single-branch',
        ]),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Clone operation timed out.')),
            config.guardrails.cloneTimeoutMs
          )
        ),
      ]);
    } catch (err: any) {
      // Clean up directory on failure
      if (fs.existsSync(localPath)) {
        fs.rmSync(localPath, { recursive: true, force: true });
      }
      throw new Error(`Git clone failed: ${err.message || err}`);
    }

    // ── 3. Size validation post-clone ──────────────────────
    const folderSizeMb = this.getFolderSizeMb(localPath);
    if (folderSizeMb > config.guardrails.maxRepoSizeMb) {
      fs.rmSync(localPath, { recursive: true, force: true });
      throw new Error(
        `Repository size exceeds limit: ${folderSizeMb.toFixed(1)}MB (Limit: ${config.guardrails.maxRepoSizeMb}MB)`
      );
    }

    // ── 4. Retrieve HEAD commit SHA ────────────────────────
    try {
      const localGit = simpleGit(localPath);
      const commitSha = (await localGit.revparse(['HEAD'])).trim();
      return { localPath, commitSha };
    } catch (err: any) {
      fs.rmSync(localPath, { recursive: true, force: true });
      throw new Error(`Failed to read commit SHA: ${err.message || err}`);
    }
  }

  /**
   * Helper to recursively calculate directory size in Megabytes.
   */
  private getFolderSizeMb(dirPath: string): number {
    let totalBytes = 0;

    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            walk(filePath);
          } else if (stats.isFile()) {
            totalBytes += stats.size;
          }
        } catch {
          // Ignore unreadable files
        }
      }
    };

    walk(dirPath);
    return totalBytes / (1024 * 1024);
  }

  /**
   * Cleans up the cloned repository folder.
   */
  cleanup(localPath: string): void {
    if (fs.existsSync(localPath) && localPath.startsWith(this.sandboxDir)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
  }
}
