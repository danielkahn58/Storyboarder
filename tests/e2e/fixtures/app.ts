import { test as base, expect, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export { expect };

export type AppFixtures = {
  projectsPage: Page;
  editorPage: { page: Page; projectName: string };
};

const SENTINEL_NAME = 'E2E Sentinel Project';

// Read E2E_SECRET directly from .env file — source .env doesn't export vars to child processes
function readE2ESecret(): string {
  try {
    const env = readFileSync(join(__dirname, '../../../.env'), 'utf8');
    const match = env.match(/^E2E_SECRET=["']?([^"'\n]+)["']?/m);
    return match?.[1] ?? process.env.E2E_SECRET ?? '';
  } catch {
    return process.env.E2E_SECRET ?? '';
  }
}
const E2E_SECRET = readE2ESecret();

export const test = base.extend<AppFixtures>({
  projectsPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });
    await use(page);
  },

  editorPage: async ({ page }, use) => {
    // Load persisted sentinel ID from previous runs (survives name changes)
    const SENTINEL_FILE = '/tmp/e2e-sentinel-id.txt';
    let sentinelId: string | null = null;
    try { sentinelId = readFileSync(SENTINEL_FILE, 'utf8').trim() || null; } catch {}

    // Navigate first — page.request resolves relative URLs against page.url(),
    // which is about:blank on a fresh page and causes the reset call to fail.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Reset sentinel data + name on the server. If the ID is stale (project
    // deleted), fall through to recreate.
    if (sentinelId) {
      const resp = await page.request.post('/api/e2e/reset-sentinel', {
        headers: { 'x-e2e-auth': E2E_SECRET, 'content-type': 'application/json' },
        data: JSON.stringify({ projectId: sentinelId }),
      });
      if (!resp.ok()) {
        console.error('[e2e] sentinel reset failed:', resp.status(), await resp.text());
        sentinelId = null;
      }
    }

    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });

    if (!sentinelId) {
      // First run (or sentinel was deleted): create via dialog
      page.once('dialog', d => d.accept(SENTINEL_NAME));
      await page.locator('[onclick="createProject()"]').first().click();
      // Wait until the global is set — more reliable than waiting on DOM state
      await page.waitForFunction(() => !!(window as any).currentProjectId, { timeout: 15000 });
      sentinelId = await page.evaluate(() => (window as any).currentProjectId as string);
      writeFileSync(SENTINEL_FILE, sentinelId, 'utf8');
      // Reset the freshly-created project to clean state
      await page.request.post('/api/e2e/reset-sentinel', {
        headers: { 'x-e2e-auth': E2E_SECRET, 'content-type': 'application/json' },
        data: JSON.stringify({ projectId: sentinelId }),
      });
      await page.evaluate(() => localStorage.clear());
      await page.goto('/');
      await page.waitForSelector('#projects-grid', { state: 'visible' });
    }

    // Open by ID — immune to name changes from previous test runs
    await page.locator(`[onclick="openProject('${sentinelId}')"]`).click();
    await page.waitForSelector('#view-editor', { state: 'visible' });
    await page.waitForSelector('#data-loading-overlay', { state: 'hidden' });

    await use({ page, projectName: SENTINEL_NAME });
    // No teardown — next reset-sentinel call restores clean state
  },
});

/** Click a tab in the main section nav */
export async function switchTab(page: Page, tabId: string) {
  await page.locator(`#nav-btn-${tabId}`).click();
  const panelId = ['shots', 'avscript', 'animatic'].includes(tabId) ? 'tab-shots' : `tab-${tabId}`;
  await page.waitForSelector(`#${panelId}`, { state: 'visible' });
}

/** Navigate to the Shot Sequence sub-tab */
export async function goToShots(page: Page) {
  await page.locator('#nav-btn-shots').click();
  await page.waitForSelector('#shots-tab-panel', { state: 'visible' });
}

/** Click "+ Add shot" and wait for the new row to appear */
export async function addShot(page: Page) {
  const before = await page.locator('#shots-body tr[data-id]').count();
  await page.locator('[onclick="addShot()"]').click();
  await page.waitForFunction(
    (n: number) => document.querySelectorAll('#shots-body tr[data-id]').length > n,
    before,
  );
}

/** Return the nth shot row (0-indexed) */
export function shotRow(page: Page, n = 0) {
  return page.locator('#shots-body tr[data-id]').nth(n);
}

/** Add a character and return its name */
export async function addCharacter(page: Page, name?: string): Promise<string> {
  await switchTab(page, 'characters');
  const before = await page.locator('#characters-body tr[data-id]').count();
  await page.locator('[onclick="addCharacter()"]').click();
  await page.waitForFunction(
    (n: number) => document.querySelectorAll('#characters-body tr[data-id]').length > n,
    before,
  );
  if (name) {
    const nameInput = page.locator('#characters-body tr[data-id]').last().locator('input.field-name').first();
    await nameInput.fill(name);
    await nameInput.press('Tab');
  }
  return name ?? 'Unnamed';
}

/** Add a location and return its name */
export async function addLocation(page: Page, name?: string): Promise<string> {
  await switchTab(page, 'locations');
  const before = await page.locator('#locations-body tr[data-id]').count();
  await page.locator('[onclick="addLocation()"]').click();
  await page.waitForFunction(
    (n: number) => document.querySelectorAll('#locations-body tr[data-id]').length > n,
    before,
  );
  if (name) {
    const nameInput = page.locator('#locations-body tr[data-id]').last().locator('input.field-name').first();
    await nameInput.fill(name);
    await nameInput.press('Tab');
  }
  return name ?? 'Unnamed';
}
