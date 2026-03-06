import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createOrReuseJob } from '@/lib/jobs/job-service';
import { ensureJobWorkerRunning } from '@/lib/jobs/job-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  url: z.string().url(),
  length: z.enum(['short', 'medium', 'long']),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing url/length parameters.' }, { status: 400 });
  }

  try {
    const result = await createOrReuseJob({
      youtubeUrl: parsed.data.url,
      lengthType: parsed.data.length,
    });

    ensureJobWorkerRunning();

    return NextResponse.json(
      {
        job: result.job,
        reused: result.reused,
      },
      { status: result.reused ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job';
    const status = message.includes('limit') ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
