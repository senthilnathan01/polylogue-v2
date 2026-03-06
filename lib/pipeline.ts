import { ExtractorAgent } from './agents/extractor-agent';
import { SourceAgent } from './agents/source-agent';
import { SynthesizerAgent } from './agents/synthesizer-agent';
import { CriticAgent } from './agents/critic-agent';
import { WriterAgent } from './agents/writer-agent';
import { llm } from './services/llm-service';
import { getPrimaryVideo } from './services/youtube-service';
import { LengthType, Report, StreamEvent } from './types';
import { saveReport } from './services/cache-service';

export async function* runPipeline(url: string, lengthType: LengthType): AsyncGenerator<StreamEvent> {
  const extractor = new ExtractorAgent(llm);
  const sourceAgent = new SourceAgent(llm);
  const synthesizer = new SynthesizerAgent(llm);
  const critic = new CriticAgent(llm);
  const writer = new WriterAgent(llm);

  yield { stage: 'validating_input', text: 'Validating the YouTube link...' };

  yield { stage: 'transcript_fetched', text: 'Fetching the main video transcript...' };
  const primaryVideo = await getPrimaryVideo(url);

  if (!primaryVideo) {
    yield {
      stage: 'failed',
      text: 'Could not fetch a transcript for that YouTube video. Try another URL with available captions.',
    };
    return;
  }

  yield {
    stage: 'transcript_fetched',
    data: {
      title: primaryVideo.title,
      words: primaryVideo.transcript_word_count,
      duration_sec: primaryVideo.duration_sec,
      channel: primaryVideo.channel,
    },
  };

  yield { stage: 'extracting_topics', text: 'Mapping the main themes from the primary video...' };
  const extractorOutput = await extractor.run(primaryVideo);
  yield {
    stage: 'topics_found',
    data: {
      topics: extractorOutput.top_topics,
      summary: extractorOutput.overall_summary,
    },
  };

  yield {
    stage: 'fetching_sources',
    text: 'Finding one strong transcript-backed support video for each topic...',
  };
  const sourceOutput = await sourceAgent.run(primaryVideo, extractorOutput.top_topics);
  yield {
    stage: 'sources_found',
    data: {
      sources: sourceOutput.sources,
      topic_research: sourceOutput.topic_research,
    },
  };

  yield { stage: 'synthesizing', text: 'Building the long-form report plan...' };
  const synthesizerOutput = await synthesizer.run(
    primaryVideo,
    extractorOutput,
    sourceOutput.topic_research,
    lengthType,
  );

  yield { stage: 'critiquing', text: 'Checking the plan for missing nuance and weak sections...' };
  const criticOutput = await critic.run(
    primaryVideo,
    sourceOutput.topic_research,
    synthesizerOutput,
  );

  yield { stage: 'generating_report', text: 'Writing the final report...' };
  const writerOutput = await writer.run(
    primaryVideo,
    extractorOutput,
    sourceOutput.topic_research,
    synthesizerOutput,
    criticOutput,
    lengthType,
  );

  let fullReportText = '';
  for await (const chunk of writer.streamReport(writerOutput.report_text)) {
    fullReportText += chunk;
    yield { stage: 'token', text: chunk };
  }

  const reportInput: Omit<Report, 'id' | 'created_at' | 'updated_at'> = {
    youtube_url: url,
    length_type: lengthType,
    title: writerOutput.title,
    report_text: fullReportText,
    thinking_text: writerOutput.thinking_text,
    primary_video: {
      video_id: primaryVideo.video_id,
      title: primaryVideo.title,
      url: primaryVideo.url,
      channel: primaryVideo.channel,
      view_count: primaryVideo.view_count,
      published_at: primaryVideo.published_at,
      duration_sec: primaryVideo.duration_sec,
      description: primaryVideo.description,
      transcript_word_count: primaryVideo.transcript_word_count,
    },
    sources: sourceOutput.sources,
    topics: extractorOutput.top_topics,
    topic_research: sourceOutput.topic_research,
    synthesis: synthesizerOutput,
    word_count: fullReportText.split(/\s+/).filter(Boolean).length,
  };

  const savedReport = await saveReport(reportInput);

  yield {
    stage: 'metadata',
    data: {
      report_id: savedReport.id,
      title: savedReport.title,
      thinking_text: savedReport.thinking_text,
      primary_video: savedReport.primary_video,
      topics: savedReport.topics,
      sources: savedReport.sources,
      topic_research: savedReport.topic_research,
      word_count: savedReport.word_count,
    },
  };

  yield { stage: 'done' };
}
