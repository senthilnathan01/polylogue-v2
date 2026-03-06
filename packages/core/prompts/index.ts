import { PromptKey, PromptVersion } from '../domain';
import { CRITIC_PROMPT_VERSION } from './critic';
import { EXTRACTOR_PROMPT_VERSION } from './extractor';
import { SOURCE_ANALYSIS_PROMPT_VERSION } from './source-analysis';
import { SYNTHESIZER_PROMPT_VERSION } from './synthesizer';
import { WRITER_PROMPT_VERSION } from './writer';

export const PROMPT_REGISTRY: Record<PromptKey, PromptVersion> = {
  extractor: EXTRACTOR_PROMPT_VERSION,
  source_analysis: SOURCE_ANALYSIS_PROMPT_VERSION,
  synthesizer: SYNTHESIZER_PROMPT_VERSION,
  critic: CRITIC_PROMPT_VERSION,
  writer: WRITER_PROMPT_VERSION,
};

export const ACTIVE_PROMPT_VERSIONS: PromptVersion[] = Object.values(PROMPT_REGISTRY);
