import { expect, test } from '@playwright/test';
import { SHOW_CV } from '../../src/site.config';

test('while SHOW_CV is off, /cv/ is not built and the nav has no CV link', async ({ page }) => {
  test.skip(SHOW_CV, 'the CV page is shown');
  const response = await page.goto('/cv/');
  expect(response?.status()).toBe(404);
  await page.goto('/');
  await expect(page.locator('nav .links').getByRole('link', { name: 'CV' })).toHaveCount(0);
});

test.describe('the CV page', () => {
  test.skip(!SHOW_CV, 'the CV page is hidden (SHOW_CV is false in src/site.config.ts)');

  test.beforeEach(async ({ page }) => {
    await page.goto('/cv/');
  });

  test('the sections run in the fixed order, Education first and Skills last', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Education',
      'Research',
      'Publications',
      'Teaching',
      'Industry',
      'Leadership',
      'Honors',
      'Skills',
    ]);
    await expect(page.getByRole('heading', { level: 2, name: 'Education' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible();
  });

  test('Publications is a count by status that links to the list, not a rendered list', async ({
    page,
  }) => {
    const link = page.locator('.pub-line a');
    await expect(link).toHaveCount(1);
    await expect(link).toContainText('4 published or accepted');
    await expect(link).toContainText('1 preprint');
    await expect(link).toContainText('2 under review');
    await expect(link).toContainText('1 in preparation');
    await expect(link).toHaveAttribute('href', '/publications/');
    await expect(link).toHaveAccessibleName(
      '4 published or accepted · 1 preprint · 2 under review · 1 in preparation',
    );
    await expect(page.getByText(/\d+ publications/)).toHaveCount(0);
  });

  test('there is no Download PDF link while public/cv.pdf does not exist, and no grade-point average anywhere', async ({
    page,
  }) => {
    await expect(page.getByText('Download PDF')).toHaveCount(0);
    await expect(page.locator('a[href="/cv.pdf"]')).toHaveCount(0);
    await expect(page.getByText(/G[P]A/i)).toHaveCount(0);
  });

  test('at 390px the page does not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
