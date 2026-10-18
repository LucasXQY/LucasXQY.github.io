import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ACHIEVEMENTS } from '../../src/lib/achievements';
import { STAR_HINTS, UNLOCKED } from '../../src/data/eggs';

const ALL = JSON.stringify(ACHIEVEMENTS);
const setAchievements = (page: Page, ids: string) =>
  page.evaluate((value) => localStorage.setItem('qx.achievements', value), ids);

/** The achievements panel placed in the page body, as opposed to the one inside the footer dialog. */
const inlinePanel = (page: Page) => page.locator('main .ach-panel');
const starsButton = (page: Page) => page.locator('footer .stars-btn');
const achievementsDialog = (page: Page) => page.getByRole('dialog', { name: 'Achievements' });

test('the nav has no Misc link while misc.yaml is empty', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Misc' })).toHaveCount(0);
  await expect(page.locator('nav a[href="/misc/"]')).toHaveCount(0);
});

test('/misc/ is built anyway: an empty note, then the achievements panel with six items', async ({
  page,
}) => {
  await page.goto('/misc/');
  await expect(page.getByRole('heading', { level: 1, name: 'Misc' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Nothing here yet.');
  await expect(page.getByRole('heading', { name: 'Hobbies' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Achievements' })).toBeVisible();

  await expect(inlinePanel(page).locator('ol > li')).toHaveCount(6);
  for (const hint of Object.values(STAR_HINTS)) {
    await expect(inlinePanel(page)).toContainText(hint);
  }
  await expect(inlinePanel(page)).toContainText('0 of 6');
  await expect(inlinePanel(page).locator('li.lit')).toHaveCount(0);
  await expect(inlinePanel(page).getByRole('link', { name: /See what you unlocked/ })).toBeHidden();
});

test('/misc/ is noindex while misc.yaml is empty, and its description promises nothing yet', async ({
  page,
}) => {
  await page.goto('/misc/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Hobbies, games and music — coming soon.',
  );
});

test('the panel lights items from storage and shows the unlocked link once all six are found', async ({
  page,
}) => {
  await page.goto('/misc/');
  await setAchievements(page, JSON.stringify(['cat', 'chirp']));
  await page.reload();
  await expect(inlinePanel(page).locator('li.lit')).toHaveCount(2);
  await expect(inlinePanel(page)).toContainText('2 of 6');
  await expect(inlinePanel(page).locator('li[data-id="cat"]')).toHaveClass(/lit/);
  await expect(inlinePanel(page).getByRole('link', { name: /See what you unlocked/ })).toBeHidden();

  await setAchievements(page, ALL);
  await page.reload();
  await expect(inlinePanel(page).locator('li.lit')).toHaveCount(6);
  const link = inlinePanel(page).getByRole('link', { name: 'See what you unlocked →' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/misc/unlocked/');
});

test('/misc/unlocked/ shows only the count until every star is lit, and is noindex', async ({
  page,
}) => {
  await page.goto('/misc/unlocked/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(UNLOCKED.title);
  await expect(page.locator('main')).toContainText('Nothing here yet (0/6)');
  await expect(page.getByRole('button', { name: 'Download certificate' })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(UNLOCKED.bio[0]!);
});

test('the server HTML of /misc/unlocked/ holds none of the unlocked content', async ({
  request,
}) => {
  const html = await (await request.get('/misc/unlocked/')).text();
  expect(html).toContain('Nothing here yet');
  expect(html).not.toContain('Download certificate');
  for (const paragraph of UNLOCKED.bio) expect(html).not.toContain(paragraph);
});

test('the unlocked page shows how many stars are lit', async ({ page }) => {
  await page.goto('/misc/unlocked/');
  await page.evaluate(() => localStorage.setItem('qx.achievements', '["cat","chirp","enhance"]'));
  await page.reload();
  await expect(page.locator('main')).toContainText('Nothing here yet (3/6)');
});

test('with all six stars the unlocked page shows the bio and a certificate that downloads as a PNG', async ({
  page,
}) => {
  await page.goto('/misc/unlocked/');
  await setAchievements(page, ALL);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(UNLOCKED.title);
  await expect(page.getByText('Nothing here yet')).toBeHidden();
  for (const paragraph of UNLOCKED.bio) await expect(page.locator('main')).toContainText(paragraph);

  const button = page.getByRole('button', { name: 'Download certificate' });
  await expect(button).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(download.suggestedFilename()).toBe('certificate-of-curiosity.png');
  expect(download.suggestedFilename().endsWith('.png')).toBe(true);

  // A real PNG, drawn at 1200 x 800: the signature, then the IHDR width and height.
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(800);
});

test('clicking the footer stars opens the achievements dialog; Escape closes it and focus returns', async ({
  page,
}) => {
  await page.goto('/');
  await expect(starsButton(page)).toHaveAttribute(
    'aria-label',
    'Curiosity: 0 of 6 — open the achievements panel',
  );
  await expect(achievementsDialog(page)).toHaveCount(0);

  await starsButton(page).click();
  await expect(achievementsDialog(page)).toBeVisible();
  await expect(achievementsDialog(page).locator('ol > li')).toHaveCount(6);

  await page.keyboard.press('Escape');
  await expect(achievementsDialog(page)).toHaveCount(0);
  await expect(starsButton(page)).toBeFocused();
});

test('the dialog has a close button, and the stars button works from the keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await starsButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(achievementsDialog(page)).toBeVisible();

  await achievementsDialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(achievementsDialog(page)).toHaveCount(0);
  await expect(starsButton(page)).toBeFocused();
});

test('the Summon cat button calls in the cat, and sends it away again', async ({ page }) => {
  await page.goto('/misc/');
  const summon = inlinePanel(page).getByRole('button', { name: 'Summon cat' });
  await expect(summon).toBeEnabled();

  await summon.click();
  await expect(page.locator('#oneko')).toBeVisible();
  await expect(page.locator('footer .star.lit[data-id="cat"]')).toHaveCount(1);

  await summon.click();
  await expect(page.locator('#oneko')).toHaveCount(0);
});

test('under reduced motion the Summon cat button is disabled and says why', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/misc/');
  const summon = inlinePanel(page).getByRole('button', { name: /Summon cat/ });
  await expect(summon).toBeDisabled();
  await expect(summon).toHaveAccessibleName(/disabled because reduced motion is on/);
  await expect(page.locator('#oneko')).toHaveCount(0);
});

test('the Open terminal button opens the terminal, and its × closes it', async ({ page }) => {
  await page.goto('/misc/');
  await inlinePanel(page).getByRole('button', { name: 'Open terminal' }).click();
  const terminal = page.getByRole('dialog', { name: 'Terminal' });
  await expect(terminal).toBeVisible();
  await expect(page.getByLabel('Command')).toBeFocused();

  await terminal.getByRole('button', { name: 'Close terminal' }).click();
  await expect(page.locator('.terminal')).toBeHidden();
  await expect(inlinePanel(page).getByRole('button', { name: 'Open terminal' })).toBeFocused();
});

test('the buttons in the footer dialog get out of the way of what they open', async ({ page }) => {
  await page.goto('/');
  await starsButton(page).click();
  await achievementsDialog(page).getByRole('button', { name: 'Open terminal' }).click();

  await expect(achievementsDialog(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Terminal' })).toBeVisible();
  await expect(page.getByLabel('Command')).toBeFocused();
  await page.keyboard.type('ls'); // the modal dialog's inert backdrop is gone, so typing reaches the input
  await expect(page.getByLabel('Command')).toHaveValue('ls');
});

test('over an open terminal, the stars dialog still gets Escape and Tab', async ({ page }) => {
  await page.goto('/misc/');
  await page.keyboard.press('`');
  const terminal = page.getByRole('dialog', { name: 'Terminal' });
  await expect(terminal).toBeVisible();

  // The drawer sits over the footer, so a mouse cannot reach the stars while it is open; the click
  // is dispatched straight to the button to put the two dialogs on screen together regardless.
  await starsButton(page).dispatchEvent('click');
  await expect(achievementsDialog(page)).toBeVisible();

  // Tab moves between the dialog's own controls (the terminal's trap must not eat it).
  const where = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return { inside: !!el?.closest('.ach-dialog'), name: el?.textContent?.trim() ?? '' };
    });
  const first = await where();
  expect(first.inside).toBe(true);
  await page.keyboard.press('Tab');
  const second = await where();
  expect(second.inside).toBe(true);
  expect(second.name).not.toBe(first.name);

  // One Escape closes the dialog, and only the dialog.
  await page.keyboard.press('Escape');
  await expect(achievementsDialog(page)).toHaveCount(0);
  await expect(terminal).toBeVisible();

  // With the dialog gone, Escape is the terminal's again.
  await page.keyboard.press('Escape');
  await expect(page.locator('.terminal')).toBeHidden();
});

const SERIOUS = ['serious', 'critical'];
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => SERIOUS.includes(violation.impact ?? ''))
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    );
}

for (const theme of ['dark', 'light']) {
  for (const width of [1280, 390]) {
    test(`the open footer dialog has no serious axe violations at ${width}px in the ${theme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(
        ([value, ids]) => {
          localStorage.setItem('qx.theme', value!);
          localStorage.setItem('qx.achievements', ids!); // some lit, some not
        },
        [theme, JSON.stringify(['cat', 'chirp'])],
      );
      await page.goto('/');
      await starsButton(page).click();
      await expect(achievementsDialog(page)).toBeVisible();
      await expect(achievementsDialog(page).locator('li.lit')).toHaveCount(2);

      const report = await seriousViolations(page);
      expect(report, report.join('\n')).toEqual([]);
    });

    test(`the completed /misc/unlocked/ has no serious axe violations at ${width}px in the ${theme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(
        ([value, ids]) => {
          localStorage.setItem('qx.theme', value!);
          localStorage.setItem('qx.achievements', ids!);
        },
        [theme, ALL],
      );
      await page.goto('/misc/unlocked/');
      await expect(page.getByRole('button', { name: 'Download certificate' })).toBeVisible();

      const report = await seriousViolations(page);
      expect(report, report.join('\n')).toEqual([]);
    });
  }
}
