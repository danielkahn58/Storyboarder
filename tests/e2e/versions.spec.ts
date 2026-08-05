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

    // Look for the "Create Version" or snapshot button (createVersion auto-labels, no dialog)
    const versionBtn = page.locator('[onclick*="createVersion"], [onclick*="saveVersion"], .btn-create-version').first();
    if (await versionBtn.isVisible()) {
      await versionBtn.click();
      await page.waitForTimeout(500);
      // Version label should appear in the version bar
      await expect(page.locator('#version-ui')).toContainText(/\d/);
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

  // BUG: after saving a named version, making further edits, reverting to the
  // saved version, then returning to the current state, those further edits are
  // lost — the "current" slot doesn't preserve unsaved changes made after the
  // last named version was created.
  test('returning to current after reverting preserves edits made after last version', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);

    // Set a lyric and save a named version (v1)
    const lyricV1 = 'lyric at version one';
    await page.locator('.field-lyric').first().fill(lyricV1);
    await page.waitForTimeout(300);
    const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
    await newVersionBtn.click();
    await page.waitForTimeout(500);

    const versionSelect = page.locator('.version-select').first();
    const v1Label = await versionSelect.inputValue();

    // Make further edits AFTER saving v1 (these should be preserved as "current")
    const lyricAfterV1 = 'lyric edited after v1 — should survive revert+return';
    await page.locator('.field-lyric').first().fill(lyricAfterV1);
    await page.waitForTimeout(300);

    // Revert to v1
    await versionSelect.selectOption(v1Label);
    await page.waitForTimeout(600);
    const lyricOnV1 = await page.locator('.field-lyric').first().inputValue();
    expect(lyricOnV1).toBe(lyricV1);

    // Return to "current" (the top/most-recent entry in the select)
    const options = await versionSelect.locator('option').all();
    const firstOptionValue = await options[0].getAttribute('value');
    await versionSelect.selectOption(firstOptionValue!);
    await page.waitForTimeout(600);

    // The edits made after v1 should still be here — this currently FAILS (bug)
    const lyricOnCurrent = await page.locator('.field-lyric').first().inputValue();
    expect(lyricOnCurrent).toBe(lyricAfterV1);
  });
});
