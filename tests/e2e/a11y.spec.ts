import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { name: 'home', path: '/' },
  { name: 'publications', path: '/publications/' },
  { name: 'projects', path: '/projects/' },
  { name: 'project detail', path: '/projects/prin/' },
  { name: 'cv', path: '/cv/' },
  { name: 'misc', path: '/misc/' },
  { name: 'unlocked', path: '/misc/unlocked/' },
  { name: '404', path: '/not-a-page' },
];
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const themes = ['dark', 'light'];

for (const { name, path } of pages) {
  for (const viewport of viewports) {
    for (const theme of themes) {
      test(`${name} has no serious or critical axe violations at ${viewport.name} in the ${theme} theme`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.addInitScript((value) => localStorage.setItem('qx.theme', value), theme);
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

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
}
