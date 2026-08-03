import { test as base, expect, Page } from '@playwright/test';

export { expect };

export type AppFixtures = {
  projectsPage: Page;
  editorPage: { page: Page; projectName: string };
};

export const test = base.extend<AppFixtures>({
  projectsPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });
    await use(page);
  },

  editorPage: async ({ page }, use) => {
    await page.goto('/');
    await page.waitForSelector('#projects-grid', { state: 'visible' });
    page.once('dialog', async d => { await d.accept('Test Project'); });
    await page.locator('.btn-new-project').first().click();
    await page.waitForSelector('#view-editor', { state: 'visible' });
    const projectName = await page.locator('.header-project-name').innerText();
    await use({ page, projectName });

    // Teardown: close any open modal, go back to projects, delete the project we created
    try {
      // Close any open modal (e.g. KB modal) so it doesn't block navigation
      await page.evaluate(() => {
        document.querySelectorAll('[id$="-modal"]').forEach((m: any) => { m.style.display = 'none'; });
      });
      await page.goto('/');
      await page.waitForSelector('#projects-grid', { state: 'visible' });
      const cards = page.locator('.project-card');
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const name = await cards.nth(i).locator('.project-card-name').innerText().catch(() => '');
        if (name.trim() === projectName.trim()) {
          page.once('dialog', d => d.accept());
          await cards.nth(i).locator('.btn-delete-project').last().click();
          break;
        }
      }
    } catch (_) { /* best-effort teardown */ }
  },
});

/** Click a tab in the main section nav */
export async function switchTab(page: Page, tabId: string) {
  await page.locator(`#nav-btn-${tabId}`).click();
  await page.waitForTimeout(200);
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
