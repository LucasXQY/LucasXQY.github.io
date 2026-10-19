import { expect, test, type Page } from '@playwright/test';

const stored = async (page: Page): Promise<string[]> =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('qx.achievements'))) ?? '[]');

const button = (page: Page) => page.locator('.nav-wave-btn');
const wave = (page: Page) => page.locator('.nav-wave');

/** Describes the link or button topmost at the centre of the `selector` element, e.g. "a /cv/". */
const topmostAtCentreOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const box = document.querySelector(sel)!.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    const el = top?.closest('a, button');
    if (!el) return 'nothing';
    return [el.tagName.toLowerCase(), el.getAttribute('href'), el.className]
      .filter(Boolean)
      .join(' ');
  }, selector);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the waveform is a button with an accessible name', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Play a gravitational-wave chirp' })).toHaveCount(
    1,
  );
  await expect(button(page)).toHaveAttribute('type', 'button');
  await expect(button(page)).toHaveClass(/egg/);
  await expect(wave(page)).toHaveAttribute('aria-hidden', 'true');
});

test('clicking the waveform stores the chirp achievement and lights its star', async ({ page }) => {
  expect(await stored(page)).not.toContain('chirp');

  await button(page).click();

  await expect.poll(() => stored(page)).toContain('chirp');
  await expect(page.locator('footer .star[data-id="chirp"]')).toHaveClass(/lit/);
});

test('a click on the waveform really starts one 0.8 s buffer; the other nav controls start none', async ({
  page,
}) => {
  type Probe = { __qxStarts: number; __qxDuration: number };
  const probe = () =>
    page.evaluate(() => {
      const { __qxStarts, __qxDuration } = window as unknown as Probe;
      return { starts: __qxStarts, duration: __qxDuration };
    });

  // Counts every AudioBufferSourceNode.start() and keeps the length of the buffer it plays. The
  // original still runs, so the real Web Audio path is exercised.
  await page.addInitScript(() => {
    const w = window as unknown as Probe;
    w.__qxStarts = 0;
    w.__qxDuration = 0;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      w.__qxStarts += 1;
      w.__qxDuration = this.buffer?.duration ?? 0;
      return original.apply(this, args);
    };
  });
  await page.goto('/');

  await page.getByTestId('theme-toggle').click(); // a nav control above the button
  await page.waitForTimeout(150);
  expect((await probe()).starts).toBe(0);

  await button(page).click();
  await expect.poll(async () => (await probe()).starts).toBe(1);
  expect((await probe()).duration).toBeCloseTo(0.8, 2);

  await button(page).click(); // the guard ignores a click while it plays
  await page.waitForTimeout(150);
  expect((await probe()).starts).toBe(1);
});

test('clicking twice unlocks once', async ({ page }) => {
  await button(page).click();
  await button(page).click();
  await expect.poll(() => stored(page)).toEqual(['chirp']);
});

test('the sweep runs after a click and then goes away', async ({ page }) => {
  const animation = () =>
    page.locator('.nav-wave-shine').evaluate((el) => getComputedStyle(el).animationName);
  await expect(wave(page)).not.toHaveClass(/sweep/);
  expect(await animation()).toBe('none');

  await button(page).click();
  await expect(wave(page)).toHaveClass(/sweep/);
  expect(await animation()).not.toBe('none');

  await expect(wave(page)).not.toHaveClass(/sweep/);
  expect(await animation()).toBe('none');
});

test('a second click during the sweep does not restart it', async ({ page }) => {
  await page.evaluate(() => {
    const target = document.querySelector('.nav-wave')!;
    const log: boolean[] = [];
    new MutationObserver(() => log.push(target.classList.contains('sweep'))).observe(target, {
      attributes: true,
      attributeFilter: ['class'],
    });
    (window as unknown as { sweepLog: boolean[] }).sweepLog = log;
  });

  await button(page).click();
  await button(page).click();
  await expect(wave(page)).not.toHaveClass(/sweep/);

  const log = await page.evaluate(() => (window as unknown as { sweepLog: boolean[] }).sweepLog);
  expect(log).toEqual([true, false]);
});

test('the button works again once the chirp has finished', async ({ page }) => {
  await button(page).click();
  await expect(wave(page)).toHaveClass(/sweep/);
  await expect(wave(page)).not.toHaveClass(/sweep/);

  // The guard lifts when the sound ends, a moment after the sweep does, so retry the click.
  await expect(async () => {
    await button(page).click();
    await expect(wave(page)).toHaveClass(/sweep/, { timeout: 300 });
  }).toPass({ timeout: 4000 });
});

test('with reduced motion the chirp still unlocks but nothing sweeps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button(page).click();

  await expect.poll(() => stored(page)).toContain('chirp');
  await expect(wave(page)).not.toHaveClass(/sweep/);
  await page.waitForTimeout(150);
  await expect(wave(page)).not.toHaveClass(/sweep/);
});

test('without an AudioContext the chirp still unlocks and sweeps', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
  });
  await page.goto('/');

  await button(page).click();
  await expect(wave(page)).toHaveClass(/sweep/);
  await expect.poll(() => stored(page)).toContain('chirp');
  await expect(wave(page)).not.toHaveClass(/sweep/);
});

test('the brand link is above the button: clicking it still goes home', async ({ page }) => {
  await page.goto('/projects/prin/');
  await page.locator('nav .brand').click();
  await expect(page).toHaveURL('/');
  expect(await stored(page)).not.toContain('chirp');
});

test('the nav links and the theme toggle are above the button too', async ({ page }) => {
  for (const [name, path] of [
    ['Publications', '/publications/'],
    ['Projects', '/projects/'],
    ['About', '/'],
  ] as const) {
    await page.locator('nav .links').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
  }

  const theme = () => page.locator('html').getAttribute('data-theme');
  const before = await theme();
  await page.getByTestId('theme-toggle').click();
  await expect.poll(theme).not.toBe(before);

  expect(await stored(page)).not.toContain('chirp'); // none of those clicks reached the button
});

test('the button gets the clicks on the empty nav area only', async ({ page }) => {
  expect(await topmostAtCentreOf(page, '.brand')).toBe('a / brand');
  expect(await topmostAtCentreOf(page, '.links a[href="/projects/"]')).toBe('a /projects/');
  expect(await topmostAtCentreOf(page, '.theme-toggle')).toBe('button theme-toggle');
  expect(await topmostAtCentreOf(page, 'nav')).toBe('button nav-wave-btn egg');
});

test('on a phone the controls are still above the button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await topmostAtCentreOf(page, '.brand')).toBe('a / brand');
  expect(await topmostAtCentreOf(page, '.links a[href="/"]')).toBe('a /');
  expect(await topmostAtCentreOf(page, '.links a[href="/projects/"]')).toBe('a /projects/');
  expect(await topmostAtCentreOf(page, '.theme-toggle')).toBe('button theme-toggle');
});

test('Tab reaches the button after the other nav controls, with a focus ring inside the nav', async ({
  page,
}) => {
  let presses = 0;
  while (presses < 12 && !(await button(page).evaluate((el) => el === document.activeElement))) {
    await page.keyboard.press('Tab');
    presses += 1;
  }
  expect(await button(page).evaluate((el) => el === document.activeElement)).toBe(true);
  expect(presses).toBeGreaterThan(5); // brand, four links and the toggle come first

  const ring = await button(page).evaluate((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const nav = el.closest('nav')!.getBoundingClientRect();
    return {
      focusVisible: el.matches(':focus-visible'),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      offset: parseFloat(style.outlineOffset),
      inside: box.top >= nav.top && box.left >= nav.left && box.right <= nav.right,
    };
  });
  expect(ring.focusVisible).toBe(true);
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(2);
  expect(ring.offset).toBeLessThan(0); // drawn inside the box, so overflow: hidden cannot clip it
  expect(ring.inside).toBe(true);

  await page.keyboard.press('Enter');
  await expect.poll(() => stored(page)).toContain('chirp');
});

test('print media hides the button', async ({ page }) => {
  await expect(button(page)).toBeAttached();
  await page.emulateMedia({ media: 'print' });
  await expect(button(page)).toBeHidden();
});
