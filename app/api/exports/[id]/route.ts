import { getExportDownloadById } from '@/lib/services/export-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { artifact } = await getExportDownloadById(id);
    const buffer = Buffer.from(artifact.content.zip_base64, 'base64');

    return new Response(buffer, {
      headers: {
        'Content-Type': artifact.content.mime_type,
        'Content-Disposition': `attachment; filename="${artifact.content.file_name}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download export.';
    const status = message.includes('not found') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
