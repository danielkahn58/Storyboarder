// Used when running e2e tests from inside the server (via /api/run-e2e-tests).
// No webServer block — assumes the server is already running.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: [
    ['json', { outputFile: '/tmp/pw-e2e-results.json' }],
    ['line'],
  ],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    trace: 'off',
    headless: true,
    extraHTTPHeaders: process.env.E2E_SECRET
      ? { 'x-e2e-auth': process.env.E2E_SECRET }
      : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
