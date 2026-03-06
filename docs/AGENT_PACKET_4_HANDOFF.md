# Agent Packet 4 Handoff

## Stage graph

```text
ingest_primary_video
  -> fetch_primary_transcript
  -> extract_topics
  -> search_supporting_videos
  -> fetch_supporting_transcripts
  -> build_research_pack
  -> render_report
  -> build_exports (currently deferred placeholder)
```

Runtime mapping in [`packages/pipeline/stages.ts`](/Users/tsn/Documents/all_things_python/polylogue-v2/packages/pipeline/stages.ts):

- `ingestPrimaryVideoStage`
  Resolves canonical video metadata once and persists a `primary_video_metadata` artifact.
- `fetchPrimaryTranscriptStage`
  Reuses transcript artifacts by video ID, computes transcript hash metadata, and rebuilds the full `PrimaryVideo`.
- `extractTopicsStage`
  Reuses topic maps by transcript hash plus extractor prompt version.
- `searchSupportingVideosStage`
  Reuses supporting video selections inside a freshness window keyed by canonical video ID plus topic-map hash.
- `fetchSupportingTranscriptsStage`
  Reuses transcript artifacts for each selected support video by video ID.
- `buildResearchPackStage`
  Rebuilds analyzed `source_selection` output from topic map + selected videos + supporting transcript artifacts, then saves the `ResearchPack`.
- `renderReportStage`
  Separately caches synthesis, critic, and final markdown artifacts so writer failures rerun without touching transcript/topic/source stages.
- `buildExportsStage`
  Added as the packet 4 stage boundary; actual export generation remains deferred to Packet 5.

## Cache key design

- `primary_video_metadata:<canonical_video_id>`
  Canonical video identity only.
- `transcript:<video_id>`
  Shared across primary and supporting transcript reuse.
- `topic_map:<transcript_hash>:extractor:<version>:<model>`
  Invalidates only when transcript content or extractor prompt/model changes.
- `supporting_video_selection:<canonical_video_id>:<topic_map_hash>`
  Reused until the freshness window expires.
- `source_selection:<canonical_video_id>:<topic_map_hash>:<supporting_transcript_signature>:source_analysis:<version>:<model>`
  Invalidates when selected support transcripts or source-analysis prompt/model changes.
- `synthesis_plan:<canonical_video_id>:<source_selection_hash>:<length_type>:synthesizer:<version>:<model>`
  Length-specific render planning over a stable research pack.
- `critic_notes:<canonical_video_id>:<synthesis_hash>:critic:<version>:<model>`
  Tied to the synthesis output, not to transcript fetch.
- `report_markdown:<canonical_video_id>:<synthesis_hash>:<critic_hash>:<length_type>:writer:<version>:<model>`
  Lets report reruns reuse cached writer output when upstream render inputs are unchanged.

## Recomputation matrix

- Primary transcript changed
  Recompute topics, supporting video search, supporting transcript signature, source analysis, synthesis, critic, and report.
- Extractor prompt version changed
  Recompute topic map and every downstream stage.
- Source search freshness window expired
  Recompute supporting video selection, supporting transcripts for any new sources, source analysis, synthesis, critic, and report.
- Supporting transcript changed for one selected source
  Recompute source analysis, synthesis, critic, and report only.
- Source-analysis prompt version changed
  Recompute `source_selection`, synthesis, critic, and report.
- Synthesizer prompt version changed
  Recompute synthesis, critic, and report only.
- Critic prompt version changed
  Recompute critic and report only.
- Writer prompt version changed
  Recompute report only.
- Requested report length changed
  Reuse transcript/topic/source artifacts; rerun synthesis, critic, and writer for the new length.
- Writer stage failed
  New job run can reuse all upstream artifacts through `report_markdown` cache inputs and avoid transcript/topic/source recomputation.

## Artifact versioning map

- `primary_video_metadata`
  Versioned by canonical video ID; carries `metadata.content_hash` and provider provenance.
- `primary_transcript` / legacy `transcript`
  Versioned by `video_id`; carries `metadata.transcript_hash`, word count, and transcript provider provenance.
- `supporting_video_selection`
  Versioned by canonical video ID plus topic-map hash; carries freshness-window provenance.
- `topic_map`
  Versioned by transcript hash plus extractor prompt version/model.
- `supporting_transcript`
  Versioned by supporting `video_id`; carries transcript hash and provider provenance.
- `source_selection`
  Versioned by topic-map hash, supporting transcript signature, and source-analysis prompt version/model.
- `synthesis_plan`
  Versioned by analyzed source-selection hash, requested length, and synthesizer prompt version/model.
- `critic_notes`
  Versioned by synthesis hash and critic prompt version/model.
- `report_markdown`
  Versioned by synthesis hash, critic hash, requested length, and writer prompt version/model.

## Remaining notes

- Multiple jobs now reuse upstream artifacts across report lengths, but each job still writes its own `ResearchPack` row keyed to the current job ID.
- `build_exports` is intentionally a no-op boundary until Packet 5 adds export artifacts and downloadable bundles.
- Artifact rows now carry `metadata` and `provenance` JSON for cache signatures, transcript hashes, provider lineage, and upstream artifact references.
