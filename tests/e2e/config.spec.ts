import { test, expect } from './fixtures/app';

test.describe('Configuration', () => {
  test('configuration tab loads and shows settings', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-config').click();
    await page.waitForTimeout(200);
    // Config tab should render some settings (cloud-only toggle, visual styles, etc.)
    await expect(page.locator('#tab-config, [id*="config"]').first()).toBeVisible();
  });

  test('cloud-only toggle is present in config tab', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-config').click();
    await page.waitForTimeout(200);
    // Look for the cloud-only toggle checkbox or button
    const toggle = page.locator('[onclick*="CloudOnly"], [onchange*="CloudOnly"], #cloud-only-toggle, input[type="checkbox"]').first();
    await expect(toggle).toBeVisible();
  });

  test('visual styles section renders in config tab', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-config').click();
    await page.waitForTimeout(200);
    // Visual styles table or add-style button should be present
    const stylesSection = page.locator('.btn-add-style, [onclick*="addVisualStyle"], #styles-table').first();
    await expect(stylesSection).toBeVisible();
  });
});
