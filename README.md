# qiyi-site

Personal academic website of Qiyi (Lucas) Xie, built with [Astro](https://astro.build) and
deployed to GitHub Pages. All content lives in `src/data/` and `src/content/`; the page templates
hold no facts, and the schemas in `src/schemas.ts` fail the build when a field is wrong.

## Local development

Node 24 is expected (`.nvmrc`; `package.json` requires 22.22 or newer).

```sh
npm ci            # install exactly what package-lock.json pins
npm run dev       # dev server with hot reload
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Checks

| Command                             | What it does                                       |
| ----------------------------------- | -------------------------------------------------- |
| `npm run check:private`             | Scans committed files for private data (see below) |
| `npm test`                          | Unit tests (Vitest)                                |
| `npm run build && npm run test:e2e` | Browser tests (Playwright), run against the build  |
| `npm run check`                     | Type and content check (`astro check`)             |
| `npm run format:check`              | Prettier formatting (`npm run format` fixes it)    |

CI runs `check:private`, `test` and `check` before every deploy. The end-to-end tests are not run
in CI yet, so run them locally before pushing.

## Updating the site

- **Add a publication**: add an entry to `src/data/publications.yaml`. Put its teaser image under
  `src/assets/pubs/` and point the entry's `teaser` field at it, for example
  `src/assets/pubs/prin.png`.
- **Change a publication's status**: edit `status` and `note` on its entry.
- **Add news**: add a line to `src/data/news.yaml`. The home page shows the five most recent.
- **Add a project**: create `src/content/projects/<slug>.mdx`. Frontmatter is validated by the
  schema in `src/schemas.ts`.
- **Replace the CV**: overwrite `public/cv.pdf`, check it by hand, put its new sha256 in
  `scripts/reviewed-pdfs.txt`, and update `src/data/cv.yaml` to match.
- **Easter-egg copy**: edit `src/data/eggs.ts` (see Easter eggs below).

Images go under `src/assets/`; Astro converts them to WebP at build time.

## Easter eggs

The site hides six small surprises. Each lights a footer star; the stars open the achievements
dialog, and `/misc/` lists them too.

- Console: `help()` in the browser console prints a hint.
- Not-found page: a black hole swallows the page.
- Terminal: the backtick key opens a small fake shell.
- Cat: typing `cat` summons a pixel cat.
- Chirp: clicking the empty nav area plays the waveform as a gravitational-wave chirp.
- Enhance: hovering the dark figure on `/projects/prin/` brightens it.

All copy lives in `src/data/eggs.ts`. The logic lives in `src/lib/eggs/` and in the components
`Terminal`, `BlackHole`, `EnhanceFigure`, `Achievements` and `AchievementsPanel` under
`src/components/` (each `.astro`).

The browser keeps two `localStorage` keys: `qx.theme` (the theme choice) and `qx.achievements` (a
JSON list of unlocked eggs). To reset the stars, run `localStorage.removeItem('qx.achievements')`
in the console and reload.

`public/oneko/` is vendored from adryd325/oneko.js (MIT), pinned to commit
`5281d057c4ea9bd4f6f997ee96ba30491aed16c0`. Leave it unedited; Prettier and the type check skip it.

## Before the first publish

- [ ] Set `GITHUB_USERNAME` in `src/site.config.ts` and the `Sitemap:` line in `public/robots.txt`.
      CI refuses to deploy while the placeholder is in the config.
- [ ] Add `src/assets/headshot.jpg` and set `headshot: 'src/assets/headshot.jpg'` in
      `src/data/profile.yaml`.
- [ ] Add a sanitised `public/cv.pdf` (no phone, address or grades) and put its sha256 in
      `scripts/reviewed-pdfs.txt`.
- [ ] Add publication teasers (`teaser` in `publications.yaml`) and project covers (`cover` in the
      project frontmatter).
- [ ] Replace the placeholder pair in `src/assets/projects/prin/` with real PRIN input and output,
      then set `label` and `alt` under `enhanceDemo` in `prin.mdx`.
- [ ] Settle the open content questions: author lists, consent from supervisors and collaborators,
      the MIT LIGO wording, and M.S. vs M.S.E.
- [ ] In the GitHub repository, set Settings → Pages → Source to **GitHub Actions**.
- [ ] Run `npx simple-git-hooks` once to install the pre-push privacy check.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: it runs the checks, builds the site with
`withastro/action`, and publishes it with `actions/deploy-pages`. A pull request or a failed check
never deploys. The workflow can also be started by hand from the Actions tab.

One-time setup:

1. Set `GITHUB_USERNAME` in `src/site.config.ts`. It defines the site address,
   `https://<username>.github.io`, and feeds the canonical URLs and the sitemap.
2. Replace the same placeholder in the `Sitemap:` line of `public/robots.txt`.
3. Create a repository named `<username>.github.io` on GitHub and push `main`. The site is served
   from the root path, so the repository name must match.
4. In the repository, open Settings, then Pages, and set Source to **GitHub Actions**.

## Privacy

Never commit phone numbers, street addresses, grade point average figures, or manuscript IDs.
`scripts/check-private.mjs` looks for these, and it also refuses any committed PDF whose sha256 is
not listed in `scripts/reviewed-pdfs.txt`. It runs in two places: a pre-push git hook and the CI
workflow. A hit blocks the push or fails the deploy. After cloning, run `npx simple-git-hooks`
once to install the hook.
