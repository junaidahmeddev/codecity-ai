import path from 'path';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { loadConfig } from '@codecity/shared-types';
import processIngestionJob from '../workers/ingestion.processor.js';

const config = loadConfig();

// Shared connection client configurations for Redis
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

export const INGESTION_QUEUE_NAME = 'ingestion-queue';

export const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 1,
  },
});

export const queueEvents = new QueueEvents(INGESTION_QUEUE_NAME, { connection: connection as any });

// Initialize the worker with inline processor (no sandboxed file path)
let worker: Worker | null = null;

export function startIngestionWorker() {
  console.log('👷 Initializing BullMQ Worker with inline processor function');

  worker = new Worker(INGESTION_QUEUE_NAME, processIngestionJob, {
    connection: connection as any,
    concurrency: 2,
  });

  worker.on('active', (job) => {
    console.log(`🔄 Ingestion Job ${job.id} started processing...`);
  });

  worker.on('completed', (job, _result) => {
    console.log(`✅ Ingestion Job ${job.id} finished successfully!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Ingestion Job ${job?.id} failed:`, err);
  });
}

export async function stopIngestionWorker() {
  if (worker) {
    await worker.close();
  }
  await connection.quit();
}
