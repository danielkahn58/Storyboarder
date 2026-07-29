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

const MOCK_PROMPTS = {
  imagePrompt: 'Place the character in the alley, medium shot, eye level, dramatic side lighting.',
  videoPrompt: 'Character walks forward slowly, camera tracks with them at waist height.',
};

describe('POST /api/generate-shot-prompts', () => {
  it('returns imagePrompt and videoPrompt from Claude', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(MOCK_PROMPTS) }],
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-prompts')
      .send({
        lyric: 'Walking down a dark alley',
        description: 'Character moves through shadows',
        shotSize: 'Medium Shot',
        shotAngle: 'Eye Level',
        shotMovement: 'Tracking Shot',
      });

    expect(res.status).toBe(200);
    expect(res.body.imagePrompt).toBe(MOCK_PROMPTS.imagePrompt);
    expect(res.body.videoPrompt).toBe(MOCK_PROMPTS.videoPrompt);
  });

  it('returns 400 when both lyric and description are missing', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/generate-shot-prompts')
      .send({ shotSize: 'Close Up' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lyric or description/i);
  });

  it('accepts description alone (no lyric)', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(MOCK_PROMPTS) }],
          usage: { input_tokens: 50, output_tokens: 25 },
        })
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-prompts')
      .send({ description: 'Wide establishing shot of city skyline.' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('imagePrompt');
    expect(res.body).toHaveProperty('videoPrompt');
  });

  it('includes shot parameters in the Claude prompt', async () => {
    const { default: app } = await import('../../server.js');
    let capturedBody;
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async ({ request: req }) => {
        capturedBody = await req.json();
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(MOCK_PROMPTS) }],
          usage: { input_tokens: 50, output_tokens: 25 },
        });
      })
    );

    await request(app)
      .post('/api/generate-shot-prompts')
      .send({
        lyric: 'Test line',
        shotSize: 'Extreme Close Up',
        shotAngle: 'Low Angle',
        shotMovement: 'Dolly In',
      });

    // Find the text content block in the user message
    const userContent = capturedBody.messages[0].content;
    const textBlock = Array.isArray(userContent)
      ? userContent.find(b => b.type === 'text')?.text
      : userContent;
    expect(textBlock).toContain('Extreme Close Up');
    expect(textBlock).toContain('Low Angle');
    expect(textBlock).toContain('Dolly In');
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
      .post('/api/generate-shot-prompts')
      .send({ lyric: 'test line', description: 'test description' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('handles JSON wrapped in markdown fences', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.anthropic.com/v1/messages', async () =>
        HttpResponse.json({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(MOCK_PROMPTS) + '\n```' }],
          usage: { input_tokens: 50, output_tokens: 25 },
        })
      )
    );

    const res = await request(app)
      .post('/api/generate-shot-prompts')
      .send({ lyric: 'test', description: 'test desc' });

    expect(res.status).toBe(200);
    expect(res.body.imagePrompt).toBe(MOCK_PROMPTS.imagePrompt);
  });
});
