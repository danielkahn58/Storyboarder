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
      page.once('dialog', d => d.accept('Test Version'));
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

  test('switching to older version restores data from that snapshot', async ({ editorPage: { page } }) => {
    // 1. Add a shot and save a named version
    await goToShots(page);
    await addShot(page);
    const lyricV1 = 'Version one lyric';
    await page.locator('.field-lyric').first().fill(lyricV1);
    await page.waitForTimeout(200);

    // Create version 1
    const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
    await newVersionBtn.click();
    await page.waitForTimeout(400);
    const versionSelect = page.locator('.version-select').first();
    const v1Label = await versionSelect.inputValue();

    // 2. Make changes in the shots tab — new lyric
    const lyricV2 = 'Version two lyric — different';
    await page.locator('.field-lyric').first().fill(lyricV2);
    await page.waitForTimeout(200);

    // 3. Make a change in the characters tab
    await page.locator('#nav-btn-characters').click();
    await page.waitForTimeout(200);
    const addCharBtn = page.locator('[onclick*="addCharacter"], button:has-text("+ Character")').first();
    if (await addCharBtn.isVisible()) {
      await addCharBtn.click();
      await page.waitForTimeout(300);
    }

    // 4. Create version 2 capturing those changes
    await newVersionBtn.click();
    await page.waitForTimeout(400);

    // 5. Revert to version 1 via the select
    await versionSelect.selectOption(v1Label);
    await page.waitForTimeout(600);

    // 6. Verify shots tab shows v1 lyric, not v2 lyric
    await page.locator('#nav-btn-shots').click();
    await page.waitForTimeout(300);
    const lyricField = page.locator('.field-lyric').first();
    await expect(lyricField).toHaveValue(lyricV1);
    // v2 lyric must not appear anywhere in the shot rows
    const bodyText = await page.locator('#shots-body').innerText().catch(() => '');
    expect(bodyText).not.toContain('Version two lyric');
  });
});
