import { test, expect, goToShots, addShot, addCharacter, addLocation, switchTab } from './fixtures/app';

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
  // saved version, then returning to "current", those post-version edits are
  // lost. The tests below cover each element type independently.
  test.describe('revert-then-return-to-current preserves post-version edits', () => {
    async function revertThenReturnFlow(
      page: import('@playwright/test').Page,
      setup: () => Promise<{ readValue: () => Promise<string> }>,
      editValue: (val: string) => Promise<void>,
    ) {
      const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
      const versionSelect = page.locator('.version-select').first();

      // establish v1 state
      const { readValue } = await setup();
      await editValue('value-at-v1');
      await page.waitForTimeout(300);
      await newVersionBtn.click();
      await page.waitForTimeout(500);
      const v1Label = await versionSelect.inputValue();

      // make further edits after v1 (these become the "current" state)
      await editValue('value-after-v1-should-survive');
      await page.waitForTimeout(300);

      // revert to v1 and confirm v1 value is showing
      await versionSelect.selectOption(v1Label);
      await page.waitForTimeout(600);
      expect(await readValue()).toBe('value-at-v1');

      // return to current
      const firstOption = await versionSelect.locator('option').first().getAttribute('value');
      await versionSelect.selectOption(firstOption!);
      await page.waitForTimeout(600);

      // post-v1 edits should be intact — this currently FAILS (bug)
      expect(await readValue()).toBe('value-after-v1-should-survive');
    }

    test('shots — lyric field survives revert+return', async ({ editorPage: { page } }) => {
      await revertThenReturnFlow(
        page,
        async () => {
          await goToShots(page);
          await addShot(page);
          return { readValue: () => page.locator('#shots-body .field-lyric').first().inputValue() };
        },
        val => page.locator('#shots-body .field-lyric').first().fill(val),
      );
    });

    test('shots — visual description field survives revert+return', async ({ editorPage: { page } }) => {
      await revertThenReturnFlow(
        page,
        async () => {
          await goToShots(page);
          await addShot(page);
          return { readValue: () => page.locator('#shots-body .field-desc').first().inputValue() };
        },
        val => page.locator('#shots-body .field-desc').first().fill(val),
      );
    });

    test('characters — name field survives revert+return', async ({ editorPage: { page } }) => {
      await revertThenReturnFlow(
        page,
        async () => {
          await addCharacter(page);
          await switchTab(page, 'characters');
          return { readValue: () => page.locator('#characters-body .field-name').first().inputValue() };
        },
        val => page.locator('#characters-body .field-name').first().fill(val),
      );
    });

    test('locations — name field survives revert+return', async ({ editorPage: { page } }) => {
      await revertThenReturnFlow(
        page,
        async () => {
          await addLocation(page);
          await switchTab(page, 'locations');
          return { readValue: () => page.locator('#locations-body .field-name').first().inputValue() };
        },
        val => page.locator('#locations-body .field-name').first().fill(val),
      );
    });
  });
});
