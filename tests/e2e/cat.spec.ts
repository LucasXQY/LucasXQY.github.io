import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const cat = (page: Page) => page.locator('#oneko');
const stored = async (page: Page): Promise<string[]> =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('qx.achievements'))) ?? '[]');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('typing cat summons the cat and lights the star; typing it again sends the cat away', async ({
  page,
}) => {
  await expect(cat(page)).toHaveCount(0);

  await page.keyboard.type('cat');
  await expect(cat(page)).toBeVisible();
  expect(await stored(page)).toContain('cat');
  await expect(page.locator('.star.lit[data-id="cat"]')).toHaveCount(1);

  await page.keyboard.type('cat');
  await expect(cat(page)).toHaveCount(0);

  await page.keyboard.type('cat'); // and it comes back
  await expect(cat(page)).toBeVisible();
});

test('the cat is a decoration: hidden from assistive tech, not clickable, not focusable', async ({
  page,
}) => {
  await page.keyboard.type('cat');
  await expect(cat(page)).toBeVisible();

  await expect(cat(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(cat(page)).toHaveCSS('pointer-events', 'none');
  expect(await cat(page).evaluate((el) => el.tabIndex)).toBe(-1); // not in the tab order
  await expect(cat(page)).not.toHaveAttribute('tabindex', /.*/);

  // A click where the cat stands reaches what is underneath it.
  const box = await cat(page).boundingBox();
  if (!box) throw new Error('the cat has no box');
  const under = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id ?? '', {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
  expect(under).not.toBe('oneko');

  await page.emulateMedia({ media: 'print' }); // not on a printed page
  await expect(cat(page)).toBeHidden();
});

test('the sprite loads from /oneko/oneko.gif on every page, not relative to the page', async ({
  page,
}) => {
  await page.goto('/cv/');
  const sprite = page.waitForResponse((response) => response.url().endsWith('/oneko/oneko.gif'));
  await page.keyboard.type('cat');
  expect((await sprite).status()).toBe(200);
  await expect(cat(page)).toHaveCSS('background-image', /\/oneko\/oneko\.gif/);
});

test('toggling leaves one cat at most, no script tags behind, and one unlock', async ({ page }) => {
  await page.keyboard.type('cat');
  await expect(cat(page)).toBeVisible();
  await page.keyboard.type('cat');
  await expect(cat(page)).toHaveCount(0);
  await page.keyboard.type('cat');
  await expect(cat(page)).toBeVisible();

  await expect(cat(page)).toHaveCount(1);
  await expect(page.locator('script[src*="oneko"]')).toHaveCount(0);
  expect((await stored(page)).filter((id) => id === 'cat')).toHaveLength(1);
});

test('window.qxToggleCat() toggles the cat too', async ({ page }) => {
  await page.evaluate(() => (window as Window & { qxToggleCat?: () => void }).qxToggleCat?.());
  await expect(cat(page)).toBeVisible();
  await page.evaluate(() => (window as Window & { qxToggleCat?: () => void }).qxToggleCat?.());
  await expect(cat(page)).toHaveCount(0);
});

test('with reduced motion the cat never appears and nothing is unlocked', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.type('cat');
  await page.waitForTimeout(300);

  await expect(cat(page)).toHaveCount(0);
  expect(await stored(page)).not.toContain('cat');
});

test('typing cat in the terminal input does not summon the cat', async ({ page }) => {
  await page.keyboard.press('`');
  await expect(page.getByLabel('Command')).toBeFocused();

  await page.keyboard.type('cat cv');
  await page.waitForTimeout(300);

  await expect(cat(page)).toHaveCount(0);
  expect(await stored(page)).not.toContain('cat');
});

test('typing cat in a form field does not summon the cat', async ({ page }) => {
  await page.evaluate(() => {
    const field = document.createElement('input');
    field.id = 'probe';
    field.setAttribute('aria-label', 'Probe');
    document.body.append(field);
    field.focus();
  });
  await page.keyboard.type('cat');
  await page.waitForTimeout(300);

  await expect(page.locator('#probe')).toHaveValue('cat');
  await expect(cat(page)).toHaveCount(0);
});

test('a shortcut with a modifier does not count', async ({ page }) => {
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+t');
  await page.waitForTimeout(300);
  await expect(cat(page)).toHaveCount(0);
});

test('the page has no accessibility violations with the cat out', async ({ page }) => {
  await page.keyboard.type('cat');
  await expect(cat(page)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
