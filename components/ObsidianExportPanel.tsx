'use client';

import { useState, useTransition } from 'react';
import { Download, LibraryBig, LoaderCircle } from 'lucide-react';

import { ExportReportButton } from './ExportReportButton';

export function ObsidianExportPanel({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    startTransition(async () => {
      setError(null);
      setMessage('Building the Obsidian vault from the saved research pack...');

      try {
        const response = await fetch(`/api/reports/${reportId}/exports`, {
          method: 'POST',
        });

        const payload = (await response.json()) as {
          error?: string;
          export?: {
            id: string;
            file_name: string;
            entry_count: number;
            download_url: string;
          };
        };

        if (!response.ok || !payload.export) {
          throw new Error(payload.error || 'Failed to build the export bundle.');
        }

        setMessage(`Vault ready: ${payload.export.entry_count} files. Starting download...`);
        window.location.assign(payload.export.download_url);
      } catch (exportError) {
        setError(
          exportError instanceof Error ? exportError.message : 'Failed to build the export bundle.',
        );
        setMessage(null);
      }
    });
  };

  return (
    <div className="rounded-[2rem] border border-stone-300/80 bg-white/92 p-6 shadow-[0_24px_80px_-48px_rgba(20,18,16,0.55)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Export panel</p>
      <h2 className="mt-3 font-display text-2xl text-stone-900">Obsidian vault</h2>
      <p className="mt-3 text-sm leading-7 text-stone-600">
        Generate a structured vault with topic, source, claim, contradiction, person, and canvas files directly from the saved report and research-pack artifacts.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LibraryBig className="h-4 w-4" />}
          <span>{isPending ? 'Building vault' : 'Download Obsidian vault'}</span>
        </button>

        <ExportReportButton
          label="Print / Save PDF"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
        />
      </div>

      {message ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-700">
          <Download className="h-4 w-4" />
          <span>{message}</span>
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
