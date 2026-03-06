import { StreamEvent } from '@/lib/types';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function ProgressFeed({ events, isDone }: { events: StreamEvent[]; isDone: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
      <h3 className="font-bold text-slate-900 mb-4">Analysis Progress</h3>
      <ul className="space-y-4">
        {events.map((event, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm">
            {event.stage === 'failed' ? (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : isDone || i < events.length - 1 ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
            )}
            <span className="text-slate-700">{event.text || describeEvent(event)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeEvent(event: StreamEvent) {
  const data =
    event.data && typeof event.data === 'object'
      ? (event.data as Record<string, unknown>)
      : null;

  if (event.stage === 'transcript_fetched') {
    const words = typeof data?.words === 'number' ? data.words.toLocaleString() : null;
    return words ? `Main transcript loaded (${words} words).` : 'Main transcript loaded.';
  }

  if (event.stage === 'topics_found') {
    const topics = Array.isArray(data?.topics) ? data.topics.length : 0;
    return `Mapped ${topics} major topics from the main transcript.`;
  }

  if (event.stage === 'sources_found') {
    const sources = Array.isArray(data?.sources) ? data.sources.length : 0;
    return `Selected ${sources} supporting videos with accessible transcripts.`;
  }

  const labels: Record<string, string> = {
    validating_input: 'Validating the YouTube link.',
    transcript_fetched: 'Fetching the main video transcript.',
    extracting_topics: 'Extracting major topics from the primary video.',
    topics_found: 'Topics identified.',
    fetching_sources: 'Searching for supporting videos.',
    sources_found: 'Supporting videos selected.',
    synthesizing: 'Building the report plan.',
    critiquing: 'Checking for missing nuance and weak sections.',
    generating_report: 'Writing the report.',
    metadata: 'Saving the report.',
    done: 'Completed.',
    failed: 'Generation failed.',
  };

  return labels[event.stage] ?? event.stage;
}
