import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const mswServer = setupServer();

process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ALLOWED_EMAILS = '';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

// A minimal valid MP3 header (just enough bytes to pass multer's size check).
// The actual content doesn't matter since we intercept the OpenAI call.
const SMALL_AUDIO = Buffer.alloc(1024, 0);

describe('POST /api/transcribe-audio', () => {
  it('returns 400 when no file is attached', async () => {
    const { default: app } = await import('../../server.js');

    const res = await request(app).post('/api/transcribe-audio').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('returns transcribed text and word timestamps from OpenAI Whisper', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.openai.com/v1/audio/transcriptions', async () =>
        HttpResponse.json({
          text: 'Hello world',
          words: [
            { word: 'Hello', start: 0.0, end: 0.5 },
            { word: 'world', start: 0.6, end: 1.1 },
          ],
        })
      )
    );

    const res = await request(app)
      .post('/api/transcribe-audio')
      .attach('file', SMALL_AUDIO, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Hello world');
    expect(res.body.words).toHaveLength(2);
    expect(res.body.words[0]).toMatchObject({ word: 'Hello', start: 0.0, end: 0.5 });
  });

  it('returns 500 when OPENAI_API_KEY is not set', async () => {
    const origKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    const { default: app } = await import('../../server.js');

    const res = await request(app)
      .post('/api/transcribe-audio')
      .attach('file', SMALL_AUDIO, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

    process.env.OPENAI_API_KEY = origKey;

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/OPENAI_API_KEY/i);
  });

  it('returns 500 when the OpenAI API returns an error', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.openai.com/v1/audio/transcriptions', () =>
        HttpResponse.json(
          { error: { message: 'Invalid audio file format' } },
          { status: 400 }
        )
      )
    );

    const res = await request(app)
      .post('/api/transcribe-audio')
      .attach('file', SMALL_AUDIO, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('returns only word/start/end fields from the words array (strips extra Whisper fields)', async () => {
    const { default: app } = await import('../../server.js');
    mswServer.use(
      http.post('https://api.openai.com/v1/audio/transcriptions', async () =>
        HttpResponse.json({
          text: 'Test',
          words: [{ word: 'Test', start: 0.1, end: 0.4, probability: 0.99, speaker: 1 }],
        })
      )
    );

    const res = await request(app)
      .post('/api/transcribe-audio')
      .attach('file', SMALL_AUDIO, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.words[0])).toEqual(['word', 'start', 'end']);
  });
});
