/**
 * Fastify Server Bootstrap
 *
 * Entry point for the CodeCity AI backend. Wires up:
 * - Pino structured logging (OpenTelemetry-ready in Phase 6)
 * - CORS for frontend dev server
 * - tRPC adapter mounted at /trpc
 * - Config validation at startup (fail-fast on bad env vars)
 *
 * Section 3, Contract 5: No heavy compute on the main thread.
 * This file only bootstraps HTTP — all clone/parse/layout work
 * is dispatched to worker_threads via BullMQ (Phase 1).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { loadConfig } from "@codecity/shared-types";
import { appRouter, type AppRouter } from "./trpc/router.js";
import { createContextFactory } from "./trpc/context.js";
import { startIngestionWorker, stopIngestionWorker } from "./queue/ingestion.queue.js";

async function main(): Promise<void> {
  // ── Validate config at startup (fail-fast) ───────────────
  const config = loadConfig();

  // ── Fastify instance with Pino structured logging ────────
  const isDev = process.env["NODE_ENV"] === "development";
  const loggerOptions = isDev
    ? {
        level: config.server.logLevel,
        transport: { target: "pino-pretty" as const, options: { colorize: true } },
      }
    : { level: config.server.logLevel };

  const server = Fastify({ logger: loggerOptions });

  // ── CORS — allow frontend dev server ─────────────────────
  await server.register(cors, {
    origin: process.env["NODE_ENV"] === "development" ? true : false,
    credentials: true,
  });

  // ── tRPC adapter ─────────────────────────────────────────
  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: createContextFactory(config),
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // ── Start Ingestion Worker Queue ────────────────────────
  startIngestionWorker();

  // ── Start ────────────────────────────────────────────────
  try {
    const address = await server.listen({
      host: config.server.host,
      port: config.server.port,
    });
    server.log.info(`🏙️  CodeCity AI backend listening at ${address}`);
    server.log.info(
      `📋 Guardrails: max repo ${config.guardrails.maxRepoSizeMb}MB, ` +
      `max files ${config.guardrails.maxFileCount}, ` +
      `clone timeout ${config.guardrails.cloneTimeoutMs}ms`
    );
  } catch (err) {
    server.log.fatal(err, "Failed to start server");
    process.exit(1);
  }

  // ── Graceful shutdown ────────────────────────────────────
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    await stopIngestionWorker();
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
