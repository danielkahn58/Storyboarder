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

describe('POST /api/parse-characters', () => {
  it('returns parsed characters array from Claude', async () => {
    const { default: app } = await import('../../server.js');
    const mockChars = {
      characters: [
        { name: 'Hero', isPlural: false, pluralCount: 1, attributes: [{ text: 'Tall', sometimes: false, reasoning: 'Mentioned repeatedly.' }] },
        { name: 'Backup Dancers', isPlural: true, pluralCount: 3, attributes: [] },
      ]
    };
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(mockChars) }],
          usage: { input_tokens: 80, output_tokens: 40 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-characters')
      .send({ scriptText: 'Hero dances with Backup Dancers.' });

    expect(res.status).toBe(200);
    expect(res.body.characters).toHaveLength(2);
    expect(res.body.characters[0].name).toBe('Hero');
    expect(res.body.characters[1].isPlural).toBe(true);
  });

  it('returns 400 when scriptText is missing', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/parse-characters').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scriptText/i);
  });

  it('returns 400 when body is empty', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/parse-characters').send('');

    expect(res.status).toBe(400);
  });

  it('includes scriptText in the prompt sent to Claude', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ characters: [] }) }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      })
    );

    await request(app)
      .post('/api/parse-characters')
      .send({ scriptText: 'UNIQUE_SCRIPT_MARKER_XYZ' });

    const content = capturedBody.messages[0].content;
    const text = typeof content === 'string' ? content : content[0]?.text;
    expect(text).toContain('UNIQUE_SCRIPT_MARKER_XYZ');
  });

  it('returns 500 when Claude fails', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json(
          { type: 'error', error: { type: 'invalid_request_error', message: 'upstream error' } },
          { status: 400 }
        )
      )
    );

    const res = await request(app)
      .post('/api/parse-characters')
      .send({ scriptText: 'Some lyrics here.' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('handles a Claude response wrapped in markdown fences', async () => {
    const { default: app } = await import('../../server.js');
    const mockData = { characters: [{ name: 'Bob', isPlural: false, pluralCount: 1, attributes: [] }] };
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockData) + '\n```' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-characters')
      .send({ scriptText: 'Bob walks into the room.' });

    expect(res.status).toBe(200);
    expect(res.body.characters[0].name).toBe('Bob');
  });
});
