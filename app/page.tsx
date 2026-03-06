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
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        
        {!isStreaming ? (
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900">
                Podcast<span className="text-indigo-600">FactChecker</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Turn 2-hour technical podcasts into sharp, fact-checked reports.
                We analyze every claim, find sources, and spot contradictions.
              </p>
            </div>

            <div className="w-full max-w-xl">
              <UrlInputForm onSubmit={handleStart} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full max-w-3xl mt-12">
              <FeatureCard 
                icon="⚡" 
                title="Deep Analysis" 
                desc="Extracts every topic and claim, not just a summary." 
              />
              <FeatureCard 
                icon="🔍" 
                title="Source Verification" 
                desc="Cross-checks claims against 6+ external sources." 
              />
              <FeatureCard 
                icon="📝" 
                title="Technical Prose" 
                desc="Writes like a senior engineer, preserving all details." 
              />
            </div>
          </div>
        ) : (
          <StreamingReport url={url} length={length} onReset={() => setIsStreaming(false)} />
        )}

      </div>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200/60">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}
