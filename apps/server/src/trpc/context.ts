/**
 * tRPC Context Factory
 *
 * Creates the request-scoped context available to every tRPC procedure.
 * In Phase 0 this is minimal — Redis connection and config will be injected
 * here in Phase 1 when the ingestion pipeline is wired up.
 */

import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { AppConfig } from "@codecity/shared-types";

export interface TRPCContext {
  config: AppConfig;
  res?: CreateFastifyContextOptions['res'];
}

/**
 * Factory function — called once per incoming request.
 * The config instance is bound at server startup via closure.
 */
export function createContextFactory(config: AppConfig) {
  return function createContext(
    opts: CreateFastifyContextOptions
  ): TRPCContext {
    return { config, res: opts.res };
  };
}
