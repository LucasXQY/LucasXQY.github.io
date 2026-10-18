import { expect, test } from '@playwright/test';

test('the home page carries Person JSON-LD that parses', async ({ page }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(raw ?? '');
  expect(data['@context']).toBe('https://schema.org');
  expect(data['@type']).toBe('Person');
  expect(data.name).toBe('Qiyi (Lucas) Xie');
  expect(data.affiliation).toMatchObject({ '@type': 'Organization' });
  expect(data.sameAs.length).toBeGreaterThan(0);
});

test('an unknown path serves the 404 page', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.locator('body')).toContainText('collapsed into a black hole');
  await expect(page.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('the home page has a canonical link and an absolute og:image', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toMatch(/^https:\/\/.+\/$/);

  const ogImage = page.locator('meta[property="og:image"]');
  await expect(ogImage).toHaveCount(1);
  const content = await ogImage.getAttribute('content');
  expect(content).toMatch(/^https:\/\/.+\/og\.png$/);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
});

test('the sitemap index is served and the sitemap leaves out /misc/unlocked/', async ({
  request,
}) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain('sitemap-0.xml');

  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.status()).toBe(200);
  const body = await sitemap.text();
  expect(body).toContain('/publications/');
  expect(body).not.toContain('/misc/unlocked/');
});

test('robots.txt points at the sitemap and the favicon and og image are served', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('sitemap-index.xml');
  expect((await request.get('/favicon.svg')).status()).toBe(200);
  const og = await request.get('/og.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toBe('image/png');
});
