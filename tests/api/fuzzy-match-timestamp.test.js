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

describe('POST /api/fuzzy-match-timestamp', () => {
  it('returns the timestamp extracted from the Claude response', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: '1:23.4' }],
          usage: { input_tokens: 50, output_tokens: 5 },
        })
      )
    );

    const res = await request(app)
      .post('/api/fuzzy-match-timestamp')
      .send({
        lyric: 'Walking through the rain',
        transcript: '1:20 walking through 1:23 the rain 1:26 now',
        prevTimestamp: '1:20',
        nextTimestamp: '1:30',
      });

    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBe('1:23.4');
  });

  it('returns null timestamp when Claude responds with "none"', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: 'none' }],
          usage: { input_tokens: 50, output_tokens: 3 },
        })
      )
    );

    const res = await request(app)
      .post('/api/fuzzy-match-timestamp')
      .send({
        lyric: 'impossible lyric that does not exist',
        transcript: 'completely different words here',
        prevTimestamp: '0:00',
        nextTimestamp: '0:10',
      });

    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeNull();
  });

  it('returns null when lyric is missing (skips Claude call)', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/fuzzy-match-timestamp')
      .send({ transcript: 'some words here', prevTimestamp: '0:00', nextTimestamp: '0:10' });

    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeNull();
  });

  it('returns null when transcript is missing (skips Claude call)', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/fuzzy-match-timestamp')
      .send({ lyric: 'Walking through the rain' });

    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeNull();
  });

  it('returns null (not 500) when Claude fails', async () => {
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
      .post('/api/fuzzy-match-timestamp')
      .send({ lyric: 'some lyric', transcript: 'some words' });

    // Route catches errors and returns null gracefully — does not propagate 500
    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeNull();
  });

  it('passes lyric and transcript bounds to Claude', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: '2:05.0' }],
          usage: { input_tokens: 50, output_tokens: 5 },
        });
      })
    );

    await request(app)
      .post('/api/fuzzy-match-timestamp')
      .send({
        lyric: 'UNIQUE_LYRIC_999',
        transcript: 'UNIQUE_TRANSCRIPT_999',
        prevTimestamp: '2:00',
        nextTimestamp: '2:10',
      });

    const content = capturedBody.messages[0].content;
    const prompt = typeof content === 'string' ? content : content[0]?.text;
    expect(prompt).toContain('UNIQUE_LYRIC_999');
    expect(prompt).toContain('UNIQUE_TRANSCRIPT_999');
    expect(prompt).toContain('2:00');
    expect(prompt).toContain('2:10');
  });
});
