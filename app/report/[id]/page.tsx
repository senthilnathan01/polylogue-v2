import Link from 'next/link';
import { getReportById, getReportClaims } from '@/lib/services/cache-service';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { ThinkingReport } from '@/components/ThinkingReport';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);
  
  if (!report) {
    notFound();
  }

  const claims = await getReportClaims(id);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900">Podcast Analysis</h1>
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition px-4 py-2 rounded-lg hover:bg-slate-100">
              New Analysis
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="prose prose-slate max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60">
                <ReactMarkdown>{report.report_text || ''}</ReactMarkdown>
              </div>
              
              {report.thinking_text && (
                <ThinkingReport thinking={report.thinking_text} />
              )}
            </div>

            <div className="space-y-6">
              {report.sources && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span>Sources</span>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{report.sources.length}</span>
                  </h3>
                  <ul className="space-y-3">
                    {report.sources.map((source, i) => (
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
      </div>
    </main>
  );
}
