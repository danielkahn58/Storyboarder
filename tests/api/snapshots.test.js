import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { setupServer } from 'msw/node';

const mswServer = setupServer();

// Disable auth so middleware doesn't protect API routes.
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';
// Set empty strings BEFORE server.js is imported so dotenv.config() (which only
// fills absent keys) doesn't pull in real credentials from the project's .env file.
// When both are empty strings, createClient() is not called and sbAdmin stays null.
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_KEY = '';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('POST /api/snapshots — Supabase not configured', () => {
  it('returns 503 when Supabase is not configured', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/snapshots')
      .send({ projectId: 'proj-1', label: 'v1', data: { chars: [] } });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/supabase not configured/i);
  });
});

describe('GET /api/snapshots/:projectId — Supabase not configured', () => {
  it('returns 503 when Supabase is not configured', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).get('/api/snapshots/proj-1');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/supabase not configured/i);
  });
});

describe('GET /api/snapshots/:projectId/:snapshotId — Supabase not configured', () => {
  it('returns 503 when Supabase is not configured', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).get('/api/snapshots/proj-1/snap-42');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/supabase not configured/i);
  });
});

describe('POST /api/snapshots — input validation', () => {
  it('returns 503 when projectId is missing and Supabase is not configured', async () => {
    // With sbAdmin null, the !sbAdmin check fires before the !projectId check.
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/snapshots')
      .send({});

    expect(res.status).toBe(503);
  });
});
