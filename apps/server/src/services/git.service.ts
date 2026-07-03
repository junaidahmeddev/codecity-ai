import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import { loadConfig } from '@codecity/shared-types';

const config = loadConfig();

export class GitService {
  private sandboxDir: string;

  constructor() {
    // Use OS temp directory to avoid Windows Defender/indexer file locks
    // inside the project tree. Each clone gets a unique UUID subdirectory.
    this.sandboxDir = path.join(os.tmpdir(), 'codecity-sandbox');

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

    // Use UUID to guarantee unique directory per clone attempt (no collisions)
    const uniqueId = `${jobId}-${crypto.randomUUID().slice(0, 8)}`;
    const localPath = path.join(this.sandboxDir, uniqueId);

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
      // Clean up directory on failure (best-effort)
      this.cleanup(localPath);
      throw new Error(`Git clone failed: ${err.message || err}`);
    }

    // ── 3. Size validation post-clone ──────────────────────
    const folderSizeMb = this.getFolderSizeMb(localPath);
    if (folderSizeMb > config.guardrails.maxRepoSizeMb) {
      this.cleanup(localPath);
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
      this.cleanup(localPath);
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
   * Best-effort: on Windows, .git pack files may be transiently locked.
   * Failures are logged but never thrown.
   */
  cleanup(localPath: string): void {
    try {
      if (fs.existsSync(localPath)) {
        fs.rmSync(localPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
      }
    } catch (err: any) {
      console.warn(`⚠️ Cleanup warning: Could not remove ${localPath}: ${err.message}`);
    }
  }
}
