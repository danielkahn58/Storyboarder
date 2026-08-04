// Used when running e2e tests from inside the server (via /api/run-e2e-tests).
// No webServer block — assumes the server is already running.
import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read E2E_SECRET from .env directly — process.env may not be populated when
// running via Playwright UI (source .env doesn't export vars to child processes).
function readE2ESecret(): string {
  try {
    const env = readFileSync(join(__dirname, '.env'), 'utf8');
    const match = env.match(/^E2E_SECRET=["']?([^"'\n]+)["']?/m);
    return match?.[1] ?? process.env.E2E_SECRET ?? '';
  } catch {
    return process.env.E2E_SECRET ?? '';
  }
}
const E2E_SECRET = readE2ESecret();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30000,
  reporter: [
    ['json', { outputFile: '/tmp/pw-e2e-results.json' }],
    ['line'],
    ['./tests/e2e/live-reporter.ts'],
  ],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    trace: 'off',
    headless: true,
    extraHTTPHeaders: E2E_SECRET ? { 'x-e2e-auth': E2E_SECRET } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
