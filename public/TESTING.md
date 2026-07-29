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
- Use **msw** (Mock Service Worker) to intercept outbound HTTP calls (Anthropic API, etc.) at the network layer — do NOT mock the SDK or require() modules directly
- Disable auth for tests by setting `GOOGLE_CLIENT_ID=''`, `GOOGLE_CLIENT_SECRET=''`, `ALLOWED_EMAILS=''` in `process.env` before importing `server.js`
- Set `ANTHROPIC_API_KEY='test-key'` so the SDK initialises without failing
- Use `onUnhandledRequest: 'bypass'` in msw so supertest's own loopback requests pass through
- Import `server.js` inside each test (not at the top level) so env vars are set first

### Unit tests (`tests/unit/`)
- Import from `public/lib/` — only functions extracted into ES modules can be unit tested
- Pure functions only: no DOM, no fetch, no global state
- If a function needs testing but lives in `app.js`, extract it to `public/lib/` first

### What's covered
| Area | File | Coverage |
|---|---|---|
| `stripBase64ForSync` | `tests/unit/versioning.test.js` | strips base64, keeps CDN URLs, handles image objects |
| `extractImages` / `mergeImages` | `tests/unit/versioning.test.js` | round-trip image splitting and merging |
| `stripImagesForVersion` | `tests/unit/versioning.test.js` | version snapshot stripping |
| `POST /api/generate-prompt` | `tests/api/generate-prompt.test.js` | happy path, missing input 400, Claude failure 500 |

### What's NOT covered (known gaps)
- Shot sequence rendering
- Version create/load logic (hard to test without DOM)
- Supabase storage read/write (requires live credentials)
- Image generation endpoints (fal.ai calls)
- Auth flow

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

## Test Output
`test-results.json` is written after every run and read by the server at `/api/test-results`. In-app: enable debug mode (Debug button in header) → click Tests.
