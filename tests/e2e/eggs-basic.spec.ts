import { expect, test, type Page } from '@playwright/test';
import { CONSOLE_ART, CONSOLE_HINT, HELP_OUTPUT } from '../../src/data/eggs';

const stored = (page: Page) => page.evaluate(() => localStorage.getItem('qx.achievements'));

test('the console shows the chirp art and the hint once on load', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  await page.goto('/');

  await expect.poll(() => messages.filter((text) => text.includes(CONSOLE_HINT)).length).toBe(1);
  await expect.poll(() => messages.filter((text) => text.includes(CONSOLE_ART)).length).toBe(1);
});

test('help() in the console prints the hint lines and lights the console star', async ({
  page,
}) => {
  const messages: string[] = [];
  await page.goto('/');
  await expect(page.locator('footer .star.lit')).toHaveCount(0);
  page.on('console', (message) => messages.push(message.text()));

  await page.evaluate(() => (window as unknown as { help: () => void }).help());

  await expect.poll(() => messages).toEqual(HELP_OUTPUT);
  expect(await stored(page)).toContain('console');
  await expect(page.locator('footer .star[data-id="console"]')).toHaveClass(/lit/);
  await expect(page.locator('footer .stars')).toHaveAttribute(
    'aria-label',
    'Curiosity: 1 of 6 — open the achievements panel',
  );
});

test('calling help() twice leaves exactly one console entry in storage', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const help = (window as unknown as { help: () => void }).help;
    help();
    help();
  });
  expect(JSON.parse((await stored(page)) ?? '[]')).toEqual(['console']);
});

test('opening a missing page lights the black hole star', async ({ page }) => {
  await page.goto('/not-a-page');
  expect(await stored(page)).toContain('blackhole');
  await expect(page.locator('footer .star[data-id="blackhole"]')).toHaveClass(/lit/);
});

test('the 404 page shows the black hole above one heading and a link home', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.locator('.blackhole svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('This page has collapsed into a black hole.');
  const [hole, heading] = await Promise.all([
    page.locator('.blackhole').boundingBox(),
    page.locator('h1').boundingBox(),
  ]);
  expect(hole!.y + hole!.height).toBeLessThanOrEqual(heading!.y);
});

test('the ring spins normally and stops under reduced motion', async ({ page }) => {
  const animationName = () =>
    page.locator('.blackhole-ring').evaluate((el) => getComputedStyle(el).animationName);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/not-a-page');
  expect(await animationName()).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animationName()).toBe('none');
});

test('print media hides the black hole', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.locator('.blackhole')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.blackhole')).toBeHidden();
});
