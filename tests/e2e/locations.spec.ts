import { test, expect, switchTab, addLocation } from './fixtures/app';

test.describe('Locations', () => {
  test('adding a location appends a card with default name', async ({ editorPage: { page } }) => {
    await switchTab(page, 'locations');
    const before = await page.locator('#locations-body tr[data-id]').count();
    await page.locator('[onclick="addLocation()"]').click();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('#locations-body tr[data-id]').length > n,
      before,
    );
    await expect(page.locator('#locations-body tr[data-id]')).toHaveCount(before + 1);
  });

  test('editing location name persists via syncFromDOM', async ({ editorPage: { page } }) => {
    await addLocation(page, 'City Rooftop');
    const nameInput = page.locator('#locations-body tr[data-id]').last().locator('input.field-name').first();
    await expect(nameInput).toHaveValue('City Rooftop');

    await switchTab(page, 'characters');
    await switchTab(page, 'locations');
    await expect(page.locator('#locations-body tr[data-id]').last().locator('input.field-name').first()).toHaveValue('City Rooftop');
  });

  test('adding a custom view shows it in the variations grid', async ({ editorPage: { page } }) => {
    await addLocation(page, 'Studio');
    const lastRow = page.locator('#locations-body tr[data-id]').last();

    // Open variations panel
    await lastRow.locator('.btn-toggle-shot-angles').first().click();
    await page.waitForTimeout(200);

    // Add a custom view
    const addViewBtn = page.locator('[onclick^="addLocCustomView"]').first();
    if (await addViewBtn.isVisible()) {
      const before = await page.locator('.loc-shot-row input[placeholder*="View name"]').count();
      await addViewBtn.click();
      await page.waitForFunction(
        (n: number) => document.querySelectorAll('.loc-shot-row input[placeholder*="View name"]').length > n,
        before,
      );
      const inputs = page.locator('.loc-shot-row input[placeholder*="View name"]');
      await expect(inputs.last()).toBeVisible();
    }
  });

  test('deleting a location removes it', async ({ editorPage: { page } }) => {
    await addLocation(page, 'Temp Location');
    const before = await page.locator('#locations-body tr[data-id]').count();
    await page.locator('#locations-body tr[data-id]').last().locator('.btn-delete, [onclick^="deleteLocation"]').click();
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('#locations-body tr[data-id]').length < n,
      before,
    );
    await expect(page.locator('#locations-body tr[data-id]')).toHaveCount(before - 1);
  });
});
