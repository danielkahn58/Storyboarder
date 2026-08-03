import { test, expect } from './fixtures/app';

test.describe('Project Management', () => {
  test('projects grid loads with existing projects shown', async ({ projectsPage: page }) => {
    await expect(page.locator('#projects-grid')).toBeVisible();
    // The grid always renders the "New Project" button
    await expect(page.locator('.btn-new-project').first()).toBeVisible();
  });

  test('creating a new project navigates to editor with empty state', async ({ projectsPage: page }) => {
    page.once('dialog', d => d.accept('Test Project'));
    await page.locator('.btn-new-project').first().click();
    await page.waitForSelector('#view-editor', { state: 'visible' });
    await expect(page.locator('.header-project-name')).toBeVisible();
    // Shot sequence should be empty
    await page.locator('#nav-btn-shots').click();
    await expect(page.locator('#shots-body tr[data-id]')).toHaveCount(0);

    // Teardown
    page.once('dialog', d => d.accept());
    await page.locator('.btn-back-projects').click();
    await page.waitForSelector('#projects-grid', { state: 'visible' });
    const cards = page.locator('.project-card');
    const count = await cards.count();
    if (count > 0) {
      await cards.last().locator('.btn-delete-project').last().click();
    }
  });

  test('project name rename prompt saves and updates title', async ({ editorPage: { page, projectName } }) => {
    page.once('dialog', d => d.accept('Renamed Test Project'));
    await page.locator('.header-project-name').click();
    await page.waitForFunction(
      () => (document.querySelector('.header-project-name')?.textContent || '').includes('Renamed'),
    );
    const newName = await page.locator('.header-project-name').innerText();
    expect(newName).toBe('Renamed Test Project');
  });

  test('deleting a project removes it from the grid', async ({ projectsPage: page }) => {
    // Create a project then immediately delete it
    page.once('dialog', d => d.accept('Delete Me'));
    await page.locator('.btn-new-project').first().click();
    await page.waitForSelector('#view-editor', { state: 'visible' });
    const name = await page.locator('.header-project-name').innerText();

    await page.locator('.btn-back-projects').click();
    await page.waitForSelector('#projects-grid', { state: 'visible' });

    const before = await page.locator('.project-card').count();
    page.once('dialog', d => d.accept());
    const cards = page.locator('.project-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const cardName = await cards.nth(i).locator('.project-card-name').innerText().catch(() => '');
      if (cardName.trim() === name.trim()) {
        await cards.nth(i).locator('.btn-delete-project').last().click();
        break;
      }
    }
    await page.waitForFunction(
      (n: number) => document.querySelectorAll('.project-card').length < n,
      before,
    );
    await expect(page.locator('.project-card')).toHaveCount(before - 1);
  });
});
