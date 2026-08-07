import { test, expect, goToShots, addShot, addCharacter, addLocation, switchTab } from './fixtures/app';
import type { Page } from '@playwright/test';

// app.js is a plain (non-module) script, so its top-level functions and vars are
// accessible as globals from page.evaluate(). loadData() re-reads localStorage
// and re-renders the DOM — same code path as a real reload, but without the
// addInitScript clearing localStorage that would happen on page.reload().
async function saveAndSimulatedReload(page: Page) {
  // saveData() calls syncFromDOM() then _persistData() which writes to localStorage
  // synchronously before any async Supabase work.
  await page.locator('.save-btn, [onclick="saveData()"]').first().click();
  await page.waitForTimeout(150); // let the click handler complete

  // Simulate a reload: re-run loadData() in-place. In the test environment
  // Supabase returns null (503 — not configured), so loadData() falls back to
  // localStorage, the same data that was just written by saveData().
  await page.evaluate(async () => {
    // @ts-ignore
    await loadData();
  });
  await page.waitForTimeout(300); // let renderAll() complete
}

test.describe('Field persistence across reload', () => {
  test('character name persists after Save + reload', async ({ editorPage: { page } }) => {
    await addCharacter(page, 'PersistNameTest');
    await saveAndSimulatedReload(page);
    await switchTab(page, 'characters');
    await expect(page.locator('#characters-body .field-name').first()).toHaveValue('PersistNameTest', { timeout: 10000 });
  });

  test('character prompt persists after Save + reload', async ({ editorPage: { page } }) => {
    await addCharacter(page);
    await page.locator('#characters-body .field-prompt').first().fill('PersistPromptTest');
    await saveAndSimulatedReload(page);
    await switchTab(page, 'characters');
    await expect(page.locator('#characters-body .field-prompt').first()).toHaveValue('PersistPromptTest', { timeout: 10000 });
  });

  test('character description (contenteditable) persists after Save + reload', async ({ editorPage: { page } }) => {
    await addCharacter(page);
    const refField = page.locator('#characters-body .field-ref').first();
    await refField.evaluate(el => { (el as HTMLElement).innerHTML = 'PersistCharRefTest'; });
    await refField.dispatchEvent('input');
    await page.waitForTimeout(100);
    await saveAndSimulatedReload(page);
    await switchTab(page, 'characters');
    await expect(page.locator('#characters-body .field-ref').first()).toContainText('PersistCharRefTest', { timeout: 10000 });
  });

  test('location name persists after Save + reload', async ({ editorPage: { page } }) => {
    await addLocation(page, 'PersistLocNameTest');
    await saveAndSimulatedReload(page);
    await switchTab(page, 'locations');
    await expect(page.locator('#locations-body .field-name').first()).toHaveValue('PersistLocNameTest', { timeout: 10000 });
  });

  test('location description persists after Save + reload', async ({ editorPage: { page } }) => {
    await addLocation(page);
    await page.locator('#locations-body .field-ref').first().fill('PersistLocRefTest');
    await saveAndSimulatedReload(page);
    await switchTab(page, 'locations');
    await expect(page.locator('#locations-body .field-ref').first()).toHaveValue('PersistLocRefTest', { timeout: 10000 });
  });

  test('location prompt persists after Save + reload', async ({ editorPage: { page } }) => {
    await addLocation(page);
    await page.locator('#locations-body .field-prompt').first().fill('PersistLocPromptTest');
    await saveAndSimulatedReload(page);
    await switchTab(page, 'locations');
    await expect(page.locator('#locations-body .field-prompt').first()).toHaveValue('PersistLocPromptTest', { timeout: 10000 });
  });

  test('shot lyric persists after Save + reload', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await page.locator('#shots-body .field-lyric').first().fill('PersistLyricTest');
    await saveAndSimulatedReload(page);
    await goToShots(page);
    await expect(page.locator('#shots-body .field-lyric').first()).toHaveValue('PersistLyricTest', { timeout: 10000 });
  });

  test('shot visual description persists after Save + reload', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await page.locator('#shots-body .field-desc').first().fill('PersistDescTest');
    await saveAndSimulatedReload(page);
    await goToShots(page);
    await expect(page.locator('#shots-body .field-desc').first()).toHaveValue('PersistDescTest', { timeout: 10000 });
  });

  test('shot image prompt persists after Save + reload', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await page.locator('#shots-body .field-imgprompt').first().fill('PersistImgPromptTest');
    await saveAndSimulatedReload(page);
    await goToShots(page);
    await expect(page.locator('#shots-body .field-imgprompt').first()).toHaveValue('PersistImgPromptTest', { timeout: 10000 });
  });

  test('shot video prompt persists after Save + reload', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    await page.locator('#shots-body .field-vidprompt').first().fill('PersistVidPromptTest');
    await saveAndSimulatedReload(page);
    await goToShots(page);
    await expect(page.locator('#shots-body .field-vidprompt').first()).toHaveValue('PersistVidPromptTest', { timeout: 10000 });
  });

  test('shot timestamp persists after Save + reload', async ({ editorPage: { page } }) => {
    await goToShots(page);
    await addShot(page);
    // Use .last() — previous tests may have left shots in the sentinel when sentinel
    // reset is unavailable (Supabase not configured in test mode). The newly added
    // shot is always last.
    await page.locator('#shots-body .field-timestamp').last().fill('1:23');
    const lastShotId = await page.locator('#shots-body tr[data-id]').last().getAttribute('data-id');
    await saveAndSimulatedReload(page);
    await goToShots(page);
    await expect(page.locator(`#shots-body tr[data-id="${lastShotId}"] .field-timestamp`)).toHaveValue('1:23', { timeout: 10000 });
  });
});
