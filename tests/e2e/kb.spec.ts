import { test, expect } from './fixtures/app';

test.describe('Docs & Tests Modal (KB)', () => {
  test('KB button is visible in the header', async ({ editorPage: { page } }) => {
    await expect(page.locator('#btn-open-kb')).toBeVisible();
  });

  test('clicking KB button opens the modal', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await expect(page.locator('#kb-modal')).toBeVisible();
  });

  test('Product Spec tab loads content', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-spec').click();
    await page.waitForTimeout(500);
    const body = page.locator('#kb-body');
    await expect(body).not.toContainText('Loading');
    const text = await body.innerText();
    expect(text.length).toBeGreaterThan(50);
  });

  test('Architecture tab loads content from CLAUDE.md', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-arch').click();
    await page.waitForTimeout(800);
    const body = page.locator('#kb-body');
    await expect(body).not.toContainText('Loading');
    await expect(body).toContainText(/stack|architecture|convention/i);
  });

  test('Unit/API Tests tab loads test results table', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-unit').click();
    await page.waitForTimeout(800);
    const body = page.locator('#kb-body');
    await expect(body).not.toContainText('Loading');
    // Should have a table with test result data
    await expect(body.locator('table')).toBeVisible();
  });

  test('Run Tests button is visible on Unit/API tab', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-unit').click();
    await expect(page.locator('#btn-run-tests')).toBeVisible();
  });

  test('UI Test Cases tab renders a table with manual check column', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-ui').click();
    await page.waitForTimeout(300);
    const body = page.locator('#kb-body');
    await expect(body.locator('table')).toBeVisible();
    // Should have clickable ○ circles for manual checking
    await expect(body.locator('span[onclick^="toggleUiTestCheck"]').first()).toBeVisible();
  });

  test('Run Tests button is hidden on UI Test Cases tab', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-tab-ui').click();
    await expect(page.locator('#btn-run-tests')).not.toBeVisible();
  });

  test('closing modal hides it', async ({ editorPage: { page } }) => {
    await page.locator('#btn-open-kb').click();
    await page.locator('#kb-modal').waitFor({ state: 'visible' });
    await page.locator('#kb-modal button:has-text("✕")').click();
    await expect(page.locator('#kb-modal')).not.toBeVisible();
  });
});
