import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { setupServer } from 'msw/node';

const mswServer = setupServer();

process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';
// Set empty strings BEFORE server.js is imported so dotenv.config() inside
// server.js does not pull real credentials from the project's .env file.
// Without SUPABASE_URL and SUPABASE_SERVICE_KEY, sbAdmin stays null.
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_KEY = '';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('GET /api/project/:id/data', () => {
  it('returns 503 when Supabase is not configured', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).get('/api/project/proj-abc/data');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/supabase not configured/i);
  });

  it('the route exists and is handled (not 404)', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).get('/api/project/any-id/data');

    // 503 means the route was found and handled — not unregistered
    expect(res.status).not.toBe(404);
  });
});
