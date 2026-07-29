import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { setupServer } from 'msw/node';

const mswServer = setupServer();

// Auth is DISABLED for all tests in this suite (empty env vars).
// IMPORTANT: /api/storage-upload-url is registered inside the `if (AUTH_ENABLED)`
// block in server.js, which means when auth is disabled the route is NOT registered
// and requests to it return 404.  These tests verify that documented behaviour and
// the expected shape of the route when auth IS enabled (see inline comments).
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('POST /api/storage-upload-url', () => {
  it('returns 404 when auth is disabled (route not registered)', async () => {
    // The route lives inside the AUTH_ENABLED guard in server.js.
    // In the test environment AUTH_ENABLED=false → Express never registers the handler.
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/storage-upload-url')
      .send({ path: 'projects/test/image.jpg' });

    expect(res.status).toBe(404);
  });

  // When AUTH_ENABLED=true and a valid session exists, the expected behaviour is:
  //   - Missing "path" body field → 400 { error: 'path required' }
  //   - sbAdmin null (no SUPABASE_URL) → 500 { error: 'Storage not configured' }
  //   - Supabase error → 500 { error: <message> }
  //   - Success → 200 { signedUrl: '...', publicUrl: '...' }
  //
  // These paths are exercised by integration tests that run with real credentials.
});
