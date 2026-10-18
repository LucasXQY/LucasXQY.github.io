import { expect, test } from '@playwright/test';

test('the footer shows six stars, none lit on a first visit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer .star')).toHaveCount(6);
  await expect(page.locator('footer .star.lit')).toHaveCount(0);
  await expect(page.locator('footer .stars')).toHaveAttribute(
    'aria-label',
    'Curiosity: 0 of 6 — open the achievements panel',
  );
});

test('a stored achievement lights its star after a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('qx.achievements', JSON.stringify(['cat'])));
  await page.reload();

  await expect(page.locator('.star.lit')).toHaveCount(1);
  await expect(page.locator('.star.lit')).toHaveAttribute('data-id', 'cat');
  await expect(page.locator('footer .stars')).toHaveAttribute(
    'aria-label',
    'Curiosity: 1 of 6 — open the achievements panel',
  );
});

test('garbage in storage lights nothing and throws nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('qx.achievements', '{not json'));
  await page.goto('/');

  await expect(page.locator('footer .star')).toHaveCount(6);
  await expect(page.locator('footer .stars')).toHaveAttribute(
    'aria-label',
    'Curiosity: 0 of 6 — open the achievements panel',
  );
  await expect(page.locator('.star.lit')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a blocked localStorage still renders the stars without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
    });
  });
  await page.goto('/');

  await expect(page.locator('footer .star')).toHaveCount(6);
  await expect(page.locator('footer .stars')).toHaveAttribute(
    'aria-label',
    'Curiosity: 0 of 6 — open the achievements panel',
  );
  expect(errors).toEqual([]);
});

test('print media hides the stars', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer .stars')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('footer .stars')).toBeHidden();
});
