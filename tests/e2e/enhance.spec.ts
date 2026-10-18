import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ENHANCE_LABEL } from '../../src/data/eggs';

// prin.mdx pairs a LOL-v2 Real input with the PRIN output and names them in the caption.
const LABEL = 'LOL-v2 Real · PRIN output';

const stored = async (page: Page): Promise<string[]> =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('qx.achievements'))) ?? '[]');

const figure = (page: Page) => page.locator('.enhance');
const toggle = (page: Page) => page.locator('.enhance-toggle');
const bright = (page: Page) => page.locator('.enhance .bright');
const dark = (page: Page) => page.locator('.enhance .dark');
const hint = (page: Page) => page.locator('.enhance .hint');
const tag = (page: Page) => page.locator('.enhance .tag');

test.describe('on the PRIN project page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/prin/');
  });

  test('the main figure is one enhance egg, off by default, in the project-figure slot', async ({
    page,
  }) => {
    await expect(figure(page)).toHaveCount(1);
    await expect(figure(page)).toHaveClass(/egg/);
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
    await expect(page.getByTestId('project-figure')).toHaveClass(/enhance/);
    await expect(page.getByTestId('project-figure')).toBeVisible();
    await expect(hint(page)).toHaveText('hover to enhance');
  });

  test('hovering adds .is-enhanced, stores the achievement and lights its star', async ({
    page,
  }) => {
    expect(await stored(page)).not.toContain('enhance');

    await figure(page).hover();

    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await expect.poll(() => stored(page)).toContain('enhance');
    await expect(page.locator('footer .star[data-id="enhance"]')).toHaveClass(/lit/);

    // The brightening is only a preview: moving away takes it back, the achievement stays.
    await page.mouse.move(0, 0);
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
    expect(await stored(page)).toContain('enhance');
  });

  test('hovering again does not unlock a second time', async ({ page }) => {
    await figure(page).hover();
    await page.mouse.move(0, 0);
    await figure(page).hover();
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    expect(await stored(page)).toEqual(['enhance']);
  });

  test('a click pins the enhanced state, a second click lets go of it', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Show the enhanced image' });
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(figure(page)).toHaveClass(/is-enhanced/);

    // Pinned: it stays enhanced after the pointer leaves.
    await page.mouse.move(0, 0);
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    // Unpinned: it follows the pointer again, so it is dark once the pointer is away.
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(0, 0);
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
  });

  test('a click shows its effect in the hint: pinned while held, hover to enhance once released', async ({
    page,
  }) => {
    await expect(hint(page)).toHaveText('hover to enhance');

    // Hovering is a preview and hides the hint.
    await figure(page).hover();
    await expect(hint(page)).toHaveCSS('opacity', '0');

    // The click answers on screen even though hover had already brightened the image.
    await toggle(page).click();
    await expect(hint(page)).toHaveText('pinned · click to release');
    await expect(hint(page)).toHaveCSS('opacity', '1');
    await expect(figure(page)).toHaveClass(/is-pinned/);

    // It keeps saying so after the pointer leaves.
    await page.mouse.move(0, 0);
    await expect(hint(page)).toHaveText('pinned · click to release');
    await expect(hint(page)).toHaveCSS('opacity', '1');

    // Releasing reverts the text; with the pointer over the figure it is a hidden preview again.
    await toggle(page).click();
    await expect(hint(page)).toHaveText('hover to enhance');
    await expect(figure(page)).not.toHaveClass(/is-pinned/);
    await expect(hint(page)).toHaveCSS('opacity', '0');
    await page.mouse.move(0, 0);
    await expect(hint(page)).toHaveText('hover to enhance');
    await expect(hint(page)).toHaveCSS('opacity', '1');
  });

  test('the hint follows the keyboard pin as well', async ({ page }) => {
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(hint(page)).toHaveText('pinned · click to release');
    await expect(hint(page)).toHaveCSS('opacity', '1');
    await page.keyboard.press('Enter');
    await expect(hint(page)).toHaveText('hover to enhance');
  });

  test('Enter and Space on the focused button toggle it', async ({ page }) => {
    await toggle(page).focus();

    await page.keyboard.press('Enter');
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => stored(page)).toContain('enhance');

    await page.keyboard.press('Enter');
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Space');
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('the focus ring is drawn inside the figure, where overflow cannot clip it', async ({
    page,
  }) => {
    await toggle(page).focus();
    await expect(toggle(page)).toBeFocused();
    const { style, offset } = await toggle(page).evaluate((el) => {
      const css = getComputedStyle(el);
      return { style: css.outlineStyle, offset: parseFloat(css.outlineOffset) };
    });
    expect(style).toBe('solid');
    expect(offset).toBeLessThan(0);
  });

  test('the caption appears only once enhanced and reads ENHANCE_LABEL(label)', async ({
    page,
  }) => {
    await expect(tag(page)).toHaveCSS('opacity', '0');
    await expect(hint(page)).toHaveCSS('opacity', '1');

    await figure(page).hover();

    await expect(tag(page)).toHaveText(ENHANCE_LABEL(LABEL));
    await expect(tag(page)).toHaveCSS('opacity', '1');
    await expect(hint(page)).toHaveCSS('opacity', '0');
  });

  test('the hint and the caption are decorative and hidden from assistive technology', async ({
    page,
  }) => {
    await expect(hint(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(tag(page)).toHaveAttribute('aria-hidden', 'true');
  });

  test('two stacked images fill one box; exactly one of them carries the alt text', async ({
    page,
  }) => {
    await expect(bright(page)).toHaveAttribute('src', /^\/_astro\/demo-ours\./);
    await expect(dark(page)).toHaveAttribute('src', /^\/_astro\/demo-low\./);
    await expect(dark(page)).toHaveAttribute('alt', /toy castle/);
    await expect(bright(page)).toHaveAttribute('alt', '');

    // Both files were served and decode at their real size.
    for (const image of [dark(page), bright(page)]) {
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
        .toBe(600); // the LOL-v2 Real frames are 600 px wide
    }

    const [darkBox, brightBox] = await Promise.all([
      dark(page).boundingBox(),
      bright(page).boundingBox(),
    ]);
    expect(brightBox).toEqual(darkBox);
    expect(Math.abs(darkBox!.width / darkBox!.height - 16 / 9)).toBeLessThan(0.01);
  });

  test('enhancing does not move or resize anything on the page', async ({ page }) => {
    const layout = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.enhance, .enhance img, .side, .prose')].map((el) => {
          const box = el.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height].map(Math.round);
        }),
      );
    const before = await layout();
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    expect(await layout()).toEqual(before);
  });

  test('the dark layer shows a near-black image and the bright layer opens up the scene', async ({
    page,
  }) => {
    // Average the colour of each file as the browser draws it; the bright scene is far lighter.
    const meanLuma = (selector: string) =>
      page.evaluate(async (sel) => {
        const img = document.querySelector<HTMLImageElement>(sel)!;
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 36;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 64, 36);
        const { data } = ctx.getImageData(0, 0, 64, 36);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
        }
        return sum / (data.length / 4) / 255;
      }, selector);

    expect(await meanLuma('.enhance .dark')).toBeLessThan(0.05);
    expect(await meanLuma('.enhance .bright')).toBeGreaterThan(0.12);
  });

  test('the bright layer fades over one second', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(bright(page)).toHaveCSS('transition-duration', '1s');
    await expect(bright(page)).toHaveCSS('transition-property', 'opacity');
  });

  test('under reduced motion the bright layer switches instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bright(page)).toHaveCSS('transition-duration', '0s');

    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(bright(page)).toHaveCSS('opacity', '1');
  });

  test('print media hides the figure', async ({ page }) => {
    await expect(figure(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(figure(page)).toBeHidden();
  });

  for (const theme of ['dark', 'light']) {
    test(`the enhanced state has no serious axe violations in the ${theme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate((value) => localStorage.setItem('qx.theme', value), theme);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await toggle(page).focus();
      await page.keyboard.press('Enter');
      await expect(tag(page)).toHaveCSS('opacity', '1');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(blocking.map((violation) => violation.id)).toEqual([]);
    });
  }
});

test.describe('on a touch device', () => {
  test.use({ hasTouch: true });

  test('a finger or pen never hovers, and a tap toggles the enhanced state', async ({ page }) => {
    await page.goto('/projects/prin/');

    // A tap makes the browser send pointerenter for the touch pointer; it must not enhance.
    for (const pointerType of ['touch', 'pen']) {
      await figure(page).dispatchEvent('pointerenter', { pointerType });
      await expect(figure(page)).not.toHaveClass(/is-enhanced/);
    }

    await toggle(page).tap();
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(hint(page)).toHaveText('pinned · click to release');
    await expect.poll(() => stored(page)).toContain('enhance');

    // The pointerleave that follows a tap elsewhere must not undo the pin either.
    await figure(page).dispatchEvent('pointerleave', { pointerType: 'touch' });
    await expect(figure(page)).toHaveClass(/is-enhanced/);

    await toggle(page).tap();
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(hint(page)).toHaveText('hover to enhance');
  });

  test('a mouse still hovers on a device that also has a touch screen', async ({ page }) => {
    await page.goto('/projects/prin/');
    await figure(page).dispatchEvent('pointerenter', { pointerType: 'mouse' });
    await expect(figure(page)).toHaveClass(/is-enhanced/);
    await figure(page).dispatchEvent('pointerleave', { pointerType: 'mouse' });
    await expect(figure(page)).not.toHaveClass(/is-enhanced/);
  });
});

test('a project without an enhance demo keeps its plain figure', async ({ page }) => {
  await page.goto('/projects/gw-yolo/');
  await expect(page.locator('.enhance')).toHaveCount(0);
  await expect(page.getByTestId('project-figure')).toBeVisible();
  await expect(page.getByTestId('project-figure').locator('img')).toHaveAttribute(
    'src',
    /^\/_astro\/cover\./,
  );
});

test('the other project pages have no enhance figure either', async ({ page }) => {
  for (const id of ['vetonet', 'microgrid-digital-twin']) {
    await page.goto(`/projects/${id}/`);
    await expect(page.locator('.enhance')).toHaveCount(0);
  }
});

test('a project with a cover shows the report figure instead of the placeholder', async ({
  page,
}) => {
  await page.goto('/projects/microgrid-digital-twin/');
  const img = page.getByTestId('project-figure').locator('img');
  await expect(img).toHaveAttribute('src', /^\/_astro\//);
  await expect(img).toHaveAttribute('alt', /Microgrid Digital Twin/);
});
