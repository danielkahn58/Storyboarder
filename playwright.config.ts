import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests share a server; run sequentially to avoid project ID collisions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node server.js',
    port: 3001,
    reuseExistingServer: false,
    env: {
      PORT: '3001',
      NODE_ENV: 'test',
      // Disable Google OAuth so auth middleware is skipped entirely
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      ALLOWED_EMAILS: '',
      ANTHROPIC_API_KEY: 'test-key',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_KEY: '',
      FAL_KEY: '',
      OPENAI_API_KEY: '',
      SESSION_SECRET: 'playwright-test-secret',
    },
  },
});
