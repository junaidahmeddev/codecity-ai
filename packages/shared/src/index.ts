/**
 * @module @codecity/shared
 *
 * Barrel export — re-exports all schemas, types, and config
 * for consumption by apps/backend and apps/frontend.
 */

// UAMS — Unified AST Metadata Schema (the sole backend↔frontend contract)
export {
  SupportedLanguageSchema,
  type SupportedLanguage,
  UAMSFileSchema,
  type UAMSFile,
  UAMSDirectorySchema,
  type UAMSDirectory,
  UAMSRepositorySchema,
  type UAMSRepository,
  BuildingLayoutSchema,
  type BuildingLayout,
  CityLayoutSchema,
  type CityLayout,
  IngestionJobStatusSchema,
  type IngestionJobStatus,
} from "./uams.js";

// Centralized configuration & security guardrails
export {
  PipelineGuardrailsSchema,
  type PipelineGuardrails,
  ServerConfigSchema,
  type ServerConfig,
  RedisConfigSchema,
  type RedisConfig,
  loadConfig,
  type AppConfig,
} from "./config.js";
