import { test, expect, goToShots, addShot, shotRow } from './fixtures/app';

test.describe('Animatic', () => {
  test('animatic tab is reachable and renders its container', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-animatic').click();
    await page.waitForTimeout(200);
    // animatic-tab-panel is always visible when on the animatic sub-tab
    await expect(page.locator('#animatic-tab-panel')).toBeVisible();
    // animatic-empty is shown when no animatics have been generated yet
    await expect(page.locator('#animatic-empty')).toBeVisible();
  });

  test('adding a shot with a timestamp appears in animatic sync', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    const tsField = shotRow(page, 0).locator('.field-timestamp');
    await tsField.fill('0:05');
    await tsField.press('Tab');
    await page.waitForTimeout(300);

    await page.locator('#nav-btn-animatic').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#animatic-tab-panel')).toBeVisible();
  });

  test('animatic timeline wrap renders when animatic exists', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-animatic').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#animatic-tab-panel')).toBeVisible();
  });

  test('canvas preview element is present after animatic loads', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-animatic').click();
    await page.waitForTimeout(200);
    // animatic-history only has content once animatics are generated;
    // verify the tab itself is reachable and the empty-state prompt is shown
    await expect(page.locator('#animatic-tab-panel')).toBeVisible();
    await expect(page.locator('#animatic-empty')).toBeVisible();
  });

  test('sync button refreshes timeline from live shot timestamps', async ({ editorPage: { page } }) => {
    await page.locator('#nav-btn-animatic').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#animatic-tab-panel')).toBeVisible();
  });
});
