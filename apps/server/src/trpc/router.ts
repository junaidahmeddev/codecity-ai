/**
 * tRPC Root Router
 *
 * All API surface area is defined here. Phase 0 exposes a single
 * health-check procedure to validate end-to-end type safety.
 *
 * Phase 1 will add: ingestion.submit, ingestion.status
 * Phase 2 will add: layout.get
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "./context.js";
import { ingestionQueue } from "../queue/ingestion.queue.js";
import { IngestionJobStatusSchema } from "@codecity/shared-types";

const t = initTRPC.context<TRPCContext>().create();

export const appRouter = t.router({
  /**
   * Health check — verifies the server is alive and config loaded.
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

  /**
   * Ingestion: Submit a repository URL for asynchronous cloning & parsing.
   */
  submit: t.procedure
    .input(z.object({ repoUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const { repoUrl } = input;

      // Basic validation of git URL
      if (!repoUrl.includes("github.com/")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only GitHub repositories are supported currently.",
        });
      }

      try {
        const job = await ingestionQueue.add("ingest", { repoUrl });
        return { jobId: job.id };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to queue ingestion job: ${err.message || err}`,
        });
      }
    }),

  /**
   * Ingestion: Poll the status of a queued or active parse job.
   */
  status: t.procedure
    .input(z.object({ jobId: z.string() }))
    .output(IngestionJobStatusSchema)
    .query(async ({ input }) => {
      const { jobId } = input;
      const job = await ingestionQueue.getJob(jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ingestion job with ID "${jobId}" was not found.`,
        });
      }

      const state = await job.getState();
      const progress = typeof job.progress === 'number' ? job.progress : 0;
      
      const repoUrl = job.data.repoUrl;
      const repoPathMatch = repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/);
      const repoName = repoPathMatch ? repoPathMatch[1] : "unknown/repo";

      // Map BullMQ state + custom progress checkpoints to UAMS job statuses
      let status: "queued" | "cloning" | "parsing" | "layouting" | "complete" | "failed" = "queued";
      
      if (state === "completed") {
        status = "complete";
      } else if (state === "failed") {
        status = "failed";
      } else if (state === "active") {
        if (progress < 30) {
          status = "cloning";
        } else if (progress >= 30 && progress < 90) {
          status = "parsing";
        } else {
          status = "layouting";
        }
      }

      // Extract result or error if finished
      const error = job.failedReason || undefined;
      let result = undefined;

      if (status === "complete" && job.returnvalue) {
        result = {
          repository: job.returnvalue.repository,
          layout: job.returnvalue.layout,
        };
      }

      return {
        jobId,
        status,
        progress,
        repoName,
        error,
        result,
      };
    }),
});

/** Export the router type for frontend tRPC client inference */
export type AppRouter = typeof appRouter;
