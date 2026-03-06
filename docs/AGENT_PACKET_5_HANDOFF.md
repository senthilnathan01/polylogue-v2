# Agent Packet 5 Handoff

## Export schema

Obsidian export generation now lives in [`packages/obsidian-export/index.ts`](/Users/tsn/Documents/all_things_python/polylogue-v2/packages/obsidian-export/index.ts).

The persisted export artifact payload shape is:

- `format`
  Always `obsidian_vault`.
- `file_name`
  Downloaded zip filename.
- `mime_type`
  Always `application/zip`.
- `generated_at`
  ISO timestamp for bundle generation.
- `entry_manifest`
  Flat list of vault file paths with byte sizes.
- `zip_base64`
  Base64-encoded zip archive generated in-process by [`packages/obsidian-export/zip.ts`](/Users/tsn/Documents/all_things_python/polylogue-v2/packages/obsidian-export/zip.ts).

`POST /api/reports/:id/exports` creates an `exports` row plus an `export_bundle` artifact and returns the download URL.

`GET /api/exports/:id` streams the stored zip payload back as an attachment.

## Folder structure

Generated vault layout:

```text
00 Index.md
Reports/<report-title>.md
Topics/<topic>.md
Sources/<source-video>.md
People/<channel>.md
Claims/<claim>.md
Contradictions/<contradiction>.md
Artifacts/research-pack.json
Canvas/research-map.canvas
```

The `research-pack.json` file contains the saved `ResearchPack`, artifact manifest metadata/provenance, report metadata, and structured topic research. It does not reparse the final markdown report.

## Markdown template inventory

- `00 Index.md`
  Vault entry point linking report, topics, sources, people, claims, contradictions, artifacts, and canvas.
- `Reports/<report-title>.md`
  YAML frontmatter plus the saved narrative report, related topics, supporting sources, and backlinks.
- `Topics/<topic>.md`
  Summary, importance, supporting source link, claim links, contradiction links, and backlinks.
- `Sources/<source-video>.md`
  Source URL, topic link, research notes, transcript excerpt, takeaways with timestamps, nuances, tensions, related person, and backlinks.
- `People/<channel>.md`
  Derived from primary/supporting channel names with related source/topic links.
- `Claims/<claim>.md`
  Derived from structured `support_takeaways`.
- `Contradictions/<contradiction>.md`
  Derived from structured `tensions`.

Every markdown file includes YAML frontmatter and wiki links.

## Canvas node/edge strategy

The canvas file uses Obsidian `file` nodes pointing directly at generated markdown files.

Node groups:

- one central report node
- topic nodes
- source nodes
- person nodes
- claim nodes
- contradiction nodes

Current edge labels:

- `covers`
  Report -> topic
- `supported by`
  Topic -> source

The current canvas intentionally favors a readable default layout over exhaustive edge density. Additional edge types, richer node placement, or separate claim/source/person links can be added without changing the vault note paths.

## Product surfaces

Saved report UI now exposes:

- final report page
- source traceability section
- research-pack inspection section
- export panel with Obsidian vault download plus print/PDF

Implemented in [`app/report/[id]/page.tsx`](/Users/tsn/Documents/all_things_python/polylogue-v2/app/report/[id]/page.tsx) and [`components/ObsidianExportPanel.tsx`](/Users/tsn/Documents/all_things_python/polylogue-v2/components/ObsidianExportPanel.tsx).
