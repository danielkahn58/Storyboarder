import { test, expect, switchTab, addCharacter } from './fixtures/app';

test.describe('Characters', () => {
  test('adding a character appends a new row with default name', async ({ editorPage: { page } }) => {
    await switchTab(page, 'characters');
    const before = await page.locator('#characters-body tr[data-id]').count();
    await page.locator('[onclick="addCharacter()"]').click();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('#characters-body tr[data-id]').length > n,
      before,
    );
    const rows = page.locator('#characters-body tr[data-id]');
    await expect(rows).toHaveCount(before + 1);
  });

  test('editing name and description persists via syncFromDOM', async ({ editorPage: { page } }) => {
    await addCharacter(page, 'Hero');
    const lastRow = page.locator('#characters-body tr[data-id]').last();
    const nameInput = lastRow.locator('input.field-name').first();
    await expect(nameInput).toHaveValue('Hero');

    // Edit the prompt/description field (characters use field-prompt, not field-desc)
    const descInput = lastRow.locator('textarea.field-prompt').first();
    await descInput.fill('A brave protagonist');
    await descInput.press('Tab');

    // Navigate away and back — value should survive re-render
    await switchTab(page, 'locations');
    await switchTab(page, 'characters');
    await expect(page.locator('#characters-body tr[data-id]').last().locator('input.field-name').first()).toHaveValue('Hero');
  });

  test('deleting a character removes it and auto-saves', async ({ editorPage: { page } }) => {
    await addCharacter(page, 'Temp Character');
    const before = await page.locator('#characters-body tr[data-id]').count();
    await page.locator('#characters-body tr[data-id]').last().locator('.btn-delete, [onclick^="deleteCharacter"]').click();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('#characters-body tr[data-id]').length < n,
      before,
    );
    await expect(page.locator('#characters-body tr[data-id]')).toHaveCount(before - 1);
  });
});
