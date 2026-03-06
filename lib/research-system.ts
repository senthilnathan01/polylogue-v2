import { GeminiLlmProvider } from '@/lib/providers/gemini-llm-provider';
import { SupadataTranscriptProvider } from '@/lib/providers/supadata-transcript-provider';
import { YouTubeDataVideoProvider } from '@/lib/providers/youtube-data-video-provider';
import { createLocalResearchRepositories } from '@/lib/repositories/local-research-repositories';
import { ResearchPipelineDependencies } from '@/packages/pipeline';

const llm = new GeminiLlmProvider();
const transcriptProvider = new SupadataTranscriptProvider();
const videoProvider = new YouTubeDataVideoProvider();
const repositories = createLocalResearchRepositories();

export function getResearchSystem(): ResearchPipelineDependencies {
  return {
    llm,
    transcriptProvider,
    videoProvider,
    repositories,
  };
}
