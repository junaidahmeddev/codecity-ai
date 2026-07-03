import fs from 'fs';
import path from 'path';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import {
  loadConfig,
  type UAMSFile,
  type UAMSDirectory,
  type UAMSRepository,
  type SupportedLanguage,
} from '@codecity/shared-types';
import { GitService } from '../services/git.service.js';
import { WalkerService } from '../services/walker.service.js';
import { ParserOrchestrator } from '../parser/parser.orchestrator.js';
import { LayoutService } from '../services/layout.service.js';

const config = loadConfig();
const gitService = new GitService();
const walkerService = new WalkerService();
const parserOrchestrator = new ParserOrchestrator();
const layoutService = new LayoutService();

// Redis connection instance specifically for caching results
const redisCache = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

/**
 * BullMQ sandboxed worker processor (runs inside node worker_threads).
 * Section 3 Contract 5: Offloads heavy computation from Fastify.
 */
export default async function processIngestionJob(job: Job<{ repoUrl: string }>) {
  const { repoUrl } = job.data;
  const jobId = job.id || Math.random().toString(36).substring(7);

  await job.updateProgress(10); // QUEUED -> CLONING

  let cloneResult: { localPath: string; commitSha: string } | null = null;

  try {
    // ── 1. Clone sandbox ───────────────────────────────────
    cloneResult = await gitService.cloneRepository(repoUrl, jobId);
    await job.updateProgress(30); // CLONED -> WALKING

    // Extract owner/repo name for the UAMS schema
    const repoPathMatch = repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/);
    const repoName = repoPathMatch ? repoPathMatch[1] : 'unknown/repo';

    // ── 2. Walk directory ──────────────────────────────────
    const walkResult = walkerService.walk(cloneResult.localPath);
    await job.updateProgress(45); // WALK COMPLETE -> PARSING

    const filesMap: Record<string, UAMSFile> = {};
    const dirsMap: Record<string, UAMSDirectory> = {};
    const languageBreakdown: Record<SupportedLanguage, number> = {
      typescript: 0,
      javascript: 0,
      python: 0,
      go: 0,
      c: 0,
      cpp: 0,
      rust: 0,
      java: 0,
      ruby: 0,
      unknown: 0,
    };

    let processedCount = 0;
    const totalFiles = walkResult.files.length;

    // ── 3. Parse files via Tree-Sitter ─────────────────────
    for (const relFilePath of walkResult.files) {
      const fullPath = path.join(cloneResult.localPath, relFilePath);
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue; // Skip unreadable
      }

      // Parse with tree-sitter adapters
      const parseResult = await parserOrchestrator.parseFile(relFilePath, content);
      const ext = path.extname(relFilePath).slice(1).toLowerCase();
      const langKey = parserOrchestrator.getLanguageKey(ext) as SupportedLanguage;

      languageBreakdown[langKey] = (languageBreakdown[langKey] || 0) + 1;

      const parentDir = path.dirname(relFilePath).replace(/\\/g, '/');
      const cleanParentDir = parentDir === '.' ? '' : parentDir;

      const uamsFile: UAMSFile = {
        id: relFilePath,
        path: relFilePath,
        name: path.basename(relFilePath),
        extension: ext,
        language: langKey,
        loc: parseResult.loc,
        totalLines: parseResult.totalLines,
        complexity: parseResult.complexity,
        exportCount: parseResult.exportCount,
        importCount: parseResult.importCount,
        dependencies: parseResult.dependencies,
        dependents: [], // Populated in normalization pass
        directoryPath: cleanParentDir,
      };

      filesMap[relFilePath] = uamsFile;

      // Track and build directory tree structures
      ensureDirectoryNodes(cleanParentDir, relFilePath, dirsMap);

      processedCount++;
      // Scale parsing progress between 45% and 85%
      const currentProgress = Math.round(45 + (processedCount / totalFiles) * 40);
      await job.updateProgress(currentProgress);
    }

    // ── 4. Graph Normalization (Phase 2 stub) ──────────────
    // We do a simple first-pass connection matching here
    const fileIds = Object.keys(filesMap);
    for (const fileId of fileIds) {
      const file = filesMap[fileId];
      if (!file) continue;
      
      const cleanDeps: string[] = [];
      for (const dep of file.dependencies) {
        // Find if this dependency matches a valid UAMSFile.id
        // Handles imports like `./utils` -> `src/utils.ts` or `src/utils.tsx`
        let matchedId = fileIds.find((id) => id.replace(/\.[^/.]+$/, '') === dep);
        if (!matchedId) {
          // Fallback to exact match
          matchedId = fileIds.find((id) => id === dep);
        }

        if (matchedId) {
          cleanDeps.push(matchedId);
          // Wire up dependents (incoming edges)
          filesMap[matchedId]?.dependents.push(fileId);
        }
      }
      file.dependencies = cleanDeps;
    }

    // Populate directory LOC aggregations
    calculateDirectoryAggregations(dirsMap, filesMap);

    await job.updateProgress(90); // INGEST COMPLETE -> CACHING

    // ── 5. Build UAMSRepository ────────────────────────────
    const repository: UAMSRepository = {
      name: repoName ?? 'unknown/repo',
      url: repoUrl,
      commitSha: cloneResult.commitSha,
      parsedAt: new Date().toISOString(),
      files: filesMap,
      directories: dirsMap,
      stats: {
        totalFiles: processedCount,
        totalLoc: Object.values(filesMap).reduce((sum, f) => sum + f.loc, 0),
        totalDirectories: Object.keys(dirsMap).length,
        languageBreakdown,
      },
    };

    // Compute Phase 2 Layout
    const layout = layoutService.computeLayout(repository);

    // Cache result in Redis for layout simulation / cache hits
    const cacheKey = `repo:${cloneResult.commitSha}`;
    const resultPayload = { repository, layout };
    await redisCache.set(cacheKey, JSON.stringify(resultPayload), 'EX', 86400 * 7); // Cache for 7 days

    await job.updateProgress(100);

    return resultPayload;
  } catch (err: any) {
    console.error(`Ingestion error in worker (job: ${jobId}):`, err);
    throw err;
  } finally {
    // Sandbox cleanup — wrapped in try/catch because Windows may hold
    // transient locks on .git pack files (EBUSY). The parsed result
    // is already cached in Redis, so a cleanup failure is non-fatal.
    if (cloneResult) {
      try {
        gitService.cleanup(cloneResult.localPath);
      } catch (cleanupErr: any) {
        console.warn(`⚠️ Non-fatal cleanup error (job ${jobId}): ${cleanupErr.message}`);
      }
    }
  }
}

/**
 * Ensures intermediate directory structures exist in dirsMap.
 */
function ensureDirectoryNodes(dirPath: string, fileId: string, dirsMap: Record<string, UAMSDirectory>) {
  if (dirPath === '') {
    // Root directory node
    if (!dirsMap['']) {
      dirsMap[''] = {
        path: '',
        name: 'root',
        fileIds: [],
        childDirectoryPaths: [],
        totalLoc: 0,
        totalFileCount: 0,
      };
    }
    dirsMap['']?.fileIds.push(fileId);
    return;
  }

  const parts = dirPath.split('/');
  for (let i = 0; i < parts.length; i++) {
    const currentPath = parts.slice(0, i + 1).join('/');
    const parentPath = parts.slice(0, i).join('/');
    const name = parts[i] || 'unknown';

    if (!dirsMap[currentPath]) {
      dirsMap[currentPath] = {
        path: currentPath,
        name,
        fileIds: [],
        childDirectoryPaths: [],
        totalLoc: 0,
        totalFileCount: 0,
      };

      if (parentPath !== '' || i > 0) {
        if (!dirsMap[parentPath]) {
          dirsMap[parentPath] = {
            path: parentPath,
            name: parts[i - 1] || 'root',
            fileIds: [],
            childDirectoryPaths: [],
            totalLoc: 0,
            totalFileCount: 0,
          };
        }
        dirsMap[parentPath]?.childDirectoryPaths.push(currentPath);
      } else {
        if (!dirsMap['']) {
          dirsMap[''] = {
            path: '',
            name: 'root',
            fileIds: [],
            childDirectoryPaths: [],
            totalLoc: 0,
            totalFileCount: 0,
          };
        }
        dirsMap['']?.childDirectoryPaths.push(currentPath);
      }
    }
  }

  dirsMap[dirPath]?.fileIds.push(fileId);
}

/**
 * Recursively sums up files/dirs stats to populate directory aggregated values.
 */
function calculateDirectoryAggregations(
  dirsMap: Record<string, UAMSDirectory>,
  filesMap: Record<string, UAMSFile>
) {
  const keys = Object.keys(dirsMap).sort((a, b) => b.length - a.length); // Process deepest first

  for (const key of keys) {
    const dir = dirsMap[key];
    if (!dir) continue;

    let locSum = 0;
    let fileSum = dir.fileIds.length;

    // Add direct children
    for (const fid of dir.fileIds) {
      locSum += filesMap[fid]?.loc || 0;
    }

    // Add subdirectories aggregations
    for (const cPath of dir.childDirectoryPaths) {
      const childDir = dirsMap[cPath];
      if (childDir) {
        locSum += childDir.totalLoc;
        fileSum += childDir.totalFileCount;
      }
    }

    dir.totalLoc = locSum;
    dir.totalFileCount = fileSum;
  }
}

// Bind helper methods onto this context so the function resolves
Object.defineProperty(processIngestionJob, 'ensureDirectoryNodes', { value: ensureDirectoryNodes });
Object.defineProperty(processIngestionJob, 'calculateDirectoryAggregations', { value: calculateDirectoryAggregations });
