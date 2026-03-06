import {
  ArtifactRecord,
  createEntityId,
  ExportBundle,
  PromptVersionReference,
} from '@/packages/core';
import { buildStageCacheKey, hashArtifactContent } from '@/packages/core/artifacts';
import { buildObsidianVaultExport, ObsidianVaultExportPayload } from '@/packages/obsidian-export';
import { getResearchSystem } from '@/lib/research-system';

import { getReportDetailById } from './report-detail-service';

function buildExportCacheKey(input: {
  reportId: string;
  reportUpdatedAt: string;
  researchPackId: string;
  researchPackUpdatedAt: string;
  artifacts: ArtifactRecord[];
  promptVersions: PromptVersionReference[];
}): string {
  const signature = hashArtifactContent({
    report_updated_at: input.reportUpdatedAt,
    research_pack_updated_at: input.researchPackUpdatedAt,
    artifacts: input.artifacts.map((artifact) => ({
      id: artifact.id,
      updated_at: artifact.updated_at,
      kind: artifact.kind,
      content_hash: artifact.metadata?.content_hash,
    })),
    prompt_versions: input.promptVersions.map((prompt) => ({
      key: prompt.key,
      version: prompt.version,
      model: prompt.model,
    })),
  });

  return buildStageCacheKey('export_bundle', 'obsidian_vault', input.reportId, input.researchPackId, signature);
}

function hasExportPayload(
  artifact: ArtifactRecord<ObsidianVaultExportPayload> | null,
): artifact is ArtifactRecord<ObsidianVaultExportPayload> & { content: ObsidianVaultExportPayload } {
  return Boolean(artifact?.content?.zip_base64);
}

export async function createObsidianExport(reportId: string): Promise<{
  bundle: ExportBundle;
  artifact: ArtifactRecord<ObsidianVaultExportPayload> & { content: ObsidianVaultExportPayload };
}> {
  const detail = await getReportDetailById(reportId);

  if (!detail?.researchPack) {
    throw new Error('Report research pack was not found.');
  }

  const system = getResearchSystem();
  const cacheKey = buildExportCacheKey({
    reportId: detail.report.id,
    reportUpdatedAt: detail.report.updated_at,
    researchPackId: detail.researchPack.id,
    researchPackUpdatedAt: detail.researchPack.updated_at,
    artifacts: detail.artifacts,
    promptVersions: detail.report.prompt_versions,
  });

  const cachedArtifact =
    await system.repositories.artifacts.findLatestByCacheKey<ObsidianVaultExportPayload>(cacheKey);

  const artifact =
    hasExportPayload(cachedArtifact)
      ? cachedArtifact
      : (await system.repositories.artifacts.save<ObsidianVaultExportPayload>({
          id: createEntityId('artifact'),
          kind: 'export_bundle',
          research_pack_id: detail.researchPack.id,
          cache_key: cacheKey,
          metadata: {
            canonical_video_id: detail.report.canonical_video_id,
          },
          provenance: {
            stage: 'build_exports',
            input_signature: cacheKey,
            upstream_artifact_ids: detail.artifacts.map((entry) => entry.id),
          },
          content: buildObsidianVaultExport({
            report: detail.report,
            researchPack: detail.researchPack,
            artifacts: detail.artifacts,
          }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as ArtifactRecord<ObsidianVaultExportPayload> & { content: ObsidianVaultExportPayload };

  const timestamp = new Date().toISOString();
  const bundle = await system.repositories.exports.save({
    id: createEntityId('export'),
    report_id: detail.report.id,
    research_pack_id: detail.researchPack.id,
    format: 'obsidian_vault',
    status: 'ready',
    artifact_id: artifact.id,
    created_at: timestamp,
    updated_at: timestamp,
  });

  return {
    bundle,
    artifact,
  };
}

export async function getExportDownloadById(exportId: string): Promise<{
  bundle: ExportBundle;
  artifact: ArtifactRecord<ObsidianVaultExportPayload> & { content: ObsidianVaultExportPayload };
}> {
  const system = getResearchSystem();
  const bundle = await system.repositories.exports.getById(exportId);

  if (!bundle?.artifact_id) {
    throw new Error('Export bundle not found.');
  }

  const artifact = await system.repositories.artifacts.getById<ObsidianVaultExportPayload>(bundle.artifact_id);

  if (!hasExportPayload(artifact)) {
    throw new Error('Export artifact payload is missing.');
  }

  return {
    bundle,
    artifact,
  };
}
