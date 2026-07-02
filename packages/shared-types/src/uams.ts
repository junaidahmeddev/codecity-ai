/**
 * @module @codecity/shared
 *
 * UAMS — Unified AST Metadata Schema
 *
 * This is the SOLE contract between the backend ingestion pipeline and the
 * frontend 3D renderer. No renderer code may branch on source language —
 * only on UAMS fields. (Section 3, Contract 1)
 *
 * Every field is Zod-validated at every layer boundary. (Section 3, Contract 6)
 */

import { z } from "zod";

// ─── Language Enum ─────────────────────────────────────────
// Determines the geometry archetype (silhouette) only.
// The renderer never reads this to change behavior — only to select mesh shape.
export const SupportedLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "python",
  "go",
  "c",
  "cpp",
  "rust",
  "java",
  "ruby",
  "unknown",
]);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

// ─── File-Level Metrics ────────────────────────────────────
// Each source file produces exactly one of these.
// Each of these produces exactly one building. (Section 3, Contract 7)
export const UAMSFileSchema = z.object({
  /** Unique identifier — relative path from repo root (e.g. "src/renderer/Scene.tsx") */
  id: z.string().min(1),

  /** Relative path from repo root */
  path: z.string().min(1),

  /** Bare filename */
  name: z.string().min(1),

  /** File extension without dot (e.g. "ts", "py") */
  extension: z.string(),

  /** Detected language — drives geometry archetype selection */
  language: SupportedLanguageSchema,

  /** Lines of code (excluding blank lines and comments) — drives building HEIGHT */
  loc: z.number().int().nonnegative(),

  /** Total lines in the file (including blanks/comments) */
  totalLines: z.number().int().nonnegative(),

  /** Cyclomatic complexity estimate — available for future code-smell overlay */
  complexity: z.number().nonnegative(),

  /** Number of exported symbols — contributes to building FOOTPRINT (W×D) */
  exportCount: z.number().int().nonnegative(),

  /** Number of imported modules/symbols — contributes to building FOOTPRINT (W×D) */
  importCount: z.number().int().nonnegative(),

  /**
   * Files that this file imports FROM (outgoing dependency edges).
   * Stored as relative paths matching other UAMSFile.id values.
   */
  dependencies: z.array(z.string()),

  /**
   * Files that import THIS file (incoming dependency edges).
   * Populated during the graph normalization pass (Phase 2).
   * Length of this array = in-degree centrality = glow intensity driver.
   */
  dependents: z.array(z.string()),

  /** Parent directory path (e.g. "src/renderer") */
  directoryPath: z.string(),
});
export type UAMSFile = z.infer<typeof UAMSFileSchema>;

// ─── Directory (District) ──────────────────────────────────
// Directories are ground-plane district boundaries only, never buildings.
export const UAMSDirectorySchema = z.object({
  /** Relative path from repo root */
  path: z.string(),

  /** Directory name */
  name: z.string(),

  /** Child file IDs (paths) within this directory (non-recursive) */
  fileIds: z.array(z.string()),

  /** Child directory paths (non-recursive) */
  childDirectoryPaths: z.array(z.string()),

  /** Aggregated LOC of all files in this directory (recursive) */
  totalLoc: z.number().int().nonnegative(),

  /** Total file count in this directory (recursive) */
  totalFileCount: z.number().int().nonnegative(),
});
export type UAMSDirectory = z.infer<typeof UAMSDirectorySchema>;

// ─── Repository (City) ─────────────────────────────────────
export const UAMSRepositorySchema = z.object({
  /** GitHub-style "owner/repo" identifier */
  name: z.string().min(1),

  /** Full clone URL */
  url: z.string().url(),

  /** Commit SHA this parse corresponds to — used as cache key */
  commitSha: z.string().length(40),

  /** Timestamp of ingestion */
  parsedAt: z.string().datetime(),

  /** Flat map of all parsed files, keyed by relative path */
  files: z.record(z.string(), UAMSFileSchema),

  /** Directory tree, keyed by relative path */
  directories: z.record(z.string(), UAMSDirectorySchema),

  /** Top-level stats for the HUD */
  stats: z.object({
    totalFiles: z.number().int().nonnegative(),
    totalLoc: z.number().int().nonnegative(),
    totalDirectories: z.number().int().nonnegative(),
    languageBreakdown: z.record(SupportedLanguageSchema, z.number().int().nonnegative()),
  }),
});
export type UAMSRepository = z.infer<typeof UAMSRepositorySchema>;

// ─── Layout Result ─────────────────────────────────────────
// Output of the force-directed layout solver (Phase 2).
// Maps file IDs to their computed 3D position and visual properties.
export const BuildingLayoutSchema = z.object({
  /** Matches UAMSFile.id */
  fileId: z.string(),

  /** World-space position (center of building footprint) */
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),

  /** Computed building dimensions */
  dimensions: z.object({
    /** Width (X-axis) — derived from dependency weight */
    width: z.number().positive(),
    /** Depth (Z-axis) — derived from dependency weight */
    depth: z.number().positive(),
    /** Height (Y-axis) — derived from log-scaled LOC */
    height: z.number().positive(),
  }),

  /** Glow intensity tier — driven by in-degree centrality */
  glowTier: z.enum(["dim", "core", "bright", "peak"]),

  /** Geometry archetype key — driven by language */
  geometryArchetype: SupportedLanguageSchema,

  /** District (directory) this building belongs to */
  districtPath: z.string(),
});
export type BuildingLayout = z.infer<typeof BuildingLayoutSchema>;

export const CityLayoutSchema = z.object({
  /** Commit SHA this layout was computed for */
  commitSha: z.string().length(40),

  /** All building placements */
  buildings: z.array(BuildingLayoutSchema),

  /** District boundary polygons for ground-plane rendering */
  districts: z.record(
    z.string(),
    z.object({
      path: z.string(),
      /** 2D bounding box of the district on the XZ plane */
      bounds: z.object({
        minX: z.number(),
        maxX: z.number(),
        minZ: z.number(),
        maxZ: z.number(),
      }),
    })
  ),
});
export type CityLayout = z.infer<typeof CityLayoutSchema>;

// ─── Ingestion Job Status ──────────────────────────────────
// Polled by the frontend via TanStack Query.
export const IngestionJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "cloning", "parsing", "layouting", "complete", "failed"]),
  progress: z.number().min(0).max(100),
  repoName: z.string(),
  error: z.string().optional(),
  /** Available once status = "complete" */
  result: z
    .object({
      repository: UAMSRepositorySchema,
      layout: CityLayoutSchema,
    })
    .optional(),
});
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusSchema>;
