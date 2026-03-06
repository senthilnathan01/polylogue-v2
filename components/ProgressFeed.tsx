import { StreamEvent } from '@/lib/types';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function ProgressFeed({ events, isDone }: { events: StreamEvent[]; isDone: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
      <h3 className="font-bold text-slate-900 mb-4">Analysis Progress</h3>
      <ul className="space-y-4">
        {events.map((event, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm">
            {event.stage === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : isDone || i < events.length - 1 ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
            )}
            <span className="text-slate-700">{event.text || formatStage(event.stage || '')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatStage(stage: string) {
  return stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
