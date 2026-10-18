import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the heading is the owner name', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qiyi (Lucas) Xie');
});

test('the home page lists all four news items, the newest on top, and the three selected publications', async ({
  page,
}) => {
  const news = page.getByTestId('news-item');
  await expect(news).toHaveCount(4);
  await expect(news.first().getByRole('link')).toHaveAttribute(
    'href',
    'https://arxiv.org/abs/2610.21335',
  );
  await expect(page.getByTestId('pub-entry')).toHaveCount(3);
});

test('the sidebar offers email and the profile links, and no link whose data is missing', async ({
  page,
}) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(page.locator('a[href="mailto:xieqiyi@ieee.org"]')).toHaveCount(1);
  await expect(sidebar.getByText('Google Scholar')).toHaveCount(0);
  await expect(sidebar.getByText('GitHub')).toHaveCount(0);
  await expect(page.getByText('CV (PDF)')).toHaveCount(0);

  for (const name of ['ORCID', 'LinkedIn', 'ResearchGate']) {
    const link = sidebar.getByRole('link', { name });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('rel', 'me noopener');
  }
  await expect(sidebar.getByRole('link', { name: 'ORCID' })).toHaveAttribute(
    'href',
    'https://orcid.org/0009-0006-9506-8359',
  );
});

test('with a headshot the sidebar shows the portrait instead of the initials', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  const portrait = sidebar.getByRole('img', { name: /Portrait of Qiyi/ });
  await expect(portrait).toBeVisible();
  await expect(portrait).toHaveAttribute('src', /headshot.*\.webp$/);
  await expect(sidebar.getByText('QX', { exact: true })).toHaveCount(0);
});

test('the right column runs About, News, Selected Publications and a link to them all', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'About',
    'News',
    'Selected Publications',
  ]);
  await expect(page.getByRole('link', { name: 'See all publications →' })).toHaveAttribute(
    'href',
    '/publications/',
  );
});

test('at 390px the sidebar stacks above the main content without sideways scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sidebar = await page.getByTestId('sidebar').boundingBox();
  const content = await page.getByTestId('home-content').boundingBox();
  expect(sidebar).not.toBeNull();
  expect(content).not.toBeNull();
  expect(sidebar!.y + sidebar!.height).toBeLessThanOrEqual(content!.y);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('at 1100px the sidebar sits beside the main content in a 240px column', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  const sidebar = await page.getByTestId('sidebar').boundingBox();
  const content = await page.getByTestId('home-content').boundingBox();
  expect(sidebar).not.toBeNull();
  expect(content).not.toBeNull();
  expect(sidebar!.width).toBeCloseTo(256, 0);
  expect(content!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
  expect(Math.abs(content!.y - sidebar!.y)).toBeLessThan(2);
});
