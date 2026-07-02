import fs from 'fs';
import path from 'path';
import { loadConfig } from '@codecity/shared-types';

const config = loadConfig();

export interface WalkResult {
  files: string[];
  directories: string[];
}

export class WalkerService {
  private ignoredDirs = new Set([
    'node_modules',
    '.git',
    '.github',
    'dist',
    'build',
    'out',
    'venv',
    '.venv',
    '__pycache__',
  ]);

  /**
   * Recursively walks the repository directory.
   * Centralized guardrails enforced (depth, max files).
   */
  walk(rootDir: string): WalkResult {
    const files: string[] = [];
    const directories: string[] = [];

    const traverse = (currentDir: string, depth: number) => {
      // ── 1. Walk Depth Guardrail ───────────────────────────
      if (depth > config.guardrails.maxWalkDepth) {
        return;
      }

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (this.ignoredDirs.has(entry.name)) continue;

          directories.push(relPath);
          traverse(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // ── 2. Max File Count Guardrail ───────────────────────
          if (files.length >= config.guardrails.maxFileCount) {
            continue;
          }

          // ── 3. Max File Size Guardrail ────────────────────────
          try {
            const stats = fs.statSync(fullPath);
            const fileSizeKb = stats.size / 1024;
            if (fileSizeKb <= config.guardrails.maxFileSizeKb) {
              files.push(relPath);
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    traverse(rootDir, 0);

    return { files, directories };
  }
}
