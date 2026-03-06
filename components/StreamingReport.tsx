'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, ExternalLink, FileText, RotateCcw } from 'lucide-react';

import {
  LengthType,
  StreamEvent,
  Topic,
  TopicResearch,
  VideoSource,
} from '@/lib/types';

import { ExportReportButton } from './ExportReportButton';
import { ProgressFeed } from './ProgressFeed';
import { ThinkingReport } from './ThinkingReport';

interface Metadata {
  report_id: string;
  title: string;
  thinking_text: string;
  primary_video: {
    title: string;
    url: string;
    channel: string;
    duration_sec: number;
    transcript_word_count: number;
  };
  topics: Topic[];
  sources: VideoSource[];
  topic_research: TopicResearch[];
  word_count: number;
}

export function StreamingReport({
  url,
  length,
  onReset,
}: {
  url: string;
  length: LengthType;
  onReset: () => void;
}) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [reportText, setReportText] = useState('');
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/generate?url=${encodeURIComponent(url)}&length=${length}`,
    );
    let finished = false;

    const upsertEvent = (incoming: StreamEvent) => {
      setEvents((previous) => {
        const index = previous.findIndex((item) => item.stage === incoming.stage);
        if (index === -1) {
          return [...previous, incoming];
        }

        const next = [...previous];
        next[index] = {
          ...next[index],
          ...incoming,
        };
        return next;
      });
    };

    const handleEvent = (stage: string, payload: Record<string, unknown>) => {
      setIsConnecting(false);

      if (stage === 'failed') {
        finished = true;
        setError((payload.text as string) || 'An error occurred while generating the report.');
        eventSource.close();
        return;
      }

      if (stage === 'done') {
        finished = true;
        setIsDone(true);
        eventSource.close();
        return;
      }

      if (stage === 'token') {
        setReportText((previous) => previous + ((payload.text as string) || ''));
        return;
      }

      if (stage === 'metadata') {
        setMetadata(payload as unknown as Metadata);
        return;
      }

      upsertEvent({
        stage: stage as StreamEvent['stage'],
        text: typeof payload.text === 'string' ? payload.text : undefined,
        data: payload,
      });
    };

    const stages = [
      'validating_input',
      'transcript_fetched',
      'extracting_topics',
      'topics_found',
      'fetching_sources',
      'sources_found',
      'synthesizing',
      'critiquing',
      'generating_report',
      'token',
      'metadata',
      'done',
      'failed',
    ];

    stages.forEach((stage) => {
      eventSource.addEventListener(stage, (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          handleEvent(stage, payload);
        } catch (parseError) {
          console.error('Error parsing event data:', parseError);
        }
      });
    });

    eventSource.onerror = (streamError) => {
      console.error('EventSource error:', streamError);
      if (!finished) {
        setIsConnecting(false);
        setError('Connection failed. Please try again.');
        eventSource.close();
      }
    };

    return () => {
      finished = true;
      eventSource.close();
    };
  }, [url, length]);

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-col gap-4 rounded-[2rem] border border-stone-300/80 bg-white/80 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
            Transcript research pipeline
          </p>
          <h2 className="font-display text-3xl text-stone-900">
            {isDone ? metadata?.title || 'Report ready' : 'Building your report'}
          </h2>
          <p className="text-sm text-stone-600">
            {isConnecting
              ? 'Opening the analysis stream.'
              : isDone
                ? 'The report is saved and ready to review or export.'
                : 'The app is extracting themes, pulling supporting videos, and writing the final draft.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {metadata?.report_id ? (
            <Link
              href={`/report/${metadata.report_id}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
            >
              <FileText className="h-4 w-4" />
              Open saved report
            </Link>
          ) : null}

          {reportText ? (
            <ExportReportButton className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800" />
          ) : null}

          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-transparent px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-900 hover:text-stone-950"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <h3 className="font-bold">Error</h3>
              <p>{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {reportText ? (
            <div className="min-h-[500px] rounded-[2rem] border border-stone-300/80 bg-white/92 p-8 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="report-markdown">
                <ReactMarkdown>{reportText}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-stone-300 bg-white/70 p-8 text-center text-stone-500">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-amber-600" />
              <p className="font-medium text-stone-700">
                The report will appear here as it&apos;s written.
              </p>
              <p className="max-w-md text-sm text-stone-500">
                The first pass is transcript collection, then topic extraction, support-video retrieval, synthesis, critique, and final writing.
              </p>
            </div>
          )}

          {metadata?.thinking_text ? <ThinkingReport thinking={metadata.thinking_text} /> : null}
        </div>

        <div className="space-y-6">
          <ProgressFeed events={events} isDone={isDone} />

          {metadata?.primary_video ? (
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Main video
              </p>
              <h3 className="mt-3 font-display text-2xl text-stone-900">
                {metadata.primary_video.title}
              </h3>
              <p className="mt-2 text-sm text-stone-600">
                {metadata.primary_video.channel} ·{' '}
                {metadata.primary_video.transcript_word_count.toLocaleString()} transcript words
              </p>
              <a
                href={metadata.primary_video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700 transition hover:text-amber-900"
              >
                Watch original video
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}

          {metadata?.topics?.length ? (
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Major topics
              </p>
              <div className="mt-4 space-y-4">
                {metadata.topics.map((topic) => (
                  <div
                    key={`${topic.rank}-${topic.name}`}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-stone-900">{topic.name}</h3>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-stone-500">
                        #{topic.rank}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{topic.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {metadata?.sources?.length ? (
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Supporting videos
                </p>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500">
                  {metadata.sources.length}
                </span>
              </div>
              <ul className="mt-4 space-y-4">
                {metadata.sources.map((source) => (
                  <li
                    key={source.video_id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-stone-900 transition hover:text-amber-700"
                    >
                      {source.title}
                    </a>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-500">
                      {source.topic_name}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {source.research_notes || source.selection_reason}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 text-sm text-stone-600 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              Supporting video selections will appear here once topic retrieval completes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
