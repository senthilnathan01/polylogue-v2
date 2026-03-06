'use client';

import { useEffect, useState, useRef } from 'react';
import { LengthType, StreamEvent, Claim, VideoSource } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { ProgressFeed } from './ProgressFeed';
import { ThinkingReport } from './ThinkingReport';
import { AlertCircle } from 'lucide-react';

interface Metadata {
  claims: Claim[];
  sources: VideoSource[];
  report_id: string;
  thinking_text: string;
}

export function StreamingReport({ url, length, onReset }: { url: string; length: LengthType; onReset: () => void }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [reportText, setReportText] = useState('');
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isDone) return;

    const eventSource = new EventSource(`/api/generate?url=${encodeURIComponent(url)}&length=${length}`);
    eventSourceRef.current = eventSource;

    const handleEvent = (stage: string, data: any) => {
      if (stage === 'error') {
        setError(data.text || 'An error occurred');
        eventSource.close();
        return;
      }
      if (stage === 'done') {
        setIsDone(true);
        eventSource.close();
        return;
      }
      if (stage === 'token') {
        setReportText(prev => prev + (data.text || ''));
      } else if (stage === 'metadata') {
        setMetadata(data);
      } else {
        setEvents(prev => {
          return [...prev, { stage, ...data }];
        });
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stage) {
          handleEvent(data.stage, data);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    const stages = [
      'transcript_fetched', 'extracting_topics', 'topics_found', 
      'fetching_sources', 'sources_found', 'synthesizing', 
      'critiquing', 'generating_report', 'token', 'metadata', 'done', 'error'
    ];

    stages.forEach(stage => {
      eventSource.addEventListener(stage, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handleEvent(stage, data);
        } catch (err) {
          console.error('Error parsing event data:', err);
        }
      });
    });

    eventSource.onerror = (e) => {
      console.error('EventSource error:', e);
      // Only set error if we haven't finished yet
      if (!isDone) {
        setError('Connection failed. Please try again.');
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
    };
  }, [url, length, isDone]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          {isDone ? 'Report Ready' : 'Generating Report...'}
          {isDone && <span className="text-green-500 text-sm font-normal bg-green-50 px-2 py-1 rounded-full border border-green-200">Done</span>}
        </h2>
        <button 
          onClick={onReset} 
          className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition px-4 py-2 rounded-lg hover:bg-slate-100"
        >
          Start Over
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {reportText ? (
            <div className="prose prose-slate max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60 min-h-[500px]">
              <ReactMarkdown>{reportText}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 gap-2">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
              <p>Waiting for analysis to complete...</p>
            </div>
          )}
          
          {metadata && metadata.thinking_text && (
            <ThinkingReport thinking={metadata.thinking_text} />
          )}
        </div>

        <div className="space-y-6">
          <ProgressFeed events={events} isDone={isDone} />
          
          {metadata && metadata.sources && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span>Sources</span>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{metadata.sources.length}</span>
              </h3>
              <ul className="space-y-3">
                {metadata.sources.map((source, i) => (
                  <li key={i} className="text-sm group">
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-900 font-medium block truncate group-hover:text-indigo-600 transition"
                    >
                      {source.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-500 text-xs font-medium">{source.channel}</span>
                      <span className="text-slate-300 text-xs">•</span>
                      <span className="text-slate-500 text-xs">{source.view_count?.toLocaleString()} views</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
