/**
 * @module @codecity/shared
 *
 * Centralized Security Guardrails Configuration
 *
 * Section 3, Contract 4: All security guardrails are centralized in ONE config
 * module. Never hardcode limits inline in pipeline code.
 *
 * Values are read from environment variables with safe defaults.
 * Validated at startup — if a value is invalid, the process crashes immediately
 * rather than running with broken limits.
 */

import { z } from "zod";

const envNumber = (envKey: string, fallback: number): number => {
  const raw = typeof process !== "undefined" ? process.env[envKey] : undefined;
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `[config] Invalid numeric value for ${envKey}: "${raw}". Must be a valid number.`
    );
  }
  return parsed;
};

const envString = (envKey: string, fallback: string): string => {
  const raw = typeof process !== "undefined" ? process.env[envKey] : undefined;
  return raw ?? fallback;
};

/** Ingestion pipeline security limits — enforced at clone, walk, and parse stages. */
export const PipelineGuardrailsSchema = z.object({
  /** Max time to wait for a git clone to complete (ms) */
  cloneTimeoutMs: z.number().int().positive(),

  /** Max total repo size allowed for cloning (MB) */
  maxRepoSizeMb: z.number().int().positive(),

  /** Max directory recursion depth during file walk */
  maxWalkDepth: z.number().int().positive(),

  /** Max individual file size to parse (KB) — files above this are skipped with a warning */
  maxFileSizeKb: z.number().int().positive(),

  /** Max time to spend parsing a single file (ms) — prevents malicious/generated files from hanging */
  parseTimeoutPerFileMs: z.number().int().positive(),

  /** Allowed git clone protocols — blocks file:// and other local protocol attacks */
  allowedCloneProtocols: z.array(z.string()),

  /** Max number of files to process per repo — prevents OOM on huge monorepos */
  maxFileCount: z.number().int().positive(),
});
export type PipelineGuardrails = z.infer<typeof PipelineGuardrailsSchema>;

/** Server configuration */
export const ServerConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/** Redis connection configuration */
export const RedisConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
});
export type RedisConfig = z.infer<typeof RedisConfigSchema>;

/**
 * Load and validate all configuration from environment variables.
 * Throws immediately on invalid config — fail fast, don't limp along.
 */
export function loadConfig() {
  const guardrails = PipelineGuardrailsSchema.parse({
    cloneTimeoutMs: envNumber("CLONE_TIMEOUT_MS", 60_000),
    maxRepoSizeMb: envNumber("MAX_REPO_SIZE_MB", 500),
    maxWalkDepth: envNumber("MAX_WALK_DEPTH", 30),
    maxFileSizeKb: envNumber("MAX_FILE_SIZE_KB", 1024),
    parseTimeoutPerFileMs: envNumber("PARSE_TIMEOUT_PER_FILE_MS", 5000),
    allowedCloneProtocols: ["https:", "http:"],
    maxFileCount: envNumber("MAX_FILE_COUNT", 10_000),
  });

  const server = ServerConfigSchema.parse({
    host: envString("API_HOST", "0.0.0.0"),
    port: envNumber("API_PORT", 3001),
    logLevel: envString("LOG_LEVEL", "info"),
  });

  const redis = RedisConfigSchema.parse({
    host: envString("REDIS_HOST", "localhost"),
    port: envNumber("REDIS_PORT", 6379),
  });

  return { guardrails, server, redis } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;
