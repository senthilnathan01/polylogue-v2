import { ExtractorAgent } from './agents/extractor-agent';
import { SourceAgent } from './agents/source-agent';
import { SynthesizerAgent } from './agents/synthesizer-agent';
import { CriticAgent } from './agents/critic-agent';
import { WriterAgent } from './agents/writer-agent';
import { llm } from './services/llm-service';
import { getTranscript, getTranscriptWithTimestamps } from './services/youtube-service';
import { LengthType, StreamEvent, Report, VideoSource } from './types';
import { saveReport } from './services/cache-service';

export async function* runPipeline(url: string, lengthType: LengthType): AsyncGenerator<StreamEvent> {
  const extractor = new ExtractorAgent(llm);
  const sourceAgent = new SourceAgent(llm);
  const synthesizer = new SynthesizerAgent(llm);
  const critic = new CriticAgent(llm);
  const writer = new WriterAgent(llm);

  // 1. Fetch Transcript
  yield { stage: 'transcript_fetched', text: 'Fetching transcript...' };
  const transcript = await getTranscript(url);
  if (!transcript) {
    yield { stage: 'error', text: 'Failed to fetch transcript. Please try another video.' };
    return;
  }
  
  // Get duration
  const segments = await getTranscriptWithTimestamps(url);
  const duration = segments && segments.length > 0 ? segments[segments.length - 1].start + segments[segments.length - 1].duration : 0;

  yield { stage: 'transcript_fetched', data: { words: transcript.split(' ').length } };

  // 2. Extract Topics & Claims
  yield { stage: 'extracting_topics', text: 'Analyzing transcript...' };
  const extractorOutput = await extractor.run(transcript, duration);
  yield { stage: 'topics_found', data: { topics: extractorOutput.all_topics.map(t => t.name) } };

  // 3. Fetch Sources (Parallel)
  yield { stage: 'fetching_sources', text: 'Searching for sources...' };
  const top5 = extractorOutput.top_5_topics;
  
  // Split topics for agents
  const topics1 = top5.slice(0, 2);
  const topics2 = top5.slice(2, 4);
  const topic5 = top5.slice(4, 5);
  const speaker = extractorOutput.speakers[0]; // Use first speaker

  const [sourceOutput1, sourceOutput2, sourceOutput3] = await Promise.all([
    sourceAgent.run(topics1),
    sourceAgent.run(topics2),
    sourceAgent.run(topic5, speaker),
  ]);

  const sources: VideoSource[] = [
    ...sourceOutput1.sources,
    ...sourceOutput2.sources,
    ...sourceOutput3.sources,
  ];

  yield { stage: 'sources_found', data: { sources: sources.map(s => ({ title: s.title, url: s.url })) } };

  // 4. Synthesize
  yield { stage: 'synthesizing', text: 'Verifying claims...' };
  const synthesizerOutput = await synthesizer.run(extractorOutput.claims, sources);

  // 5. Critique
  yield { stage: 'critiquing', text: 'Reviewing draft...' };
  const criticOutput = await critic.run(synthesizerOutput);

  // 6. Write Report (Stream)
  yield { stage: 'generating_report', text: 'Writing report...' };
  
  let fullReportText = "";
  for await (const chunk of writer.streamReport(synthesizerOutput, criticOutput, extractorOutput.all_topics, lengthType)) {
    fullReportText += chunk;
    yield { stage: 'token', text: chunk };
  }

  // 7. Finalize
  const report: Partial<Report> = {
    youtube_url: url,
    length_type: lengthType,
    report_text: fullReportText,
    thinking_text: synthesizerOutput.thinking_notes,
    sources: sources,
    topics: extractorOutput.all_topics,
    created_at: new Date().toISOString(),
  };

  // Save to cache
  const reportId = await saveReport(report);

  yield { stage: 'metadata', data: { 
    claims: synthesizerOutput.verified_claims, 
    sources: sources,
    report_id: reportId,
    thinking_text: synthesizerOutput.thinking_notes
  } };
  
  yield { stage: 'done' };
}
