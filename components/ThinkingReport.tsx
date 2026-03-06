'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function ThinkingReport({ thinking }: { thinking: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-100 rounded-2xl border border-slate-200/60 overflow-hidden mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-slate-700 hover:bg-slate-200/50 transition"
      >
        <span>Thinking Process & Notes</span>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {isOpen && (
        <div className="p-6 border-t border-slate-200/60 prose prose-slate max-w-none text-sm text-slate-600">
          <ReactMarkdown>{thinking}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
