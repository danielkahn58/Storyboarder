import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// The Anthropic SDK calls out over native fetch (undici), not Node's http module,
// so this intercepts at the network layer via msw rather than mocking the SDK —
// vi.mock doesn't reach into a CommonJS require() the way it reaches ESM imports,
// and nock doesn't intercept undici's fetch by default.
const mswServer = setupServer();

// Auth is only enabled when Google OAuth + allowlist env vars are all set. Set (not
// delete) so dotenv.config() inside server.js doesn't refill them from the real .env —
// dotenv only fills keys that are entirely absent from process.env.
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';

// 'bypass' (not 'error'): Supertest's own request to the local ephemeral server must
// pass through untouched — only the explicitly-handled Anthropic call gets intercepted.
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('POST /api/generate-prompt', () => {
  it('returns the prompt text produced by Claude for a character', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: 'A weathered detective in a rain-soaked trench coat.' }],
          usage: { input_tokens: 10, output_tokens: 12 },
        });
      })
    );

    const res = await request(app)
      .post('/api/generate-prompt')
      .send({ referenceDescription: 'A detective', isLocation: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ prompt: 'A weathered detective in a rain-soaked trench coat.' });
    expect(capturedBody.messages[0].content[0].text).toContain('Reference: A detective');
  });

  it('rejects requests with neither a reference description nor a reference image', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/generate-prompt').send({});

    expect(res.status).toBe(400);
  });

  it('returns 500 with the upstream error message when Claude fails', async () => {
    const { default: app } = await import('../../server.js');
    // 400 (not 429/5xx) so the SDK's built-in retry-with-backoff doesn't kick in and
    // slow the test down — this is about the failure passing through, not the retry policy.
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json(
          { type: 'error', error: { type: 'invalid_request_error', message: 'bad request shape' } },
          { status: 400 }
        )
      )
    );

    const res = await request(app)
      .post('/api/generate-prompt')
      .send({ referenceDescription: 'A detective' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('bad request shape');
  });
});
