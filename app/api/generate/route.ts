import { NextRequest, NextResponse } from 'next/server';
import { checkAndIncrement } from '@/lib/services/quota-service';
import { getCachedReport, getReportClaims } from '@/lib/services/cache-service';
import { runPipeline } from '@/lib/pipeline';
import { LengthType, Report } from '@/lib/types';

export const runtime = 'nodejs'; // Use Node.js runtime for youtube-transcript

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const length = searchParams.get('length') as LengthType;

  if (!url || !length) {
    return NextResponse.json({ error: 'Missing url or length' }, { status: 400 });
  }

  // 1. Check Quota
  const { allowed, message } = await checkAndIncrement();
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  // 2. Check Cache
  const cachedReport = await getCachedReport(url, length);
  if (cachedReport) {
    return streamCachedReport(cachedReport);
  }

  // 3. Run Pipeline
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(url, length)) {
          let data = event.data;
          if (event.text) {
            data = { ...data, text: event.text };
          }
          controller.enqueue(encoder.encode(`event: ${event.stage}\ndata: ${JSON.stringify(data)}\n\n`));
        }
      } catch (error) {
        console.error('Pipeline error:', error);
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ text: 'Internal server error' })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function streamCachedReport(report: Report) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Simulate progress events
      controller.enqueue(encoder.encode(`event: transcript_fetched\ndata: ${JSON.stringify({ words: 10000 })}\n\n`));
      controller.enqueue(encoder.encode(`event: topics_found\ndata: ${JSON.stringify({ topics: report.topics?.map(t => t.name) || [] })}\n\n`));
      controller.enqueue(encoder.encode(`event: sources_found\ndata: ${JSON.stringify({ sources: report.sources?.map(s => ({ title: s.title, url: s.url })) || [] })}\n\n`));
      
      // Stream report text token by token (simulated)
      const text = report.report_text || "";
      const chunkSize = 50; // Faster simulation
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`));
        await new Promise(resolve => setTimeout(resolve, 5)); // Faster simulation
      }

      // Fetch claims
      const claims = await getReportClaims(report.id);

      // Metadata
      controller.enqueue(encoder.encode(`event: metadata\ndata: ${JSON.stringify({ 
        claims: claims,
        sources: report.sources,
        report_id: report.id
      })}\n\n`));
      
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
