import { ArtifactRecord, Report, ResearchPack } from '@/packages/core';
import { getResearchSystem } from '@/lib/research-system';

export interface ReportDetail {
  report: Report;
  researchPack: ResearchPack | null;
  artifacts: ArtifactRecord[];
}

export async function getReportDetailById(id: string): Promise<ReportDetail | null> {
  const system = getResearchSystem();
  const report = await system.repositories.reports.getById(id);

  if (!report) {
    return null;
  }

  const researchPack = await system.repositories.researchPacks.getById(report.research_pack_id);
  const artifacts = researchPack
    ? await system.repositories.artifacts.listByResearchPackId(researchPack.id)
    : [];

  return {
    report,
    researchPack,
    artifacts: [...artifacts].sort((left, right) => left.created_at.localeCompare(right.created_at)),
  };
}
