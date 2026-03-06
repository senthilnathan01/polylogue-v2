'use client';

import { useState } from 'react';
import { LengthType } from '@/lib/types';

export function UrlInputForm({ onSubmit }: { onSubmit: (url: string, length: LengthType) => void }) {
  const [url, setUrl] = useState('');
  const [length, setLength] = useState<LengthType>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onSubmit(url, length);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
      <input
        type="text"
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition shadow-sm text-lg"
        required
      />
      <div className="flex flex-col md:flex-row gap-4">
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as LengthType)}
          className="p-4 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm flex-1 text-lg appearance-none cursor-pointer"
        >
          <option value="short">Short (600-900w)</option>
          <option value="medium">Medium (1200-1800w)</option>
          <option value="long">Long (2500-4000w)</option>
        </select>
        <button
          type="submit"
          className="p-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow-md flex-1 text-lg"
        >
          Generate Report
        </button>
      </div>
    </form>
  );
}
