/**
 * tRPC Root Router
 *
 * All API surface area is defined here. Phase 0 exposes a single
 * health-check procedure to validate end-to-end type safety.
 *
 * Phase 1 will add: ingestion.submit, ingestion.status
 * Phase 2 will add: layout.get
 */

import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "./context.js";

const t = initTRPC.context<TRPCContext>().create();

export const appRouter = t.router({
  /**
   * Health check — verifies the server is alive and config loaded.
   * Returns the server's guardrail configuration so the frontend
   * can display ingestion limits in the UI.
   */
  health: t.procedure
    .input(z.void())
    .query(({ ctx }) => {
      return {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        guardrails: {
          maxRepoSizeMb: ctx.config.guardrails.maxRepoSizeMb,
          maxFileCount: ctx.config.guardrails.maxFileCount,
        },
      };
    }),
});

/** Export the router type for frontend tRPC client inference */
export type AppRouter = typeof appRouter;
