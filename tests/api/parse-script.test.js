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

const CLAUDE_RESPONSE = {
  characters: [
    { name: 'Alice', isPlural: false, pluralCount: 1, attributes: [{ text: 'Dark hair', sometimes: false, reasoning: 'Described in scene 1.' }] }
  ],
  locations: [
    { name: 'INT. Coffee Shop', description: 'Cozy café with warm lighting.' }
  ],
};

describe('POST /api/parse-script', () => {
  it('returns parsed characters and locations for a plain-text upload', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(CLAUDE_RESPONSE) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-script')
      .attach('file', Buffer.from('Alice walks into a coffee shop.'), { filename: 'script.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.characters).toHaveLength(1);
    expect(res.body.characters[0].name).toBe('Alice');
    expect(res.body.locations).toHaveLength(1);
    expect(res.body.locations[0].name).toBe('INT. Coffee Shop');
    // scriptText should be included in response
    expect(typeof res.body.scriptText).toBe('string');
    expect(res.body.scriptText).toContain('Alice');
  });

  it('returns 400 when no file is attached', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/parse-script').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('sends the extracted script text to Claude in the request body', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(CLAUDE_RESPONSE) }],
          usage: { input_tokens: 50, output_tokens: 30 },
        });
      })
    );

    await request(app)
      .post('/api/parse-script')
      .attach('file', Buffer.from('Bob runs through the park at night.'), { filename: 'script.txt', contentType: 'text/plain' });

    // server.js passes a plain string as content for this route
    const content = capturedBody.messages[0].content;
    const text = typeof content === 'string' ? content : content[0]?.text;
    expect(text).toContain('Bob runs through the park');
  });

  it('returns 500 when Claude returns an error', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', () =>
        HttpResponse.json(
          { type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } },
          { status: 400 }
        )
      )
    );

    const res = await request(app)
      .post('/api/parse-script')
      .attach('file', Buffer.from('Some script text.'), { filename: 'script.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('handles a Claude response wrapped in markdown code fences', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(CLAUDE_RESPONSE) + '\n```' }],
          usage: { input_tokens: 50, output_tokens: 30 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-script')
      .attach('file', Buffer.from('Script text.'), { filename: 'script.txt', contentType: 'text/plain' });

    expect(res.status).toBe(200);
    expect(res.body.characters).toHaveLength(1);
  });
});
