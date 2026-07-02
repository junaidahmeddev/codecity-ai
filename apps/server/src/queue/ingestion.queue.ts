import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { loadConfig } from '@codecity/shared-types';

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

// Initialize the worker running in sandbox mode (separate thread/process)
let worker: Worker | null = null;

export function startIngestionWorker() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Point to the compiled JS file in production, or TS file in tsx dev mode
  const isTS = __filename.endsWith('.ts');
  const processorPath = path.resolve(
    __dirname,
    isTS ? '../workers/ingestion.processor.ts' : '../workers/ingestion.processor.js'
  );

  const processorUrl = pathToFileURL(processorPath).href;

  console.log(`👷 Initializing BullMQ Worker with processor URL: ${processorUrl}`);

  worker = new Worker(INGESTION_QUEUE_NAME, processorUrl, {
    connection: connection as any,
    useWorkerThreads: true, // Run in node worker thread
    concurrency: 2,        // Max 2 parallel parse jobs
  });

  worker.on('active', (job) => {
    console.log(`🔄 Ingestion Job ${job.id} started processing...`);
  });

  worker.on('completed', (job, result) => {
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
