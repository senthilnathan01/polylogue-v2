import {
  ArtifactRecord,
  Report,
  ResearchPack,
  TopicResearch,
  VideoSource,
  formatTimestamp,
} from '@/packages/core';

import { buildZipArchive, ZipEntry } from './zip';

interface ExportClaim {
  id: string;
  topic_name: string;
  source_title?: string;
  source_url?: string;
  source_video_id?: string;
  text: string;
  timestamp_sec?: number;
}

interface ExportContradiction {
  id: string;
  topic_name: string;
  source_title?: string;
  source_url?: string;
  source_video_id?: string;
  text: string;
  timestamp_sec?: number;
}

interface ExportPerson {
  id: string;
  name: string;
  videos: VideoSource[];
  topics: string[];
}

export interface ObsidianVaultExportPayload {
  format: 'obsidian_vault';
  file_name: string;
  mime_type: 'application/zip';
  generated_at: string;
  entry_manifest: Array<{
    path: string;
    byte_size: number;
  }>;
  zip_base64: string;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|#^\[\]]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

function withTimestamp(url: string | undefined, timestampSec: number | undefined): string | null {
  if (!url || timestampSec === undefined) {
    return null;
  }

  return `${url}${url.includes('?') ? '&' : '?'}t=${Math.max(Math.floor(timestampSec), 0)}s`;
}

function yamlScalar(value: string | number | boolean | null | undefined): string {
  if (value === undefined || value === null) {
    return 'null';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function renderFrontmatter(values: Record<string, unknown>): string {
  const lines = Object.entries(values).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.length === 0
        ? [`${key}: []`]
        : [`${key}:`, ...value.map((item) => `  - ${yamlScalar(String(item))}`)];
    }

    return `${key}: ${yamlScalar(value as string | number | boolean | null | undefined)}`;
  });

  return ['---', ...lines, '---'].join('\n');
}

function wikiLink(pathWithoutExtension: string, label?: string): string {
  return label ? `[[${pathWithoutExtension}|${label}]]` : `[[${pathWithoutExtension}]]`;
}

function makeTitleRegistry() {
  const used = new Map<string, number>();

  return (value: string) => {
    const normalized = sanitizeFileName(value);
    const count = used.get(normalized) ?? 0;
    used.set(normalized, count + 1);
    return count === 0 ? normalized : `${normalized} ${count + 1}`;
  };
}

function buildPeople(report: Report): ExportPerson[] {
  const personMap = new Map<string, ExportPerson>();

  const remember = (name: string | undefined, source: VideoSource | null, topicName?: string) => {
    if (!name) {
      return;
    }

    const key = name.trim().toLowerCase();
    const current = personMap.get(key) ?? {
      id: key.replace(/[^a-z0-9]+/g, '-'),
      name: name.trim(),
      videos: [],
      topics: [],
    };

    if (source && !current.videos.some((video) => video.video_id === source.video_id)) {
      current.videos.push(source);
    }

    if (topicName && !current.topics.includes(topicName)) {
      current.topics.push(topicName);
    }

    personMap.set(key, current);
  };

  remember(report.primary_video.channel, null, 'Primary video');

  for (const research of report.topic_research) {
    remember(research.source?.channel, research.source, research.topic.name);
  }

  return [...personMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildClaims(topicResearch: TopicResearch[]): ExportClaim[] {
  return topicResearch.flatMap((research, topicIndex) =>
    research.support_takeaways.map((takeaway, takeawayIndex) => ({
      id: `claim-${topicIndex + 1}-${takeawayIndex + 1}`,
      topic_name: research.topic.name,
      source_title: research.source?.title,
      source_url: research.source?.url,
      source_video_id: research.source?.video_id,
      text: takeaway.text,
      timestamp_sec: takeaway.timestamp_sec,
    })),
  );
}

function buildContradictions(topicResearch: TopicResearch[]): ExportContradiction[] {
  return topicResearch.flatMap((research, topicIndex) =>
    research.tensions.map((tension, tensionIndex) => ({
      id: `contradiction-${topicIndex + 1}-${tensionIndex + 1}`,
      topic_name: research.topic.name,
      source_title: research.source?.title,
      source_url: research.source?.url,
      source_video_id: research.source?.video_id,
      text: tension.text,
      timestamp_sec: tension.timestamp_sec,
    })),
  );
}

function buildCanvasFile(input: {
  reportFile: string;
  topicFiles: Map<string, string>;
  sourceFiles: Map<string, string>;
  personFiles: Map<string, string>;
  claimFiles: Map<string, string>;
  contradictionFiles: Map<string, string>;
  report: Report;
  people: ExportPerson[];
  claims: ExportClaim[];
  contradictions: ExportContradiction[];
}): string {
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];

  const addNode = (id: string, file: string, x: number, y: number, width = 320, height = 140) => {
    nodes.push({
      id,
      type: 'file',
      file,
      x,
      y,
      width,
      height,
    });
  };

  addNode('report', input.reportFile, 40, 180, 380, 180);

  input.report.topics.forEach((topic, index) => {
    const file = input.topicFiles.get(topic.name);
    if (!file) {
      return;
    }

    const nodeId = `topic-${index + 1}`;
    addNode(nodeId, file, 520, index * 180, 300, 120);
    edges.push({
      id: `edge-report-${nodeId}`,
      fromNode: 'report',
      toNode: nodeId,
      label: 'covers',
    });
  });

  input.report.sources.forEach((source, index) => {
    const file = input.sourceFiles.get(source.video_id);
    if (!file) {
      return;
    }

    const nodeId = `source-${index + 1}`;
    addNode(nodeId, file, 920, index * 200, 320, 140);
    edges.push({
      id: `edge-topic-source-${nodeId}`,
      fromNode: `topic-${Math.max(index, 0) + 1}`,
      toNode: nodeId,
      label: 'supported by',
    });
  });

  input.people.forEach((person, index) => {
    const file = input.personFiles.get(person.id);
    if (!file) {
      return;
    }

    const nodeId = `person-${index + 1}`;
    addNode(nodeId, file, 920, 780 + index * 150, 300, 120);
  });

  input.claims.slice(0, 10).forEach((claim, index) => {
    const file = input.claimFiles.get(claim.id);
    if (!file) {
      return;
    }

    const nodeId = `claim-${index + 1}`;
    addNode(nodeId, file, 1320, index * 150, 320, 120);
  });

  input.contradictions.slice(0, 10).forEach((contradiction, index) => {
    const file = input.contradictionFiles.get(contradiction.id);
    if (!file) {
      return;
    }

    const nodeId = `contradiction-${index + 1}`;
    addNode(nodeId, file, 1320, 900 + index * 150, 320, 120);
  });

  return JSON.stringify({ nodes, edges }, null, 2);
}

export function buildObsidianVaultExport(input: {
  report: Report;
  researchPack: ResearchPack;
  artifacts: ArtifactRecord[];
}): ObsidianVaultExportPayload {
  const generatedAt = new Date().toISOString();
  const uniqueTitle = makeTitleRegistry();
  const reportTitle = uniqueTitle(input.report.title);
  const reportFile = `Reports/${reportTitle}.md`;

  const people = buildPeople(input.report);
  const claims = buildClaims(input.report.topic_research);
  const contradictions = buildContradictions(input.report.topic_research);

  const topicFiles = new Map<string, string>();
  const sourceFiles = new Map<string, string>();
  const personFiles = new Map<string, string>();
  const claimFiles = new Map<string, string>();
  const contradictionFiles = new Map<string, string>();

  for (const topic of input.report.topics) {
    topicFiles.set(topic.name, `Topics/${uniqueTitle(topic.name)}.md`);
  }

  for (const source of input.report.sources) {
    sourceFiles.set(source.video_id, `Sources/${uniqueTitle(source.title)}.md`);
  }

  for (const person of people) {
    personFiles.set(person.id, `People/${uniqueTitle(person.name)}.md`);
  }

  for (const claim of claims) {
    claimFiles.set(claim.id, `Claims/${uniqueTitle(claim.text.slice(0, 60))}.md`);
  }

  for (const contradiction of contradictions) {
    contradictionFiles.set(
      contradiction.id,
      `Contradictions/${uniqueTitle(contradiction.text.slice(0, 60))}.md`,
    );
  }

  const entries: ZipEntry[] = [];

  entries.push({
    path: '00 Index.md',
    content: [
      renderFrontmatter({
        type: 'vault_index',
        report_id: input.report.id,
        research_pack_id: input.researchPack.id,
        generated_at: generatedAt,
      }),
      `# ${input.report.title}`,
      '',
      `Primary source: ${input.report.primary_video.title}`,
      '',
      '## Report',
      `- ${wikiLink(reportFile.replace(/\.md$/, ''))}`,
      '',
      '## Topics',
      ...input.report.topics.map((topic) => `- ${wikiLink(topicFiles.get(topic.name)!.replace(/\.md$/, ''))}`),
      '',
      '## Sources',
      ...input.report.sources.map((source) => `- ${wikiLink(sourceFiles.get(source.video_id)!.replace(/\.md$/, ''))}`),
      '',
      '## People',
      ...people.map((person) => `- ${wikiLink(personFiles.get(person.id)!.replace(/\.md$/, ''))}`),
      '',
      '## Claims',
      ...claims.map((claim) => `- ${wikiLink(claimFiles.get(claim.id)!.replace(/\.md$/, ''))}`),
      '',
      '## Contradictions',
      ...(contradictions.length > 0
        ? contradictions.map(
            (contradiction) =>
              `- ${wikiLink(contradictionFiles.get(contradiction.id)!.replace(/\.md$/, ''))}`,
          )
        : ['- None captured in the structured source analysis.']),
      '',
      '## Artifacts',
      '- [[Artifacts/research-pack.json]]',
      '- [[Canvas/research-map.canvas]]',
    ].join('\n'),
  });

  entries.push({
    path: reportFile,
    content: [
      renderFrontmatter({
        type: 'report',
        report_id: input.report.id,
        research_pack_id: input.researchPack.id,
        length: input.report.length_type,
        primary_video_url: input.report.primary_video.url,
        generated_at: generatedAt,
        topics: input.report.topics.map((topic) => topic.name),
      }),
      `# ${input.report.title}`,
      '',
      `Source video: [${input.report.primary_video.title}](${input.report.primary_video.url})`,
      '',
      '## Related topics',
      ...input.report.topics.map((topic) => `- ${wikiLink(topicFiles.get(topic.name)!.replace(/\.md$/, ''))}`),
      '',
      '## Supporting sources',
      ...input.report.sources.map((source) => `- ${wikiLink(sourceFiles.get(source.video_id)!.replace(/\.md$/, ''))}`),
      '',
      '## Narrative report',
      '',
      input.report.report_text,
      '',
      '## Backlinks',
      '- [[00 Index]]',
    ].join('\n'),
  });

  for (const topic of input.report.topics) {
    const research = input.report.topic_research.find((item) => item.topic.name === topic.name);
    const topicClaims = claims.filter((claim) => claim.topic_name === topic.name);
    const topicContradictions = contradictions.filter(
      (contradiction) => contradiction.topic_name === topic.name,
    );

    entries.push({
      path: topicFiles.get(topic.name)!,
      content: [
        renderFrontmatter({
          type: 'topic',
          topic: topic.name,
          rank: topic.rank,
          summary: topic.summary,
          keywords: topic.keywords,
        }),
        `# ${topic.name}`,
        '',
        topic.summary,
        '',
        `Importance: ${topic.importance}`,
        '',
        '## Supporting source',
        research?.source
          ? `- ${wikiLink(sourceFiles.get(research.source.video_id)!.replace(/\.md$/, ''))}`
          : '- No supporting source was captured.',
        '',
        '## Claims',
        ...(topicClaims.length > 0
          ? topicClaims.map((claim) => `- ${wikiLink(claimFiles.get(claim.id)!.replace(/\.md$/, ''))}`)
          : ['- None']),
        '',
        '## Contradictions',
        ...(topicContradictions.length > 0
          ? topicContradictions.map((item) => `- ${wikiLink(contradictionFiles.get(item.id)!.replace(/\.md$/, ''))}`)
          : ['- None']),
        '',
        '## Backlinks',
        `- ${wikiLink(reportFile.replace(/\.md$/, ''))}`,
      ].join('\n'),
    });
  }

  for (const source of input.report.sources) {
    const sourceClaims = claims.filter((claim) => claim.source_video_id === source.video_id);
    const sourceContradictions = contradictions.filter(
      (contradiction) => contradiction.source_video_id === source.video_id,
    );
    const sourcePerson = people.find((person) => person.videos.some((video) => video.video_id === source.video_id));

    entries.push({
      path: sourceFiles.get(source.video_id)!,
      content: [
        renderFrontmatter({
          type: 'source',
          source_video_id: source.video_id,
          topic: source.topic_name,
          source_url: source.url,
          channel: source.channel,
        }),
        `# ${source.title}`,
        '',
        `Channel: ${source.channel}`,
        '',
        `Topic: ${source.topic_name ? wikiLink(topicFiles.get(source.topic_name)!.replace(/\.md$/, '')) : 'Unknown'}`,
        '',
        `Source URL: [Watch video](${source.url})`,
        '',
        '## Research notes',
        source.research_notes || source.selection_reason || 'No additional notes captured.',
        '',
        '## Transcript excerpt',
        source.transcript_excerpt || 'No excerpt available.',
        '',
        '## Key takeaways',
        ...(source.takeaways?.length
          ? source.takeaways.map((item) => {
              const timestampUrl = withTimestamp(source.url, item.timestamp_sec);
              return `- ${item.text}${timestampUrl ? ` ([${formatTimestamp(item.timestamp_sec!)}](${timestampUrl}))` : ''}`;
            })
          : ['- None']),
        '',
        '## Nuances',
        ...(source.nuances?.length
          ? source.nuances.map((item) => {
              const timestampUrl = withTimestamp(source.url, item.timestamp_sec);
              return `- ${item.text}${timestampUrl ? ` ([${formatTimestamp(item.timestamp_sec!)}](${timestampUrl}))` : ''}`;
            })
          : ['- None']),
        '',
        '## Tensions',
        ...(source.tensions?.length
          ? source.tensions.map((item) => {
              const timestampUrl = withTimestamp(source.url, item.timestamp_sec);
              return `- ${item.text}${timestampUrl ? ` ([${formatTimestamp(item.timestamp_sec!)}](${timestampUrl}))` : ''}`;
            })
          : ['- None']),
        '',
        '## Related people',
        sourcePerson ? `- ${wikiLink(personFiles.get(sourcePerson.id)!.replace(/\.md$/, ''))}` : '- None',
        '',
        '## Claims',
        ...(sourceClaims.length > 0
          ? sourceClaims.map((claim) => `- ${wikiLink(claimFiles.get(claim.id)!.replace(/\.md$/, ''))}`)
          : ['- None']),
        '',
        '## Contradictions',
        ...(sourceContradictions.length > 0
          ? sourceContradictions.map(
              (contradiction) => `- ${wikiLink(contradictionFiles.get(contradiction.id)!.replace(/\.md$/, ''))}`,
            )
          : ['- None']),
        '',
        '## Backlinks',
        `- ${wikiLink(reportFile.replace(/\.md$/, ''))}`,
      ].join('\n'),
    });
  }

  for (const person of people) {
    entries.push({
      path: personFiles.get(person.id)!,
      content: [
        renderFrontmatter({
          type: 'person',
          person_id: person.id,
          name: person.name,
          topics: person.topics,
        }),
        `# ${person.name}`,
        '',
        '## Related sources',
        ...(person.videos.length > 0
          ? person.videos.map((video) => `- ${wikiLink(sourceFiles.get(video.video_id)!.replace(/\.md$/, ''))}`)
          : ['- None']),
        '',
        '## Related topics',
        ...(person.topics.length > 0
          ? person.topics
              .filter((topic) => topicFiles.has(topic))
              .map((topic) => `- ${wikiLink(topicFiles.get(topic)!.replace(/\.md$/, ''))}`)
          : ['- None']),
        '',
        '## Backlinks',
        `- ${wikiLink('00 Index')}`,
      ].join('\n'),
    });
  }

  for (const claim of claims) {
    const claimTimestamp = withTimestamp(claim.source_url, claim.timestamp_sec);
    entries.push({
      path: claimFiles.get(claim.id)!,
      content: [
        renderFrontmatter({
          type: 'claim',
          claim_id: claim.id,
          topic: claim.topic_name,
          source_video_id: claim.source_video_id,
        }),
        `# ${claim.text}`,
        '',
        `Topic: ${wikiLink(topicFiles.get(claim.topic_name)!.replace(/\.md$/, ''))}`,
        '',
        claim.source_video_id
          ? `Source: ${wikiLink(sourceFiles.get(claim.source_video_id)!.replace(/\.md$/, ''))}`
          : 'Source: None',
        claimTimestamp ? `Timestamp: [${formatTimestamp(claim.timestamp_sec!)}](${claimTimestamp})` : 'Timestamp: None',
        '',
        '## Backlinks',
        `- ${wikiLink(reportFile.replace(/\.md$/, ''))}`,
      ].join('\n'),
    });
  }

  for (const contradiction of contradictions) {
    const contradictionTimestamp = withTimestamp(contradiction.source_url, contradiction.timestamp_sec);
    entries.push({
      path: contradictionFiles.get(contradiction.id)!,
      content: [
        renderFrontmatter({
          type: 'contradiction',
          contradiction_id: contradiction.id,
          topic: contradiction.topic_name,
          source_video_id: contradiction.source_video_id,
        }),
        `# ${contradiction.text}`,
        '',
        `Topic: ${wikiLink(topicFiles.get(contradiction.topic_name)!.replace(/\.md$/, ''))}`,
        '',
        contradiction.source_video_id
          ? `Source: ${wikiLink(sourceFiles.get(contradiction.source_video_id)!.replace(/\.md$/, ''))}`
          : 'Source: None',
        contradictionTimestamp
          ? `Timestamp: [${formatTimestamp(contradiction.timestamp_sec!)}](${contradictionTimestamp})`
          : 'Timestamp: None',
        '',
        '## Backlinks',
        `- ${wikiLink(reportFile.replace(/\.md$/, ''))}`,
      ].join('\n'),
    });
  }

  entries.push({
    path: 'Artifacts/research-pack.json',
    content: JSON.stringify(
      {
        report: {
          id: input.report.id,
          title: input.report.title,
          length_type: input.report.length_type,
          created_at: input.report.created_at,
          updated_at: input.report.updated_at,
        },
        research_pack: input.researchPack,
        artifact_manifest: input.artifacts.map((artifact) => ({
          id: artifact.id,
          kind: artifact.kind,
          cache_key: artifact.cache_key,
          metadata: artifact.metadata,
          provenance: artifact.provenance,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
        })),
        topics: input.report.topics,
        topic_research: input.report.topic_research,
      },
      null,
      2,
    ),
  });

  entries.push({
    path: 'Canvas/research-map.canvas',
    content: buildCanvasFile({
      reportFile,
      topicFiles,
      sourceFiles,
      personFiles,
      claimFiles,
      contradictionFiles,
      report: input.report,
      people,
      claims,
      contradictions,
    }),
  });

  const zipFileName = `${sanitizeFileName(input.report.title)} - Obsidian Vault.zip`;
  const archive = buildZipArchive(entries);

  return {
    format: 'obsidian_vault',
    file_name: zipFileName,
    mime_type: 'application/zip',
    generated_at: generatedAt,
    entry_manifest: entries.map((entry) => ({
      path: entry.path,
      byte_size: Buffer.byteLength(entry.content, 'utf8'),
    })),
    zip_base64: archive.toString('base64'),
  };
}
