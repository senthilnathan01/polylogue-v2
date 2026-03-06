'use client';

import { useState } from 'react';

import { UrlInputForm } from '@/components/UrlInputForm';
import { StreamingReport } from '@/components/StreamingReport';
import { LengthType } from '@/lib/types';

export default function Home() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [url, setUrl] = useState('');
  const [length, setLength] = useState<LengthType>('medium');

  const handleStart = (inputUrl: string, inputLength: LengthType) => {
    setUrl(inputUrl);
    setLength(inputLength);
    setIsStreaming(true);
  };

  return (
    <main className="min-h-screen px-6 py-10 text-stone-900 md:px-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        {!isStreaming ? (
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <section className="rounded-[2.5rem] border border-stone-300/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(250,241,228,0.88))] p-8 shadow-[0_32px_120px_-60px_rgba(20,18,16,0.7)] md:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-700">
                Long-form YouTube intelligence
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.95] tracking-tight text-stone-900 md:text-7xl">
                Turn one transcript into a full research report.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600 md:text-xl">
                Paste a YouTube URL and the app pulls the main transcript, extracts five to six major topics, finds one strong supporting YouTube video for each topic, collects those transcripts, and writes a detailed report that stays anchored in the original video.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                <FeatureCard
                  title="Primary-first writing"
                  desc="The main video stays central. Supporting videos extend, sharpen, and stress-test its ideas."
                />
                <FeatureCard
                  title="Topic-driven retrieval"
                  desc="Each major topic gets its own transcript-backed support video instead of generic search results."
                />
                <FeatureCard
                  title="PDF-ready output"
                  desc="Saved reports are printable with a clean layout, so they can be exported as PDFs directly."
                />
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-stone-300/80 bg-white/88 p-8 shadow-[0_32px_120px_-60px_rgba(20,18,16,0.7)] backdrop-blur md:p-10">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                  Start a run
                </p>
                <h2 className="font-display text-3xl text-stone-900 md:text-4xl">
                  Build the report
                </h2>
                <p className="text-sm leading-7 text-stone-600">
                  The current implementation expects `GEMINI_API_KEY`, `SUPADATA_API_KEY`, and `YOUTUBE_DATA_API_KEY`. Persistence currently uses a local JSON repository adapter, so the architecture is repository-driven even before Supabase lands.
                </p>
              </div>

              <div className="mt-8">
                <UrlInputForm onSubmit={handleStart} />
              </div>

              <div className="mt-10 rounded-[2rem] border border-stone-200 bg-stone-50/80 p-5 text-sm text-stone-600">
                <p className="font-medium text-stone-800">What the pipeline does</p>
                <ol className="mt-3 space-y-2">
                  <li>1. Fetch the main video transcript and map its deepest topics.</li>
                  <li>2. Retrieve one supporting YouTube transcript per topic.</li>
                  <li>3. Build a long report that preserves specifics and nuance.</li>
                </ol>
              </div>
            </section>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <StreamingReport
              key={`${url}-${length}`}
              url={url}
              length={length}
              onReset={() => setIsStreaming(false)}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[1.6rem] border border-stone-200 bg-white/70 p-5">
      <h3 className="font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
    </div>
  );
}
