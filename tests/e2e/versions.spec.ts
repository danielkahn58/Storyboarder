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

    // Create version 1 — wait for snapshot to land in Supabase
    const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/snapshots') && r.request().method() === 'POST', { timeout: 30000 }),
      newVersionBtn.click(),
    ]);
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
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/snapshots') && r.request().method() === 'POST', { timeout: 30000 }),
      newVersionBtn.click(),
    ]);

    // 5. Revert to version 1 via the select — wait for load to complete
    await versionSelect.selectOption(v1Label);
    await page.waitForTimeout(200);

    // 6. Verify shots tab shows v1 lyric, not v2 lyric
    await page.locator('#nav-btn-shots').click();
    await expect(page.locator('.field-lyric').first()).toHaveValue(lyricV1, { timeout: 30000 });
    const bodyText = await page.locator('#shots-body').innerText().catch(() => '');
    expect(bodyText).not.toContain('Version two lyric');
  });

  test('reverting to previous version restores character name', async ({ editorPage: { page } }) => {
    // 1. Add a character with a specific name and save version 1
    await addCharacter(page, 'OriginalName');
    await switchTab(page, 'characters');

    const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/snapshots') && r.request().method() === 'POST', { timeout: 30000 }),
      newVersionBtn.click(),
    ]);
    const versionSelect = page.locator('.version-select').first();
    const v1Label = await versionSelect.inputValue();

    // 2. Change the character name (post-v1 edit)
    await page.locator('#characters-body .field-name').first().fill('ChangedName');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // 3. Revert to v1 — the character name should go back to 'OriginalName'
    await versionSelect.selectOption(v1Label);
    await switchTab(page, 'characters');
    await expect(page.locator('#characters-body .field-name').first()).toHaveValue('OriginalName', { timeout: 30000 });
    // The changed name must NOT be visible
    const bodyText = await page.locator('#characters-body').innerText().catch(() => '');
    expect(bodyText).not.toContain('ChangedName');
  });

  // BUG: after saving a named version, making further edits, reverting to the
  // saved version, then returning to "current", those post-version edits are
  // lost. The tests below cover each element type independently.
  test.describe('revert-then-return-to-current preserves post-version edits', () => {
    // Wait for the snapshot POST to land in Supabase before trying to load it.
    // Use toHaveValue assertions instead of fixed timeouts so we wait for the
    // async Supabase fetch to complete rather than guessing its duration.
    async function revertThenReturnFlow(
      page: import('@playwright/test').Page,
      setup: () => Promise<{ fieldLocator: string }>,
      editValue: (val: string) => Promise<void>,
    ) {
      const newVersionBtn = page.locator('#btn-new-version, [onclick*="createVersion"]').first();
      const versionSelect = page.locator('.version-select').first();

      // establish v1 state, then wait for snapshot to be persisted to Supabase
      const { fieldLocator } = await setup();
      await editValue('value-at-v1');
      await page.waitForTimeout(300);
      const [snapshotResp] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/snapshots') && r.request().method() === 'POST', { timeout: 30000 }),
        newVersionBtn.click(),
      ]);
      expect(snapshotResp.ok()).toBeTruthy();
      const v1Label = await versionSelect.inputValue();

      // make further edits AFTER saving v1 (these become the "working copy")
      await editValue('value-after-v1-should-survive');
      await page.waitForTimeout(300);

      // revert to v1 — wait for field to reflect v1's value (confirms async load finished)
      await versionSelect.selectOption(v1Label);
      await expect(page.locator(fieldLocator).first()).toHaveValue('value-at-v1', { timeout: 30000 });

      // return to working copy — wait for post-v1 value to reappear
      await versionSelect.selectOption('');
      // post-v1 edits should be intact — this currently FAILS (bug)
      await expect(page.locator(fieldLocator).first()).toHaveValue('value-after-v1-should-survive', { timeout: 30000 });
    }

    test('shots — lyric field survives revert+return', async ({ editorPage: { page } }) => {
      await revertThenReturnFlow(
        page,
        async () => {
          await goToShots(page);
          await addShot(page);
          return { fieldLocator: '#shots-body .field-lyric' };
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
          return { fieldLocator: '#shots-body .field-desc' };
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
          return { fieldLocator: '#characters-body .field-name' };
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
          return { fieldLocator: '#locations-body .field-name' };
        },
        val => page.locator('#locations-body .field-name').first().fill(val),
      );
    });
  });
});
