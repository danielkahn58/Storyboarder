# Storyboard Generator — Testing Guide

## Running Tests

```
npm test
```

Uses **Vitest**. Results written to `test-results.json` and visible in-app via the Tests panel (debug mode).

## Test Structure

```
tests/
  api/          — integration tests against the Express server (supertest)
  unit/         — pure unit tests for frontend utility functions
public/lib/     — frontend utility modules that can be imported by tests (ESM)
```

## Test Conventions

### API tests (`tests/api/`)
- Use **supertest** to make HTTP requests against the real Express app
- Use **msw** (Mock Service Worker) to intercept outbound HTTP calls (Anthropic API, OpenAI, etc.) at the network layer — do NOT mock the SDK or require() modules directly
- Disable auth for tests by setting `GOOGLE_CLIENT_ID=''`, `GOOGLE_CLIENT_SECRET=''`, `ALLOWED_EMAILS=''` in `process.env` before importing `server.js`
- Set `ANTHROPIC_API_KEY='test-key'` so the SDK initialises without failing
- For routes that touch Supabase, also set `SUPABASE_URL=''` and `SUPABASE_SERVICE_KEY=''` before importing `server.js` — otherwise `dotenv.config()` inside `server.js` pulls real credentials from `.env` (dotenv only fills keys that are entirely absent from `process.env`)
- Use `onUnhandledRequest: 'bypass'` in msw so supertest's own loopback requests pass through
- Import `server.js` inside each test (not at the top level) so env vars are set first

### Unit tests (`tests/unit/`)
- Import from `public/lib/` — only functions extracted into ES modules can be unit tested
- Pure functions only: no DOM, no fetch, no global state
- If a function needs testing but lives in `app.js`, extract it to `public/lib/` first

### Content format note
Several routes pass a plain string as `content` to the Anthropic SDK (not an array of content blocks). When asserting on the captured request body, use:
```js
const content = capturedBody.messages[0].content;
const text = typeof content === 'string' ? content : content[0]?.text;
```

---

## What's Covered

| File | Test name | What it verifies | Why it's useful |
|---|---|---|---|
| `tests/unit/versioning.test.js` | stripBase64ForSync — nulls out bare data: URL strings | Strips base64 strings, keeps CDN URLs | Prevents base64 leaking to Supabase |
| `tests/unit/versioning.test.js` | stripBase64ForSync — prefers cdnUrl/url over existing base64 | Image objects use CDN URL when available | Correct data shape before sync |
| `tests/unit/versioning.test.js` | stripBase64ForSync — nulls dataUrl when no cdn/url available | No CDN → dataUrl becomes null | Prevents base64 storage in cloud |
| `tests/unit/versioning.test.js` | stripBase64ForSync — recurses into nested arrays and objects | Deep traversal hits gallery arrays | Catches base64 buried in nested structures |
| `tests/unit/versioning.test.js` | stripBase64ForSync — passes through null/undefined | Graceful no-op on empty inputs | Prevents crashes on uninitialized data |
| `tests/unit/versioning.test.js` | extractImages — strips image fields out of data, keeps in imgs | Characters/locations/shots stripped correctly | Image split before persisting to Supabase |
| `tests/unit/versioning.test.js` | mergeImages — reconstructs original from stripped + imgs | Round-trip fidelity | Data integrity on local merge |
| `tests/unit/versioning.test.js` | mergeImages — no-op passthrough when imgs is falsy | Null imgs → returns original unchanged | Safe when no image dict exists |
| `tests/unit/versioning.test.js` | mergeLocalIntoSbImages — fills missing cloud fields from local | Local ref images backfill cloud | Preserves local-only assets |
| `tests/unit/versioning.test.js` | mergeLocalIntoSbImages — prefers cloud value when both sides have data | Cloud CDN URL wins over local base64 | Cloud is source of truth |
| `tests/unit/versioning.test.js` | mergeLocalIntoSbImages — recurses into nested objects like angles | Angle-level merge works | Per-angle image sync correctness |
| `tests/unit/versioning.test.js` | mergeLocalIntoSbImages — returns other side when one is missing | Null-safe merge | No crash when one side absent |
| `tests/unit/versioning.test.js` | stripImagesForVersion — keeps permanent https URLs | CDN URLs survive versioning | Versions reference real images |
| `tests/unit/versioning.test.js` | stripImagesForVersion — strips blob: and base64 | Transient URLs removed from snapshots | Snapshots don't embed ephemeral data |
| `tests/unit/versioning.test.js` | stripImagesForVersion — drops fields not in versioned schema | images/expressionCache excluded | Keeps snapshot payload lean |
| `tests/unit/versioning.test.js` | stripImagesForVersion — filters compose layers with no permanent URL | Blob-URL layers dropped | Compose layers in snapshots are valid |
| `tests/unit/versioning.test.js` | stripImagesForVersion — keeps project-level fields as-is | visualStyles/animatics pass through | Non-image project data is versioned |
| `tests/api/generate-prompt.test.js` | Returns the prompt text produced by Claude for a character | Happy path: Claude text returned in `{ prompt }` | Core value of the generate-prompt route |
| `tests/api/generate-prompt.test.js` | Rejects requests with neither reference description nor image | Missing input → 400 | Input validation gate |
| `tests/api/generate-prompt.test.js` | Returns 500 with upstream error message when Claude fails | API error propagated correctly | Error surface visible to client |
| **NEW** `tests/api/parse-script.test.js` | Returns parsed characters and locations for plain-text upload | Happy path: characters + locations + scriptText in response | Primary script import flow |
| **NEW** `tests/api/parse-script.test.js` | Returns 400 when no file is attached | Missing file → 400 | Input validation gate |
| **NEW** `tests/api/parse-script.test.js` | Sends the extracted script text to Claude | File content forwarded to Claude | Correct data pipeline |
| **NEW** `tests/api/parse-script.test.js` | Returns 500 when Claude returns an error | API error → 500 | Error propagation |
| **NEW** `tests/api/parse-script.test.js` | Handles Claude response wrapped in markdown fences | `extractJSON` strips fences correctly | Defensive JSON parsing |
| **NEW** `tests/api/parse-characters.test.js` | Returns parsed characters array from Claude | Happy path: isPlural/pluralCount/attributes in response | Character extraction contract |
| **NEW** `tests/api/parse-characters.test.js` | Returns 400 when scriptText is missing | Missing body field → 400 + error message | Input validation |
| **NEW** `tests/api/parse-characters.test.js` | Returns 400 when body is empty | Empty body → 400 | Input validation |
| **NEW** `tests/api/parse-characters.test.js` | Includes scriptText in the prompt sent to Claude | Script content forwarded verbatim | Correct data pipeline |
| **NEW** `tests/api/parse-characters.test.js` | Returns 500 when Claude fails | API error → 500 | Error propagation |
| **NEW** `tests/api/parse-characters.test.js` | Handles Claude response wrapped in markdown fences | `extractJSON` strips fences | Defensive JSON parsing |
| **NEW** `tests/api/parse-locations.test.js` | Returns parsed locations array from Claude | Happy path: name/description in response | Location extraction contract |
| **NEW** `tests/api/parse-locations.test.js` | Returns 400 when scriptText is missing | Missing body field → 400 | Input validation |
| **NEW** `tests/api/parse-locations.test.js` | Includes scriptText in the Claude prompt | Script content forwarded verbatim | Correct data pipeline |
| **NEW** `tests/api/parse-locations.test.js` | Returns 500 when Claude fails | API error → 500 | Error propagation |
| **NEW** `tests/api/parse-locations.test.js` | Handles locations wrapped in markdown fences | `extractJSON` strips fences | Defensive JSON parsing |
| **NEW** `tests/api/generate-shot-sequence.test.js` | Returns a shots array from Claude | Happy path: lyric/description/characterIds/locationIds in each shot | Shot sequence generation contract |
| **NEW** `tests/api/generate-shot-sequence.test.js` | Returns 400 when scriptText is missing | Missing body field → 400 | Input validation |
| **NEW** `tests/api/generate-shot-sequence.test.js` | Includes character and location IDs in the Claude prompt | IDs and names forwarded so Claude can reference them | Correct ID-to-name prompt construction |
| **NEW** `tests/api/generate-shot-sequence.test.js` | Works with empty characters and locations arrays | No crash when lists are empty | Defensive handling of fresh projects |
| **NEW** `tests/api/generate-shot-sequence.test.js` | Returns 500 when Claude fails | API error → 500 | Error propagation |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Returns imagePrompt and videoPrompt from Claude | Happy path: both prompts in response | Shot prompt generation contract |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Returns 400 when both lyric and description are missing | Neither field → 400 | Input validation (either field is sufficient) |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Accepts description alone (no lyric) | description-only request succeeds | Route accepts either lyric or description |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Includes shot parameters in the Claude prompt | shotSize/shotAngle/shotMovement forwarded | Cinematography params reach Claude |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Returns 500 when Claude fails | API error → 500 | Error propagation |
| **NEW** `tests/api/generate-shot-prompts.test.js` | Handles JSON wrapped in markdown fences | `extractJSON` strips fences | Defensive JSON parsing |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Returns timestamp extracted from Claude response | Happy path: timestamp regex parsed from Claude text | Core timestamp-matching value |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Returns null timestamp when Claude responds with "none" | "none" response → `{ timestamp: null }` | No match is communicated cleanly |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Returns null when lyric is missing (skips Claude call) | Early-return without calling Claude | No unnecessary API calls |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Returns null when transcript is missing (skips Claude call) | Early-return without calling Claude | No unnecessary API calls |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Returns null (not 500) when Claude fails | Error is swallowed; null returned | Graceful degradation — caller handles null |
| **NEW** `tests/api/fuzzy-match-timestamp.test.js` | Passes lyric and transcript bounds to Claude | All four fields forwarded in prompt | Correct context sent to Claude |
| **NEW** `tests/api/transcribe-audio.test.js` | Returns 400 when no file is attached | Missing file → 400 | Input validation gate |
| **NEW** `tests/api/transcribe-audio.test.js` | Returns transcribed text and word timestamps from OpenAI Whisper | Happy path: text + words array in response | Core transcription contract |
| **NEW** `tests/api/transcribe-audio.test.js` | Returns 500 when OPENAI_API_KEY is not set | Missing key → 500 before making any call | Fail-fast on missing credentials |
| **NEW** `tests/api/transcribe-audio.test.js` | Returns 500 when the OpenAI API returns an error | Upstream error propagated | Error surface visible to client |
| **NEW** `tests/api/transcribe-audio.test.js` | Returns only word/start/end fields from words array | Extra Whisper fields (probability, speaker) stripped | API contract doesn't leak internal Whisper shape |
| **NEW** `tests/api/snapshots.test.js` | POST /api/snapshots — returns 503 when Supabase not configured | Route gate fires when sbAdmin is null | Guard prevents crashes on unconfigured deploys |
| **NEW** `tests/api/snapshots.test.js` | GET /api/snapshots/:projectId — returns 503 when Supabase not configured | Read path also guarded | Consistent 503 across all snapshot endpoints |
| **NEW** `tests/api/snapshots.test.js` | GET /api/snapshots/:projectId/:snapshotId — returns 503 | Single snapshot read also guarded | All three snapshot routes gated |
| **NEW** `tests/api/snapshots.test.js` | POST /api/snapshots without projectId — 503 (not 400) because sbAdmin checked first | sbAdmin guard fires before input validation | Documents route execution order |
| **NEW** `tests/api/project-data.test.js` | Returns 503 when Supabase is not configured | Storage proxy guarded correctly | Service key never needed on client |
| **NEW** `tests/api/project-data.test.js` | Route exists (does not 404) | Route is registered and reachable | Regression guard against route mis-wiring |
| **NEW** `tests/api/storage-upload-url.test.js` | Returns 404 when auth is disabled | Route is inside AUTH_ENABLED guard | Documents auth-gating of signed-URL endpoint |

---

## What's NOT Covered (Known Gaps)

| Area | Reason |
|---|---|
| `/api/storage-upload-url` happy path (400, 500, 200) | Route only registers when `AUTH_ENABLED=true`; testing authenticated sessions requires mocking Passport's `req.isAuthenticated()` which is out of scope for unit tests |
| Supabase DB happy paths (snapshot insert, select, project data read) | Would require intercepting Supabase's PostgREST HTTP calls with msw and fake credentials; covered by integration tests against a real Supabase instance |
| fal.ai image/video generation routes | External HTTP calls to `fal.run` are interceptable with msw but routes also need real image buffers to download; integration tests are more appropriate |
| LoRA training (`/api/train-character-lora`) | Multi-step flow involving zip creation, fal.storage upload, and training queue — too stateful for unit tests |
| Animatic generation (`/api/generate-animatic`) | Requires ffmpeg installed and real media files |
| Auth flow (`/auth/google`, `/auth/google/callback`) | OAuth round-trips require live Google credentials |
| Shot sequence rendering | DOM-based — no extractable pure function |
| Version History panel open/restore flow | Requires Supabase sbGetSnapshots/sbRestoreSnapshot; covered by manual e2e against real Supabase |

---

## Adding a New Test

**For a new API route:**
```js
// tests/api/my-route.test.js
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const mswServer = setupServer();
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';
// Also set these if the route touches Supabase:
// process.env.SUPABASE_URL = '';
// process.env.SUPABASE_SERVICE_KEY = '';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('POST /api/my-route', () => {
  it('does the thing', async () => {
    const { default: app } = await import('../../server.js');
    const res = await request(app).post('/api/my-route').send({ ... });
    expect(res.status).toBe(200);
  });
});
```

**For a new utility function:**
1. Extract the function into `public/lib/yourmodule.js` as a named ESM export
2. Import and test in `tests/unit/yourmodule.test.js`
3. Import the same module in `public/app.js` where needed

---

## Test Output
`test-results.json` is written after every run and read by the server at `/api/test-results`. In-app: enable debug mode (Debug button in header) → click Tests.
