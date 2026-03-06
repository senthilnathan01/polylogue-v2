# Polylogue Research Studio

Polylogue turns one YouTube video into a transcript-grounded research report.

The current app flow is:

1. Fetch the transcript for the input YouTube URL.
2. Extract 5-6 major topics from the main video.
3. Find one transcript-backed supporting YouTube video for each topic.
4. Analyze those transcripts against the main transcript.
5. Generate a long markdown report that keeps the first video primary while using the others to deepen, challenge, and expand the ideas.
6. Save the result locally and expose a print-friendly report page so it can be exported as PDF.

## Requirements

- Node.js 20+
- `GEMINI_API_KEY`
- `SUPADATA_API_KEY`
- `YOUTUBE_DATA_API_KEY`

Supabase is optional. The prototype now works with a local JSON report store in `.data/report-store.json`.

Transcript retrieval uses Supadata only. There are no local scraping or model-based transcript fallbacks.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` from `.env.example` and fill in the required keys.
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Verification

After installing dependencies, run:

```bash
npm run typecheck
npm run lint
npm run build
```

## Notes

- Cached reports are reused for a configurable window via `REPORT_CACHE_HOURS`.
- Daily generation limits are controlled by `DAILY_REPORT_LIMIT`.
- PDF export is handled through the browser print flow on the saved report page.
