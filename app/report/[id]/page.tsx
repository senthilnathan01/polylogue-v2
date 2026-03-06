import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

import { ExportReportButton } from '@/components/ExportReportButton';
import { ThinkingReport } from '@/components/ThinkingReport';
import { getReportById } from '@/lib/services/cache-service';

export const dynamic = 'force-dynamic';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportById(id);

  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-10 md:py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="no-print flex flex-col gap-4 rounded-[2rem] border border-stone-300/80 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Saved report
            </p>
            <h1 className="mt-2 font-display text-4xl text-stone-900">{report.title}</h1>
            <p className="mt-3 text-sm text-stone-600">
              {report.primary_video.channel} ·{' '}
              {report.primary_video.transcript_word_count.toLocaleString()} transcript words ·{' '}
              {report.word_count.toLocaleString()} report words
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={report.primary_video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
            >
              Watch source video
            </a>
            <ExportReportButton className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800" />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-transparent px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-900 hover:text-stone-950"
            >
              New analysis
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="space-y-6">
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-8 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="report-markdown">
                <ReactMarkdown>{report.report_text}</ReactMarkdown>
              </div>
            </div>

            {report.thinking_text ? <ThinkingReport thinking={report.thinking_text} /> : null}
          </article>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Topics
              </p>
              <div className="mt-4 space-y-4">
                {report.topics.map((topic) => (
                  <div
                    key={`${topic.rank}-${topic.name}`}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold text-stone-900">{topic.name}</h2>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-stone-500">
                        #{topic.rank}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{topic.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Supporting videos
                </p>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500">
                  {report.sources.length}
                </span>
              </div>
              <ul className="mt-4 space-y-4">
                {report.sources.map((source) => (
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
          </aside>
        </div>
      </div>
    </main>
  );
}
