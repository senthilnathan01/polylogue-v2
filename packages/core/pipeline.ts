import { LengthType, PipelineRequest, PromptVersion, PromptVersionReference } from './domain';

export function createEntityId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function buildPromptBundleId(promptVersions: PromptVersion[]): string {
  return promptVersions.map((item) => `${item.key}:${item.version}`).join('|');
}

export function createPromptVersionReferences(
  promptVersions: PromptVersion[],
  model: string,
): PromptVersionReference[] {
  return promptVersions.map((promptVersion) => ({
    id: promptVersion.id,
    key: promptVersion.key,
    version: promptVersion.version,
    model,
  }));
}

export function buildIdempotencyKey(input: {
  canonical_video_id: string;
  length_type: LengthType;
  prompt_bundle_id: string;
}): string {
  return [
    'report',
    input.canonical_video_id,
    input.length_type,
    input.prompt_bundle_id,
  ].join(':');
}

export function createPipelineRequest(
  youtube_url: string,
  length_type: LengthType,
): PipelineRequest {
  return {
    youtube_url,
    length_type,
  };
}
