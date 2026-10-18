import { expect, test } from '@playwright/test';

test('theme toggle flips data-theme and keeps it after a reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', /^(dark|light)$/);
  const before = await html.getAttribute('data-theme');
  const flipped = before === 'dark' ? 'light' : 'dark';

  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', flipped);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', flipped);
});

test('with nothing stored the first visit is dark whatever the system says, and a stored choice wins', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.addInitScript(() => localStorage.setItem('qx.theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('a blocked localStorage neither throws nor stops the toggle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('print media hides the nav and forces a white page even in the dark theme', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('qx.theme', 'dark'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('nav')).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('nav')).toBeHidden();
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, text: style.color };
  });
  expect(colors.background).toBe('rgb(255, 255, 255)');
  // The light --text-1: only the print token override can turn the dark theme's text this colour.
  expect(colors.text).toBe('rgb(31, 35, 40)');
});

test('the nav marks the current page and has no Misc link while showMisc is false', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('nav a[href="/misc/"]')).toHaveCount(0);
  const current = page.locator('nav a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText('About');
});

test('prose links are underlined while the nav and brand links are not', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document
      .querySelector('main')!
      .insertAdjacentHTML('beforeend', '<p>Read <a id="prose" href="/x">this</a>.</p>');
  });
  const decoration = (selector: string) =>
    page.locator(selector).evaluate((el) => getComputedStyle(el).textDecorationLine);

  expect(await decoration('#prose')).toBe('underline');
  expect(await decoration('.brand')).toBe('none');
  expect(await decoration('.links a[href="/publications/"]')).toBe('none');
});

test('keyboard focus rings on the nav links fit inside the scrolling link list', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab'); // the brand link comes first
  for (const name of ['About', 'Publications', 'Projects', 'CV']) {
    await page.keyboard.press('Tab');
    const room = await page.evaluate(() => {
      const link = document.activeElement as HTMLElement;
      const style = getComputedStyle(link);
      const reach = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      const box = link.getBoundingClientRect();
      const list = link.closest('.links')!.getBoundingClientRect();
      return {
        text: link.textContent?.trim(),
        focusVisible: link.matches(':focus-visible'),
        top: box.top - reach - list.top,
        right: list.right - (box.right + reach),
        bottom: list.bottom - (box.bottom + reach),
        left: box.left - reach - list.left,
      };
    });
    expect(room.text).toBe(name);
    expect(room.focusVisible).toBe(true);
    for (const side of [room.top, room.right, room.bottom, room.left]) {
      expect(side).toBeGreaterThanOrEqual(-0.5);
    }
  }
});
