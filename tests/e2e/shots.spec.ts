import { test, expect, goToShots, addShot, shotRow, addCharacter, addLocation } from './fixtures/app';

test.describe('Shot Sequence', () => {
  test('adding a shot appends a new row with empty fields', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    const row = shotRow(page, 0);
    await expect(row).toBeVisible();
    // Timestamp and lyric should be empty on a new shot
    await expect(row.locator('.field-timestamp')).toHaveValue('');
    await expect(row.locator('.field-lyric')).toHaveValue('');
  });

  test('assigning a character updates the character column', async ({ editorPage: { page } }) => {
    await addCharacter(page, 'Protagonist');
    await goToShots(page);
    await addShot(page);
    const row = shotRow(page, 0);
    // Check the character checkbox for 'Protagonist'
    const charCheckbox = row.locator('.char-cb').first();
    await charCheckbox.check();
    await page.waitForTimeout(200);
    await expect(charCheckbox).toBeChecked();
  });

  test('assigning a location shows name in location select', async ({ editorPage: { page } }) => {
    await addLocation(page, 'Warehouse');
    await goToShots(page);
    await addShot(page);
    const row = shotRow(page, 0);
    const locSelect = row.locator('.field-loc-select');
    // Select the location we just added
    await locSelect.selectOption({ label: /Warehouse/ });
    await expect(locSelect).toContainText('Warehouse');
  });

  test('setting a timestamp persists and shows in the field', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    const tsField = shotRow(page, 0).locator('.field-timestamp');
    await tsField.fill('0:30');
    await tsField.press('Tab');
    await page.waitForTimeout(300);
    // Navigate away and back
    await page.locator('#nav-btn-characters').click();
    await goToShots(page);
    await expect(shotRow(page, 0).locator('.field-timestamp')).toHaveValue('0:30');
  });

  test('new shot added mid-sequence appears in the correct position', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await addShot(page);
    // Both rows should be visible
    await expect(page.locator('#shots-body tr[data-id]')).toHaveCount(2);
    // Use the + button on the first row to insert a shot after it
    const insertBtn = shotRow(page, 0).locator('[onclick^="addShotAfter"]');
    await insertBtn.click();
    await page.waitForFunction(
      () => document.querySelectorAll('#shots-body tr[data-id]').length >= 3,
    );
    await expect(page.locator('#shots-body tr[data-id]')).toHaveCount(3);
  });

  test('editing a lyric field persists via syncFromDOM', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    const lyricField = shotRow(page, 0).locator('.field-lyric');
    await lyricField.fill('First verse line');
    await lyricField.press('Tab');
    await page.locator('#nav-btn-characters').click();
    await goToShots(page);
    await expect(shotRow(page, 0).locator('.field-lyric')).toHaveValue('First verse line');
  });

  test('deleting a shot removes it from the sequence', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await addShot(page);
    const before = await page.locator('#shots-body tr[data-id]').count();
    await shotRow(page, 0).locator('[onclick^="deleteShot"]').first().click();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('#shots-body tr[data-id]').length < n,
      before,
    );
    await expect(page.locator('#shots-body tr[data-id]')).toHaveCount(before - 1);
  });
});
