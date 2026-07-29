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

describe('POST /api/parse-locations', () => {
  it('returns parsed locations array from Claude', async () => {
    const { default: app } = await import('../../server.js');
    const mockLocs = {
      locations: [
        { name: 'INT. Coffee Shop', description: 'Warm lighting, wood tables, espresso machines humming.' },
        { name: 'EXT. Park', description: 'Open green space, afternoon sun, trees in the background.' },
      ]
    };
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(mockLocs) }],
          usage: { input_tokens: 80, output_tokens: 40 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-locations')
      .send({ scriptText: 'Scene opens at a coffee shop. Later, a park.' });

    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(2);
    expect(res.body.locations[0].name).toBe('INT. Coffee Shop');
    expect(res.body.locations[1].name).toBe('EXT. Park');
  });

  it('returns 400 when scriptText is missing', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/parse-locations').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scriptText/i);
  });

  it('includes scriptText in the Claude prompt', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ locations: [] }) }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      })
    );

    await request(app)
      .post('/api/parse-locations')
      .send({ scriptText: 'UNIQUE_LOCATION_MARKER_ABC' });

    const content = capturedBody.messages[0].content;
    const text = typeof content === 'string' ? content : content[0]?.text;
    expect(text).toContain('UNIQUE_LOCATION_MARKER_ABC');
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
      .post('/api/parse-locations')
      .send({ scriptText: 'Some script text.' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('handles locations wrapped in markdown fences', async () => {
    const { default: app } = await import('../../server.js');
    const mockData = { locations: [{ name: 'EXT. Rooftop', description: 'City skyline at dusk.' }] };
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockData) + '\n```' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      )
    );

    const res = await request(app)
      .post('/api/parse-locations')
      .send({ scriptText: 'Rooftop scene at dusk.' });

    expect(res.status).toBe(200);
    expect(res.body.locations[0].name).toBe('EXT. Rooftop');
  });
});
