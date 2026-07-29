import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const mswServer = setupServer();

process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const MOCK_SHOTS = {
  shots: [
    { lyric: 'Walking down the street', description: 'Character walks in slow motion', characterIds: ['c1'], locationIds: ['l1'] },
    { lyric: 'Under the stars', description: 'Wide shot of the park at night', characterIds: [], locationIds: ['l2'] },
  ]
};

describe('POST /api/generate-shot-sequence', () => {
  it('returns a shots array from Claude', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(MOCK_SHOTS) }],
          usage: { input_tokens: 120, output_tokens: 60 },
        })
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-sequence')
      .send({
        scriptText: 'Walking down the street. Under the stars.',
        characters: [{ id: 'c1', name: 'Hero' }],
        locations: [{ id: 'l1', name: 'INT. Street' }, { id: 'l2', name: 'EXT. Park' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.shots).toHaveLength(2);
    expect(res.body.shots[0].lyric).toBe('Walking down the street');
    expect(res.body.shots[0].characterIds).toContain('c1');
  });

  it('returns 400 when scriptText is missing', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/generate-shot-sequence')
      .send({ characters: [], locations: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scriptText/i);
  });

  it('includes character and location IDs in the Claude prompt', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ shots: [] }) }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      })
    );

    await request(app)
      .post('/api/generate-shot-sequence')
      .send({
        scriptText: 'Test script.',
        characters: [{ id: 'char-abc', name: 'Alice' }],
        locations: [{ id: 'loc-xyz', name: 'EXT. Beach' }],
      });

    const content = capturedBody.messages[0].content;
    const prompt = typeof content === 'string' ? content : content[0]?.text;
    expect(prompt).toContain('char-abc');
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('loc-xyz');
    expect(prompt).toContain('EXT. Beach');
  });

  it('works with empty characters and locations arrays', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ shots: [{ lyric: 'line', description: 'desc', characterIds: [], locationIds: [] }] }) }],
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-sequence')
      .send({ scriptText: 'Just a line.', characters: [], locations: [] });

    expect(res.status).toBe(200);
    expect(res.body.shots).toHaveLength(1);
  });

  it('returns 500 when Claude fails', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json(
          { type: 'error', error: { type: 'invalid_request_error', message: 'api error' } },
          { status: 400 }
        )
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-sequence')
      .send({ scriptText: 'Script text.' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });
});
