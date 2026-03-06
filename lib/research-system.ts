import { GeminiLlmProvider } from '@/lib/providers/gemini-llm-provider';
import { CachedTranscriptProvider } from '@/lib/providers/cached-transcript-provider';
import { SupadataTranscriptProvider } from '@/lib/providers/supadata-transcript-provider';
import { YouTubeDataVideoProvider } from '@/lib/providers/youtube-data-video-provider';
import { createLocalResearchRepositories } from '@/lib/repositories/local-research-repositories';
import { ResearchPipelineDependencies } from '@/packages/pipeline';
import { createSupabaseResearchRepositories } from '@/lib/repositories/supabase-research-repositories';
import { getSupabaseClient } from '@/lib/supabase';

const llm = new GeminiLlmProvider();
const videoProvider = new YouTubeDataVideoProvider();
let repositories: ResearchPipelineDependencies['repositories'] | null = null;
let transcriptProvider: ResearchPipelineDependencies['transcriptProvider'] | null = null;

function getRepositories(): ResearchPipelineDependencies['repositories'] {
  if (repositories) {
    return repositories;
  }

  const supabase = getSupabaseClient();
  repositories = supabase
    ? createSupabaseResearchRepositories(supabase)
    : createLocalResearchRepositories();

  return repositories;
}

function getTranscriptProvider(): ResearchPipelineDependencies['transcriptProvider'] {
  if (transcriptProvider) {
    return transcriptProvider;
  }

  transcriptProvider = new CachedTranscriptProvider(
    new SupadataTranscriptProvider(),
    getRepositories().artifacts,
    videoProvider,
  );

  return transcriptProvider;
}

export function getResearchSystem(): ResearchPipelineDependencies {
  return {
    llm,
    transcriptProvider: getTranscriptProvider(),
    videoProvider,
    repositories: getRepositories(),
  };
}
