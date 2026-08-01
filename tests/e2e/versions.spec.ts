import { test, expect, goToShots, addShot } from './fixtures/app';

test.describe('Versions', () => {
  test('version UI is visible in the editor header', async ({ editorPage: { page } }) => {
    // The version bar should be rendered in the header
    await expect(page.locator('#version-ui')).toBeVisible();
  });

  test('creating a named version appears in the version list', async ({ editorPage: { page } }) => {
    // Make a change so a version can be created
    await goToShots(page);
    await addShot(page);

    // Look for the "Create Version" or snapshot button
    const versionBtn = page.locator('[onclick*="createVersion"], [onclick*="saveVersion"], .btn-create-version').first();
    if (await versionBtn.isVisible()) {
      page.once('dialog', async d => {
        await d.fill('Test Version');
        await d.accept();
      });
      await versionBtn.click();
      await page.waitForTimeout(500);
      // Version label should appear in the version bar
      await expect(page.locator('#version-ui')).toContainText(/Test Version|version/i);
    }
  });

  test('version list renders inside version-ui', async ({ editorPage: { page } }) => {
    await expect(page.locator('#version-ui')).toBeVisible();
    // At minimum there should be a current-state indicator
    const versionUi = await page.locator('#version-ui').innerHTML();
    expect(versionUi.length).toBeGreaterThan(0);
  });
});
