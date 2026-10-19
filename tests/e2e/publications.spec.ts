import { expect, test } from '@playwright/test';

const ENTRY = '[data-testid="pub-entry"]';
const VISIBLE_ENTRY = `${ENTRY}:visible`;

test.beforeEach(async ({ page }) => {
  await page.goto('/publications/');
});

test('lists all eight publications by default', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Publications');
  await expect(page.locator(ENTRY)).toHaveCount(8);
  await expect(page.locator(VISIBLE_ENTRY)).toHaveCount(8);
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the first-author and selected filters show the matching entries', async ({ page }) => {
  await page.locator('[data-filter="first-author"]').click();
  await expect(page.locator(VISIBLE_ENTRY)).toHaveCount(5);
  await expect(page.locator('[data-filter="first-author"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('[data-filter="selected"]').click();
  await expect(page.locator(VISIBLE_ENTRY)).toHaveCount(3);
  await expect(page.locator('[data-filter="first-author"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.locator('[data-filter="all"]').click();
  await expect(page.locator(VISIBLE_ENTRY)).toHaveCount(8);
});

test('year headings include 2026 and 2024, and a year with no matches is hidden', async ({
  page,
}) => {
  const years = page.getByRole('heading', { level: 2 });
  await expect(years).toHaveText(['2026', '2024']);

  // Neither 2024 paper is selected, so that year has nothing left to show.
  await page.locator('[data-filter="selected"]').click();
  await expect(years).toHaveText(['2026']);
  await page.locator('[data-filter="all"]').click();
  await expect(years).toHaveText(['2026', '2024']);
});

test('a preprint shows its status, links to arXiv and never offers a PDF button', async ({
  page,
}) => {
  const vetonet = page.locator(`${ENTRY}#vetonet`);
  await expect(vetonet).toContainText('preprint');
  await expect(vetonet.getByTestId('status-pill')).toHaveText('preprint');
  await expect(vetonet.getByRole('link', { name: 'arXiv', exact: true })).toHaveAttribute(
    'href',
    'https://arxiv.org/abs/2610.21335',
  );
  await expect(vetonet.getByRole('link', { name: 'PDF' })).toHaveCount(0);
});

test('a preprint reads preprint · journal version in preparation, with the arXiv venue', async ({
  page,
}) => {
  const vetonet = page.locator(`${ENTRY}#vetonet`);
  await expect(vetonet.locator('.venue')).toHaveText('arXiv:2610.21335');
  await expect(vetonet.locator('.venue-line .note')).toHaveText('· journal version in preparation');
  await expect(vetonet.getByRole('link', { name: 'DOI', exact: true })).toHaveAttribute(
    'href',
    'https://doi.org/10.48550/arXiv.2610.21335',
  );
});

test('the VetoNet entry lists every co-author, with the owner first and in bold', async ({
  page,
}) => {
  const vetonet = page.locator(`${ENTRY}#vetonet`);
  await expect(vetonet.locator('strong.self')).toHaveText('Qiyi Xie');
  await expect(vetonet.locator('.authors')).toHaveText(
    'Qiyi Xie, Wei Chen Ng, Suyang Xi, Xicheng Wang, Ziyao Li, Bohong Xu, Wenyi Liu, Jian Ding Tan',
  );
});

test('published papers link their DOI and show no status pill', async ({ page }) => {
  const dois = {
    'jepa-review': 'https://doi.org/10.1016/j.neucom.2026.135279',
    'dt-hrc': 'https://doi.org/10.54097/s322yr33',
    'dt-farming': 'https://doi.org/10.1109/CIITE62244.2024.10987837',
  };
  for (const [id, doi] of Object.entries(dois)) {
    const entry = page.locator(`${ENTRY}#${id}`);
    await expect(entry.getByRole('link', { name: 'DOI', exact: true })).toHaveAttribute(
      'href',
      doi,
    );
    await expect(entry.getByTestId('status-pill')).toHaveCount(0);
  }
  await expect(page.locator(`${ENTRY}#jepa-review .venue`)).toHaveText(
    'Neurocomputing, vol. 708, 135279',
  );
});

test('an under-review paper shows its status and offers no PDF button', async ({ page }) => {
  const prin = page.locator(`${ENTRY}#prin`);
  await expect(prin.getByTestId('status-pill')).toHaveText('under review');
  await expect(prin.getByRole('link', { name: 'PDF' })).toHaveCount(0);
});

test('a status note follows the pill: PRIN reads under review · second round', async ({ page }) => {
  const prin = page.locator(`${ENTRY}#prin`);
  await expect(prin).toContainText('second round');
  await expect(prin.getByTestId('status-pill')).toHaveText('under review');
  await expect(prin.locator('.venue-line .note')).toHaveText('· second round');
  await expect(page.locator(`${ENTRY}#gw-yolo .note`)).toHaveCount(0);
});

test('a published paper has no status pill, an unpublished one does', async ({ page }) => {
  await expect(page.locator(`${ENTRY}#dt-hrc`).getByTestId('status-pill')).toHaveCount(0);
  await expect(page.locator(`${ENTRY}#jepa-review`).getByTestId('status-pill')).toHaveCount(0);
  await expect(page.locator(`${ENTRY}#prin`).getByTestId('status-pill')).toHaveText('under review');
  await expect(page.locator(`${ENTRY}#battery`).getByTestId('status-pill')).toHaveText('accepted');
});

test('the owner is bold, "et al." is plain text, and an empty venue leaves no venue text', async ({
  page,
}) => {
  const gwYolo = page.locator(`${ENTRY}#gw-yolo`);
  await expect(gwYolo.locator('strong.self')).toHaveText('Qiyi Xie');
  await expect(gwYolo.locator('.authors')).toHaveText('Qiyi Xie, et al.');
  await expect(gwYolo.locator('.venue')).toHaveCount(0);

  await expect(page.locator(`${ENTRY}#dt-hrc .venue`)).toContainText('Highlights in Science');
});

test('Copy BibTeX writes the entry to the clipboard and says Copied for a moment', async ({
  page,
}) => {
  // No publication has a bibtex field yet, so build the same markup the component renders.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __copied: string }).__copied = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.reload();
  await page.evaluate(() => {
    document
      .querySelector('#prin')!
      .insertAdjacentHTML(
        'beforeend',
        '<button type="button" id="bib" data-bibtex="@article{prin,\n  year={2026}}">Copy BibTeX</button>',
      );
  });

  const button = page.locator('#bib');
  await button.click();
  await expect(button).toHaveText('Copied');
  expect(await page.evaluate(() => (window as unknown as { __copied: string }).__copied)).toBe(
    '@article{prin,\n  year={2026}}',
  );
  await expect(button).toHaveText('Copy BibTeX');
});

test('a paper under review links its arXiv preprint and keeps its journal venue', async ({
  page,
}) => {
  const ssm = page.locator(`${ENTRY}#mamba-llie`);
  await expect(ssm.locator('.venue')).toHaveText(
    'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  );
  await expect(ssm.getByRole('link', { name: 'arXiv', exact: true })).toHaveAttribute(
    'href',
    'https://arxiv.org/abs/2610.22958',
  );
  await expect(ssm.getByRole('link', { name: 'DOI', exact: true })).toHaveAttribute(
    'href',
    'https://doi.org/10.48550/arXiv.2610.22958',
  );
});
