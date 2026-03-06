'use client';

import { Download } from 'lucide-react';

export function ExportReportButton({
  label = 'Print / Save PDF',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Download className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
