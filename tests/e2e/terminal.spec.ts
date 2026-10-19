import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TERMINAL } from '../../src/data/eggs';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Terminal' });
const input = (page: Page) => page.getByLabel('Command');
const output = (page: Page) => page.locator('.term-out');
const stored = async (page: Page): Promise<string[]> =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('qx.achievements'))) ?? '[]');

/** The element holding focus, described well enough to tell the cases apart. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el === document.body ? 'body' : `${el?.tagName.toLowerCase()}.${el?.className}`;
  });
const focusInsideDialog = (page: Page) =>
  page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));

async function run(page: Page, command: string) {
  await input(page).fill(command);
  await page.keyboard.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the terminal is hidden until opened and is a named modal dialog', async ({ page }) => {
  const raw = page.locator('.terminal');
  await expect(raw).toHaveAttribute('role', 'dialog');
  await expect(raw).toHaveAttribute('aria-modal', 'true');
  await expect(raw).toHaveAttribute('aria-label', 'Terminal');
  await expect(raw).toBeHidden();
  await expect(dialog(page)).toHaveCount(0); // hidden also removes it from the accessibility tree
});

test('the backtick key opens the terminal with the input focused and empty', async ({ page }) => {
  await page.keyboard.press('`');

  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveValue(''); // the key opened it; it was not typed into the input
  for (const line of TERMINAL.banner) await expect(output(page)).toContainText(line);
});

test('the banner is printed once per open, not once per page', async ({ page }) => {
  await page.keyboard.press('`');
  await page.keyboard.press('Escape');
  await page.keyboard.press('`');

  await expect(dialog(page)).toBeVisible();
  const text = (await output(page).textContent()) ?? '';
  expect(text.split(TERMINAL.banner[0]!).length - 1).toBe(1);
});

test('ls lists the pages, echoes the command, and lights the terminal star', async ({ page }) => {
  await page.keyboard.press('`');
  expect(await stored(page)).toEqual([]);

  await run(page, 'ls');

  await expect(output(page)).toContainText('$ ls');
  await expect(output(page)).toContainText('publications');
  expect(await stored(page)).toContain('terminal');
  await expect(page.locator('footer .star[data-id="terminal"]')).toHaveClass(/lit/);
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
});

test('an unknown command reports itself and does not light the star; a known one does', async ({
  page,
}) => {
  await page.keyboard.press('`');

  await run(page, 'foo');
  await expect(output(page)).toContainText(TERMINAL.notFound('foo'));
  expect(await stored(page)).toEqual([]);

  await run(page, '');
  expect(await stored(page)).toEqual([]);

  await run(page, 'sudo rm -rf /');
  await expect(output(page)).toContainText(TERMINAL.sudo[0]!);
  expect(await stored(page)).toEqual(['terminal']);
});

test('unlocking happens once however many commands run', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'help');
  await run(page, 'ls');
  await run(page, 'whoami');
  expect(await stored(page)).toEqual(['terminal']);
});

test('typed markup is shown as text and never becomes an element', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.keyboard.press('`');

  await run(page, '<b>x</b>');
  await run(page, '<img src=x onerror=window.__pwned=1>');
  await run(page, 'cd <i>no</i>');

  // The echo line and the command-not-found line both carry the raw text.
  await expect(output(page)).toContainText('$ <b>x</b>');
  await expect(output(page)).toContainText(TERMINAL.notFound('<b>x</b>'));
  await expect(output(page)).toContainText('$ <img src=x onerror=window.__pwned=1>');
  await expect(output(page)).toContainText('cd: no such page: <i>no</i>');
  await expect(output(page).locator('b, i, img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBe(
    undefined,
  );
  expect(errors).toEqual([]);
});

test('Escape hides the terminal and gives focus back to where it was', async ({ page }) => {
  await page.locator('a.brand').focus();
  await page.keyboard.press('`');
  await expect(dialog(page)).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.locator('.terminal')).toBeHidden();
  expect(await focused(page)).toMatch(/^a\./);
  await expect(page.locator('a.brand')).toBeFocused();
});

test('Escape works from the output area as well as the input', async ({ page }) => {
  await page.keyboard.press('`');
  await output(page).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.terminal')).toBeHidden();
});

test('exit closes the terminal and returns focus to the previously focused element', async ({
  page,
}) => {
  await page.locator('a.brand').focus();
  await page.keyboard.press('`');
  await run(page, 'exit');

  await expect(page.locator('.terminal')).toBeHidden();
  await expect(page.locator('a.brand')).toBeFocused();
  expect(await stored(page)).toEqual(['terminal']); // exit counts as a command
});

test('with nothing focused before it, closing leaves focus on the page body', async ({ page }) => {
  await page.keyboard.press('`');
  await page.keyboard.press('Escape');
  expect(await focused(page)).toBe('body');
});

test('the backtick does not open the terminal while typing in a field', async ({ page }) => {
  await page.evaluate(() => {
    const field = document.createElement('input');
    field.id = 'probe-input';
    document.body.append(field);
    const area = document.createElement('textarea');
    area.id = 'probe-area';
    document.body.append(area);
    const editable = document.createElement('div');
    editable.id = 'probe-editable';
    editable.contentEditable = 'true';
    document.body.append(editable);
  });

  for (const id of ['probe-input', 'probe-area', 'probe-editable']) {
    await page.locator(`#${id}`).focus();
    await page.keyboard.press('`');
    await expect(page.locator('.terminal'), id).toBeHidden();
  }
  // The backtick was typed into the field instead.
  await expect(page.locator('#probe-input')).toHaveValue('`');
});

test('the backtick with ctrl, alt or meta held does not open the terminal', async ({ page }) => {
  for (const modifier of ['Control', 'Alt', 'Meta']) {
    await page.keyboard.press(`${modifier}+\``);
    await expect(page.locator('.terminal'), modifier).toBeHidden();
  }
});

test('Tab and Shift+Tab keep focus inside the dialog', async ({ page }) => {
  await page.keyboard.press('`');

  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab');
    expect(await focusInsideDialog(page), `Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusInsideDialog(page), `Shift+Tab ${i + 1}`).toBe(true);
  }
});

test('Tab pulls focus back in when it was outside the dialog', async ({ page }) => {
  await page.keyboard.press('`');
  await page.locator('a.brand').focus(); // e.g. after a mouse click on the page behind
  await page.keyboard.press('Tab');
  expect(await focusInsideDialog(page)).toBe(true);
});

test('the output area can be reached by keyboard so it can be scrolled', async ({ page }) => {
  await page.keyboard.press('`');
  await page.keyboard.press('Shift+Tab');
  await expect(output(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
});

test('the arrow keys step through the command history', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'ls');
  await run(page, 'whoami');

  await page.keyboard.press('ArrowUp');
  await expect(input(page)).toHaveValue('whoami');
  await page.keyboard.press('ArrowUp');
  await expect(input(page)).toHaveValue('ls');
  await page.keyboard.press('ArrowUp');
  await expect(input(page)).toHaveValue('ls');
  await page.keyboard.press('ArrowDown');
  await expect(input(page)).toHaveValue('whoami');
  await page.keyboard.press('ArrowDown');
  await expect(input(page)).toHaveValue('');
});

test('clear empties the output', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'ls');
  await expect(output(page)).toContainText('publications');

  await run(page, 'clear');

  await expect(output(page)).toHaveText('');
  await expect(dialog(page)).toBeVisible();
});

test('theme light and theme dark switch the page theme', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'theme light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(output(page)).toContainText('theme: light');
  await run(page, 'theme dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('cd cv is refused while the CV page is hidden', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'cd cv');
  await expect(output(page)).toContainText('cd: no such page: cv');
  await expect(page).toHaveURL(/\/$/);
});

test('cd about goes home', async ({ page }) => {
  await page.goto('/projects/');
  await page.keyboard.press('`');
  await run(page, 'cd about');
  await expect(page).toHaveURL(/\/$/);
  await expect(page).not.toHaveURL(/\/projects\//);
});

test('open <paper-id> jumps to that paper on the publications page', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'open prin');
  await expect(page).toHaveURL(/\/publications\/#prin$/);
  await expect(page.locator('#prin')).toBeInViewport();
});

test('open alone lists the papers, and an unknown id is refused', async ({ page }) => {
  await page.keyboard.press('`');
  await run(page, 'open');
  await expect(output(page)).toContainText('prin');
  await run(page, 'open nope');
  await expect(output(page)).toContainText('open: unknown paper id: nope');
  await expect(page).toHaveURL(/\/$/);
});

test('window.qxOpenTerminal opens the terminal, and a second call keeps it open', async ({
  page,
}) => {
  await page.evaluate(() => (window as unknown as { qxOpenTerminal: () => void }).qxOpenTerminal());
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await page.evaluate(() => (window as unknown as { qxOpenTerminal: () => void }).qxOpenTerminal());
  await expect(dialog(page)).toBeVisible();
});

test('the terminal sits at the bottom of the viewport and no taller than 40% of it', async ({
  page,
}) => {
  await page.keyboard.press('`');
  for (let i = 0; i < 40; i += 1) await run(page, 'help'); // far more output than fits

  const viewport = page.viewportSize()!;
  const box = (await page.locator('.terminal').boundingBox())!;
  expect(box.y + box.height).toBeCloseTo(viewport.height, 0);
  expect(box.height).toBeLessThanOrEqual(viewport.height * 0.4 + 1);
  // The newest line is in view: the output follows the latest command.
  await expect(output(page).locator('div').last()).toBeInViewport();
});

test('print media hides an open terminal', async ({ page }) => {
  await page.keyboard.press('`');
  await expect(dialog(page)).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.terminal')).toBeHidden();
});

for (const theme of ['dark', 'light']) {
  for (const width of [1280, 390]) {
    test(`the open terminal, with output, has no serious axe violations at ${width}px in the ${theme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('qx.theme', value), theme);
      await page.goto('/');
      await page.keyboard.press('`');
      await run(page, 'help');
      await run(page, 'foo');
      await expect(dialog(page)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      const report = blocking.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .map((node) => node.target.join(' '))
            .join(' | ')}`,
      );
      expect(report, report.join('\n')).toEqual([]);
    });
  }
}
