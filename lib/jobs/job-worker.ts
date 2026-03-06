import { getResearchSystem } from '@/lib/research-system';
import { runResearchJob } from '@/packages/pipeline';

const WORKER_ID = `web-worker_${crypto.randomUUID()}`;
const HEARTBEAT_INTERVAL_MS = 5000;
const IDLE_POLL_MS = 1000;
const MAX_IDLE_POLLS = 60;

let workerLoop: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(jobId: string): Promise<void> {
  const system = getResearchSystem();
  const job = await system.repositories.jobs.getById(jobId);

  if (!job) {
    return;
  }

  const heartbeat = setInterval(() => {
    void system.repositories.jobs.touchHeartbeat(job.id, WORKER_ID);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    for await (const event of runResearchJob(job, system)) {
      void event;
      // Durable events are appended inside the pipeline.
    }
  } finally {
    clearInterval(heartbeat);
  }
}

async function runLoop(): Promise<void> {
  let idlePolls = 0;

  while (idlePolls < MAX_IDLE_POLLS) {
    const system = getResearchSystem();
    const claimedJob = await system.repositories.jobs.claimNextPending(WORKER_ID);

    if (!claimedJob) {
      idlePolls += 1;
      await sleep(IDLE_POLL_MS);
      continue;
    }

    idlePolls = 0;

    try {
      await processJob(claimedJob.id);
    } catch (error) {
      console.error(`Worker failed while processing job ${claimedJob.id}:`, error);
      await system.repositories.jobs.update({
        ...claimedJob,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Worker execution failed',
        finished_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      });
    }
  }
}

export function ensureJobWorkerRunning(): void {
  if (workerLoop) {
    return;
  }

  workerLoop = runLoop().finally(() => {
    workerLoop = null;
  });
}
