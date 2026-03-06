import { NextResponse } from 'next/server';

import { ensureJobWorkerRunning } from '@/lib/jobs/job-worker';
import { getResearchSystem } from '@/lib/research-system';
import { JobEvent } from '@/packages/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 1000;

function encodeEvent(encoder: TextEncoder, event: JobEvent): Uint8Array {
  const payload = {
    ...(event.data && typeof event.data === 'object' ? event.data : {}),
    ...(event.text ? { text: event.text } : {}),
  };

  return encoder.encode(
    `id: ${event.sequence}\nevent: ${event.stage}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const system = getResearchSystem();
  const job = await system.repositories.jobs.getById(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  ensureJobWorkerRunning();

  const sinceParam = new URL(req.url).searchParams.get('since');
  const lastEventIdHeader = req.headers.get('last-event-id');
  let lastSequence = Number(sinceParam ?? lastEventIdHeader ?? 0);
  let cancelled = false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const flushEvents = async () => {
        const events = await system.repositories.jobEvents.listByJobId(id);
        const pending = events.filter((event) => event.sequence > lastSequence);

        for (const event of pending) {
          controller.enqueue(encodeEvent(encoder, event));
          lastSequence = event.sequence;
        }
      };

      try {
        while (!cancelled) {
          await flushEvents();
          const currentJob = await system.repositories.jobs.getById(id);

          if (!currentJob) {
            controller.close();
            return;
          }

          if (
            (currentJob.status === 'completed' || currentJob.status === 'failed') &&
            lastSequence >=
              ((await system.repositories.jobEvents.listByJobId(id)).at(-1)?.sequence ?? 0)
          ) {
            controller.close();
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        console.error(`SSE stream failed for job ${id}:`, error);
        controller.error(error);
      }
    },

    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
