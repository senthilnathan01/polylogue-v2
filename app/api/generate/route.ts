import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCachedReport } from '@/lib/services/cache-service';
import { checkAndIncrement } from '@/lib/services/quota-service';
import { runPipeline } from '@/lib/pipeline';
import { Report, StreamEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  url: z.string().url(),
  length: z.enum(['short', 'medium', 'long']),
});

function encodeEvent(encoder: TextEncoder, event: StreamEvent): Uint8Array {
  const payload = {
    ...(event.data && typeof event.data === 'object' ? event.data : {}),
    ...(event.text ? { text: event.text } : {}),
  };

  return encoder.encode(`event: ${event.stage}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = requestSchema.safeParse({
    url: searchParams.get('url'),
    length: searchParams.get('length'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid or missing url/length parameters.' },
      { status: 400 },
    );
  }

  const { url, length } = parsed.data;
  const cachedReport = await getCachedReport(url, length);

  if (cachedReport) {
    return streamCachedReport(cachedReport);
  }

  const { allowed, message } = await checkAndIncrement();
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(url, length)) {
          controller.enqueue(encodeEvent(encoder, event));
        }
      } catch (error) {
        console.error('Pipeline error:', error);
        controller.enqueue(
          encodeEvent(encoder, {
            stage: 'failed',
            text: error instanceof Error ? error.message : 'Internal server error',
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function streamCachedReport(report: Report) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const progressEvents: StreamEvent[] = [
        {
          stage: 'transcript_fetched',
          data: {
            title: report.primary_video.title,
            words: report.primary_video.transcript_word_count,
            duration_sec: report.primary_video.duration_sec,
            channel: report.primary_video.channel,
          },
        },
        {
          stage: 'topics_found',
          data: {
            topics: report.topics,
          },
        },
        {
          stage: 'sources_found',
          data: {
            sources: report.sources,
            topic_research: report.topic_research,
          },
        },
      ];

      for (const event of progressEvents) {
        controller.enqueue(encodeEvent(encoder, event));
      }

      const chunkSize = 700;
      for (let index = 0; index < report.report_text.length; index += chunkSize) {
        const chunk = report.report_text.slice(index, index + chunkSize);
        controller.enqueue(
          encodeEvent(encoder, {
            stage: 'generating_report',
            text: 'Replaying cached report...',
          }),
        );
        controller.enqueue(encodeEvent(encoder, { stage: 'token', text: chunk }));
      }

      controller.enqueue(
        encodeEvent(encoder, {
          stage: 'metadata',
          data: {
            report_id: report.id,
            title: report.title,
            thinking_text: report.thinking_text,
            primary_video: report.primary_video,
            topics: report.topics,
            sources: report.sources,
            topic_research: report.topic_research,
            word_count: report.word_count,
          },
        }),
      );
      controller.enqueue(encodeEvent(encoder, { stage: 'done', data: {} }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
