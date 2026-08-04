import { test as base, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
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
    // Navigate first so page.request shares the session/auth with the page
    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });

    // Open or create the sentinel project.
    // The sentinel row in `projects` is created by the browser (anon key) so it
    // is always visible to the anon Supabase client. On first run it won't exist
    // yet, so we create it via the new-project dialog.
    const card = page.locator('.project-card', { hasText: SENTINEL_NAME });
    let sentinelId: string | null = null;

    if (await card.count() === 0) {
      // First run: create via dialog — this row persists for all future runs
      page.once('dialog', d => d.accept(SENTINEL_NAME));
      await page.locator('[onclick="createProject()"]').first().click();
      await page.waitForSelector('#view-editor', { state: 'visible' });
      // Extract the newly-created project ID from the URL or DOM
      sentinelId = await page.evaluate(() => (window as any).currentProjectId ?? null);
      // Go back to projects page so we can do the clean-reset flow
      await page.locator('.btn-back-projects').click();
      await page.waitForSelector('#projects-grid', { state: 'visible' });
    } else {
      // Extract the ID from the card's proj-name element: id="proj-name-{id}"
      const nameEl = card.locator('[id^="proj-name-"]').first();
      const nameId = await nameEl.getAttribute('id');
      sentinelId = nameId ? nameId.replace('proj-name-', '') : null;
    }

    // Reset sentinel data (storage + snapshots) to a clean empty state.
    const resetBody = sentinelId ? JSON.stringify({ projectId: sentinelId }) : '{}';
    const resp = await page.request.post('/api/e2e/reset-sentinel', {
      headers: { 'x-e2e-auth': E2E_SECRET, 'content-type': 'application/json' },
      data: resetBody,
    });
    if (!resp.ok()) throw new Error(`Sentinel reset failed: ${await resp.text()}`);

    // Clear localStorage so loadData() ignores any stale local cache and reads
    // the fresh data.json we just wrote to Supabase Storage
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });

    // Click the sentinel card to open it
    await page.locator('.project-card', { hasText: SENTINEL_NAME }).click();
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
