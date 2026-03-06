import { NextResponse } from 'next/server';

import { createObsidianExport } from '@/lib/services/export-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { bundle, artifact } = await createObsidianExport(id);

    return NextResponse.json({
      export: {
        id: bundle.id,
        format: bundle.format,
        status: bundle.status,
        file_name: artifact.content.file_name,
        entry_count: artifact.content.entry_manifest.length,
        download_url: `/api/exports/${bundle.id}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build export.';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
