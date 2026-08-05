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

  // 'request' uses config's baseURL + extraHTTPHeaders without needing any navigation
  editorPage: async ({ page, request }, use) => {
    const SENTINEL_FILE = '/tmp/e2e-sentinel-id.txt';
    let sentinelId: string | null = null;
    try { sentinelId = readFileSync(SENTINEL_FILE, 'utf8').trim() || null; } catch {}

    // Reset sentinel BEFORE any navigation — no goto needed for this call
    if (sentinelId) {
      try {
        const resp = await request.post('/api/e2e/reset-sentinel', {
          headers: { 'x-e2e-auth': E2E_SECRET, 'content-type': 'application/json' },
          data: JSON.stringify({ projectId: sentinelId }),
        });
        if (!resp.ok()) {
          console.error('[e2e] sentinel reset failed:', resp.status(), await resp.text());
          sentinelId = null;
        }
      } catch (e) {
        console.error('[e2e] sentinel reset threw:', e);
        sentinelId = null;
      }
    }

    // Clear localStorage before app scripts run so initApp() never restores a
    // stale project — eliminates the need for a second page.goto() to reset state.
    await page.addInitScript(() => localStorage.clear());

    // Single navigation to the app
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (page.url().includes('login')) {
      throw new Error(
        `[e2e] Auth redirect — E2E_SECRET may be wrong.\n` +
        `  Secret loaded: ${E2E_SECRET ? E2E_SECRET.slice(0, 6) + '…' : '(empty)'}\n` +
        `  URL: ${page.url()}`
      );
    }
    await page.waitForSelector('#projects-grid', { state: 'visible', timeout: 30000 });

    if (!sentinelId) {
      // First run: create sentinel via dialog. The row is created by the anon
      // client so it is always visible to subsequent anon Supabase reads.
      page.once('dialog', d => d.accept(SENTINEL_NAME));
      await page.locator('[onclick="createProject()"]').first().click();
      // Wait for the editor DOM state — more reliable than polling a JS global,
      // and avoids races between the test budget and waitForFunction polling.
      await page.waitForSelector('#view-editor', { state: 'visible', timeout: 25000 });
      await page.waitForSelector('#data-loading-overlay', { state: 'hidden', timeout: 25000 });
      sentinelId = await page.evaluate(() => (window as any).currentProjectId as string);
      if (!sentinelId) throw new Error('[e2e] currentProjectId not set after editor opened');
      writeFileSync(SENTINEL_FILE, sentinelId, 'utf8');
      // Reset data on server so subsequent runs start clean; new project is already empty.
      await request.post('/api/e2e/reset-sentinel', {
        headers: { 'x-e2e-auth': E2E_SECRET, 'content-type': 'application/json' },
        data: JSON.stringify({ projectId: sentinelId }),
      });
      // Editor is already open with the sentinel project — hand it to the test directly.
      await use({ page, projectName: SENTINEL_NAME });
      return;
    }

    // Verify the sentinel card is still in the grid (guards against Supabase deletion)
    const cardCount = await page.locator(`[onclick="openProject('${sentinelId}')"]`).count();
    if (cardCount === 0) {
      writeFileSync(SENTINEL_FILE, '', 'utf8');
      throw new Error(
        `[e2e] Sentinel card not found — project may have been deleted from Supabase. ` +
        `Run again to recreate it.`
      );
    }

    // Open by ID — immune to name changes from prior test runs
    await page.locator(`[onclick="openProject('${sentinelId}')"]`).click();
    await page.waitForSelector('#view-editor', { state: 'visible', timeout: 20000 });
    // Overlay hides in loadData()'s finally block — allow 30s for slow Supabase reads
    await page.waitForSelector('#data-loading-overlay', { state: 'hidden', timeout: 30000 });

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
