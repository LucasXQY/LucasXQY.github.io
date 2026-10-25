import { expect, test } from '@playwright/test';

test('the index lists ten project cards, the four featured ones first', async ({ page }) => {
  await page.goto('/projects/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');

  const cards = page.getByTestId('project-card');
  await expect(cards).toHaveCount(10);
  // Featured first, newest first within each group.
  const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual([
    '/projects/drone-swarm-defense/',
    '/projects/gw-yolo/',
    '/projects/vetonet/',
    '/projects/prin/',
    '/projects/image2gps/',
    '/projects/ssm-llie/',
    '/projects/laser-cooling-control/',
    '/projects/microgrid-digital-twin/',
    '/projects/maze-solving-robot/',
    '/projects/fpga-pwm-controller/',
  ]);
});

test('a card link is named after the project title and the whole card is its hit area', async ({
  page,
}) => {
  await page.goto('/projects/');
  const link = page.getByRole('link', { name: /^PRIN/ });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('data-testid', 'project-card');

  const card = page.locator('article', { has: link });
  const title = card.getByRole('heading', { level: 2 });
  await expect(title).toContainText('PRIN');
  // The name is the title alone, not the summary and tags as well.
  await expect(link).toHaveAccessibleName(await title.innerText());
  await expect(card.locator('.tag')).toHaveText(['low-light', 'retinex']);

  // Clicking the summary, not just the title, follows the link. The link's overlay sits on top of
  // the summary, so the click needs force to get past Playwright's "intercepts pointer events"
  // check; the pointer itself still lands on the overlay.
  await card.locator('.summary').click({ force: true });
  await expect(page).toHaveURL(/\/projects\/prin\/$/);
});

test('the PRIN page has the breadcrumb, title, status, tags and the TL;DR side panel', async ({
  page,
}) => {
  await page.goto('/projects/prin/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PRIN');

  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumb).toContainText('projects / prin');

  await expect(page.getByTestId('project-status')).toHaveText('ongoing');
  await expect(page.getByTestId('project-meta').locator('.tag')).toHaveText([
    'low-light',
    'retinex',
  ]);

  const aside = page.getByTestId('project-aside');
  await expect(aside.getByRole('heading', { level: 2 })).toHaveText('TL;DR');
  await expect(aside).toContainText('Information Sciences');
  await expect(aside).toContainText('under review · second round');
  // The owner is bold in the author list taken from the linked publication.
  await expect(aside.locator('strong')).toHaveText('Qiyi Xie');
});

test('a project without links has no link buttons, and an empty venue leaves no venue row', async ({
  page,
}) => {
  await page.goto('/projects/gw-yolo/');
  await expect(page.getByTestId('project-meta').getByRole('link')).toHaveCount(0);
  const aside = page.getByTestId('project-aside');
  await expect(aside).toContainText('authors');
  await expect(aside).toContainText('in preparation');
  await expect(aside).not.toContainText('venue');
  await expect(aside).not.toContainText('code');
});

test('the VetoNet page has a Paper button to arXiv and its aside reads preprint', async ({
  page,
}) => {
  await page.goto('/projects/vetonet/');
  const links = page.getByTestId('project-meta').getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText('Paper');
  await expect(links).toHaveAttribute('href', 'https://arxiv.org/abs/2610.21335');

  const aside = page.getByTestId('project-aside');
  await expect(aside).toContainText('arXiv:2610.21335');
  await expect(aside).toContainText('preprint');
  await expect(aside).not.toContainText('under review');
  const status = aside.locator('.row', { has: page.locator('dt', { hasText: 'status' }) });
  await expect(status.locator('dd')).toHaveText('preprint · journal version in preparation');
});

test('a project with no publication shows just the TL;DR in the side panel', async ({ page }) => {
  await page.goto('/projects/microgrid-digital-twin/');
  await expect(page.getByTestId('project-status')).toHaveText('done');
  const aside = page.getByTestId('project-aside');
  await expect(aside.getByRole('heading', { level: 2 })).toHaveText('TL;DR');
  await expect(aside.locator('dl')).toHaveCount(0);
});

test('every project page keeps a single h1, a main figure and its body inside the prose wrapper', async ({
  page,
}) => {
  for (const id of [
    'prin',
    'vetonet',
    'gw-yolo',
    'microgrid-digital-twin',
    'maze-solving-robot',
    'fpga-pwm-controller',
    'laser-cooling-control',
    'image2gps',
    'ssm-llie',
    'drone-swarm-defense',
  ]) {
    await page.goto(`/projects/${id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const prose = page.locator('.prose');
    await expect(prose.locator('h2').first()).toBeVisible();
    await expect(prose.locator('p').first()).toBeVisible();
    await expect(page.getByTestId('project-figure')).toBeVisible();
  }
});

test('the project pages hold at 390px without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const [path, heading] of [
    ['/projects/', 'Projects'],
    ['/projects/prin/', 'PRIN'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('the cards sit in two columns from 760px and one below', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/projects/');
  const lefts = async () =>
    page
      .getByTestId('project-card')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  expect(new Set(await lefts()).size).toBe(2);

  await page.setViewportSize({ width: 600, height: 800 });
  expect(new Set(await lefts()).size).toBe(1);
});

test('the PRIN page ends with three low / PRIN / ground-truth comparison rows', async ({
  page,
}) => {
  await page.goto('/projects/prin/');
  const rows = page.locator('.prose .triplet-row');
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    await expect(row.locator('img')).toHaveCount(3);
    await expect(row.locator('img').nth(1)).toHaveAttribute('alt', /PRIN output/);
  }
});

test('the SSM page compares input, Base, Prompt-Adapter and ground truth in each row', async ({
  page,
}) => {
  await page.goto('/projects/ssm-llie/');
  const rows = page.locator('.prose .triplet-row');
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    await expect(row.locator('img')).toHaveCount(4);
    await expect(row.locator('img').nth(2)).toHaveAttribute('alt', /Prompt-Adapter output/);
  }
});
