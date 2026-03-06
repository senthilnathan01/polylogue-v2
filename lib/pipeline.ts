import { LengthType, StreamEvent } from './types';
import { getResearchSystem } from './research-system';
import { runResearchPipeline } from '@/packages/pipeline';

export function runPipeline(
  url: string,
  lengthType: LengthType,
): AsyncGenerator<StreamEvent> {
  return runResearchPipeline(url, lengthType, getResearchSystem());
}
