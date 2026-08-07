# Storyboard Generator — Project Rules

## What this app is
A web-based storyboard generator for music videos / narrative projects. Users build characters, locations, and shot sequences, then generate images and animatics using AI. Deployed on Railway.

## Stack
- **Server**: Node.js + Express (`server.js`) — single file, all API routes here
- **Frontend**: Vanilla JS (`public/app.js`) + plain HTML (`public/index.html`) — no build step, no framework
- **Auth**: Google OAuth 2.0 via Passport.js (session cookies). No Supabase auth — the anon key has no session.
- **Database**: Supabase (`projects` table for metadata, `project_snapshots` table for version history)
- **Storage**: Supabase Storage (`images` bucket) — data stored as `projects/{id}/data.json` and `projects/{id}/images.json`
- **AI services**: Anthropic Claude (text), fal.ai (image/video generation, LoRA training), OpenAI (Whisper transcription, DALL-E inpainting)

## Data persistence architecture
Three layers per project, per device:
1. **localStorage** — `sg-data-{id}`: full data JSON (fast, device-local)
2. **IndexedDB** — images dict, audio files, transcripts, beats (large blobs, device-local)
3. **Supabase Storage** — `data.json` + `images.json` via signed PUT URLs (cross-device source of truth)

**Read path**: always goes through `GET /api/project/:id/data` (server endpoint using service key) — never direct client Supabase SDK reads for project data, which would fail without a Supabase auth session.

**Write path**: client calls `/api/storage-upload-url` → server issues signed URL → client PUTs directly to Supabase Storage. Also upserts lightweight metadata into `projects` DB table.

**Freshness**: `savedAt` timestamp in every payload; on load, whichever of local vs Supabase is newer wins. If local is newer, it's immediately re-pushed to Supabase.

**Cloud-only mode**: toggle in Configuration tab (`sg-cloud-only` in localStorage). When on, skips all local reads/writes; failures throw errors instead of falling back silently.

## Version system
- Auto-versions created every N edits; named versions on user request via "+ Version" button
- Both saved to `project_snapshots` Supabase table (auto and named)
- Working copy is always what the user edits — there is no "viewing a version" state
- History modal (`openVersionHistory()`) loads version list live from Supabase via `sbGetSnapshots()`
- `restoreVersion(snapshotId, label)` auto-saves current state first, then applies snapshot as new working copy
- Cross-device: on load with no local versions, `sbGetSnapshots()` is called and version list is rebuilt as stubs
- `currentVersionLabel` was removed — no longer persisted, no more `_reloadVersionSnapshot` on page open

## Key conventions
- `syncFromDOM()` must be called before reading `characters`, `locations`, `shots` — the DOM is the source of truth for text fields while editing
- `autoSave()` fires on every edit (debounced); `saveData()` is the explicit save button
- `extractImages()` splits large blobs out of the main payload into a separate `imgs` dict before persisting
- `stripBase64ForSync()` removes base64 from anything going to Supabase (CDN URLs only)
- `apiFetch()` is the standard fetch wrapper for all server calls — handles auth errors and JSON parsing
- `debouncedSave()` for lightweight field changes; `autoSave()` when structural changes happen

## Frontend patterns
- All rendering is innerHTML-based; avoid addEventListener in generated HTML (use inline `onclick=` attributes to prevent duplicate listener accumulation on re-render)
- `renderShots()`, `renderCharacters()`, `renderLocations()` do full re-renders; preserve open detail rows by reading them before innerHTML and re-opening after
- Shot detail rows (`shot-detail-{id}`) are toggled with `display:none` — preserve open state across re-renders
- `_compose` global holds compositor state; `renderCompose()` redraws the canvas

## Image storage
- Generated images: uploaded to Supabase Storage, stored as CDN URLs
- Base64/dataURL only used transiently (during upload flow or for ref images before upload)
- Angle ref images uploaded immediately on drop/upload, not stored as base64 in payload
- Migration pass in `migrateImagesToSupabase()` handles legacy base64 still in data

## Shot sequence
- `shot.locationAngleKey`: which location variation is selected for a shot (angle name or `cv:{id}` for custom views)
- `locVariationImage(loc, angleKey)`: resolves the image URL for a given angle key
- Animatic snapshots store `shots: [{id, timestamp, lyric}]` at generation time so timeline handles stay accurate even after timestamps are edited

## With every code commit / push

- Update `public/spec.md` to reflect any product-facing changes (new features, changed behavior, removed flows)
- Update `TESTING.md` to add or update test cases for any new or changed functionality
- Update `_UNIT_TEST_META` in `app.js` and `_renderUiTestCases()` if new tests are added

## Things NOT to do
- Do not use `sb.storage.from('images').download(...)` from the client — the anon key has no bucket access without a Supabase session. Always proxy through the server.
- Do not `addEventListener` in HTML strings that get re-rendered — use inline `onclick=` instead
- Do not skip `syncFromDOM()` before building a payload to save
- Do not store base64 in Supabase — upload to storage and store the CDN URL
- Do not use `!isAuto` guard on `sbSaveSnapshot` — all versions (auto and named) are saved to Supabase
