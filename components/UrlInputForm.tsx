'use client';

import { useState } from 'react';
import { LengthType } from '@/lib/types';

export function UrlInputForm({ onSubmit }: { onSubmit: (url: string, length: LengthType) => void }) {
  const [url, setUrl] = useState('');
  const [length, setLength] = useState<LengthType>('medium');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');

      if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(hostname)) {
        setError('Enter a valid YouTube watch, live, shorts, or youtu.be URL.');
        return;
      }
    } catch {
      setError('Enter a valid YouTube URL.');
      return;
    }

    setError(null);
    onSubmit(url, length);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
      <input
        type="text"
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) {
            setError(null);
          }
        }}
        className="w-full rounded-2xl border border-stone-300 bg-white/90 px-5 py-4 text-lg shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        required
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-col md:flex-row gap-4">
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as LengthType)}
          className="cursor-pointer appearance-none rounded-2xl border border-stone-300 bg-white px-5 py-4 text-lg shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 md:flex-1"
        >
          <option value="short">Focused (1800-2400w)</option>
          <option value="medium">Deep (3000-4200w)</option>
          <option value="long">Exhaustive (5000-6500w)</option>
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-stone-950 px-5 py-4 text-lg font-semibold text-stone-50 shadow-md transition hover:bg-stone-800 md:flex-1"
        >
          Build Report
        </button>
      </div>
    </form>
  );
}
