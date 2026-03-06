import { NextResponse } from 'next/server';

import { getJobSnapshot } from '@/lib/jobs/job-service';
import { getResearchSystem } from '@/lib/research-system';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getJobSnapshot(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const report = job.report_id
    ? await getResearchSystem().repositories.reports.getById(job.report_id)
    : null;

  return NextResponse.json({
    job,
    report: report
      ? {
          id: report.id,
          title: report.title,
        }
      : null,
  });
}
