import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

import { ObsidianExportPanel } from '@/components/ObsidianExportPanel';
import { ThinkingReport } from '@/components/ThinkingReport';
import { formatTimestamp } from '@/packages/core';
import { getReportDetailById } from '@/lib/services/report-detail-service';

export const dynamic = 'force-dynamic';

function formatDuration(durationSec?: number): string {
  if (!durationSec || durationSec <= 0) {
    return 'Unknown duration';
  }

  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.floor((durationSec % 3600) / 60);
  const seconds = Math.floor(durationSec % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getReportDetailById(id);

  if (!detail) {
    notFound();
  }

  const { report, researchPack, artifacts } = detail;

  return (
    <main className="min-h-screen px-6 py-10 md:px-10 md:py-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="no-print rounded-[2rem] border border-stone-300/80 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                Saved report
              </p>
              <h1 className="mt-2 font-display text-4xl text-stone-900 md:text-5xl">
                {report.title}
              </h1>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                {report.primary_video.channel} · {report.primary_video.transcript_word_count.toLocaleString()} transcript words ·{' '}
                {report.word_count.toLocaleString()} report words · {report.sources.length} supporting videos
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
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-transparent px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-900 hover:text-stone-950"
              >
                New analysis
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <article className="space-y-6 rounded-[2rem] border border-stone-300/80 bg-white/92 p-8 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                <span>Final narrative report</span>
                <span className="rounded-full bg-stone-100 px-3 py-1">{report.length_type}</span>
              </div>
              <div className="report-markdown">
                <ReactMarkdown>{report.report_text}</ReactMarkdown>
              </div>
            </article>

            {report.thinking_text ? <ThinkingReport thinking={report.thinking_text} /> : null}

            <section className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                    Source traceability
                  </p>
                  <h2 className="mt-2 font-display text-2xl text-stone-900">
                    Topic-to-source evidence pack
                  </h2>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                  {report.topic_research.length} topics
                </span>
              </div>

              <div className="mt-6 space-y-5">
                {report.topic_research.map((research) => (
                  <article
                    key={research.topic.name}
                    className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          {research.topic.name}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-stone-700">
                          {research.connection_summary}
                        </p>
                      </div>

                      {research.source ? (
                        <a
                          href={research.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
                        >
                          {research.source.title}
                        </a>
                      ) : (
                        <span className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-500">
                          No supporting source
                        </span>
                      )}
                    </div>

                    {research.source?.transcript_excerpt ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          Transcript excerpt
                        </p>
                        <p className="mt-2 text-sm leading-7 text-stone-600">
                          {research.source.transcript_excerpt}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          Takeaways
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-600">
                          {research.support_takeaways.length > 0 ? (
                            research.support_takeaways.map((item, index) => (
                              <li key={`${research.topic.name}-takeaway-${index}`}>
                                {item.text}
                                {item.timestamp_sec !== undefined && research.source?.url ? (
                                  <>
                                    {' '}
                                    <a
                                      href={`${research.source.url}${research.source.url.includes('?') ? '&' : '?'}t=${Math.floor(item.timestamp_sec)}s`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-amber-700"
                                    >
                                      {formatTimestamp(item.timestamp_sec)}
                                    </a>
                                  </>
                                ) : null}
                              </li>
                            ))
                          ) : (
                            <li>No structured takeaways were recorded.</li>
                          )}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          Nuances
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-600">
                          {research.nuanced_details.length > 0 ? (
                            research.nuanced_details.map((item, index) => (
                              <li key={`${research.topic.name}-nuance-${index}`}>{item.text}</li>
                            ))
                          ) : (
                            <li>No additional nuance notes were recorded.</li>
                          )}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                          Tensions
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-600">
                          {research.tensions.length > 0 ? (
                            research.tensions.map((item, index) => (
                              <li key={`${research.topic.name}-tension-${index}`}>{item.text}</li>
                            ))
                          ) : (
                            <li>No contradictions or tensions were recorded.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {researchPack ? (
              <section className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Research pack inspection
                </p>
                <h2 className="mt-2 font-display text-2xl text-stone-900">Durable lineage</h2>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Provenance
                    </p>
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      Transcript: {researchPack.provenance.transcript_provider}
                      <br />
                      Video: {researchPack.provenance.video_provider}
                      <br />
                      LLM: {researchPack.provenance.llm_model}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Prompt bundle
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-600">
                      {researchPack.prompt_versions.map((prompt) => (
                        <li key={`${prompt.key}-${prompt.version}`}>
                          {prompt.key} · {prompt.version} · {prompt.model}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Primary video
                    </p>
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      {researchPack.primary_video.title}
                      <br />
                      {formatDuration(researchPack.primary_video.duration_sec)}
                      <br />
                      {researchPack.primary_video.transcript_word_count.toLocaleString()} transcript words
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Artifact inventory
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600">
                      {artifacts.length} artifacts
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-stone-900">{artifact.kind}</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                              {artifact.id}
                            </p>
                          </div>
                          {artifact.cache_key ? (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                              cache key present
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 break-all text-xs leading-6 text-stone-500">
                          {artifact.cache_key || 'No cache key'}
                        </p>

                        {artifact.provenance ? (
                          <p className="mt-3 text-xs leading-6 text-stone-500">
                            Stage: {artifact.provenance.stage} · upstream refs: {artifact.provenance.upstream_artifact_ids.length}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-dashed border-stone-300 bg-white/85 p-6 text-sm text-stone-600 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
                This report predates the durable research-pack surface, so traceability artifacts are not available for inspection.
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <ObsidianExportPanel reportId={report.id} />

            <section className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
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
            </section>

            <section className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
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
                      {source.topic_name} · {source.channel}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {source.research_notes || source.selection_reason}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
