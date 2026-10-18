import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  cvSchema,
  miscSchema,
  newsSchema,
  profileSchema,
  publicationSchema,
  type Cv,
  type Misc,
  type News,
  type Profile,
  type Publication,
} from '../schemas';

// This module sits in src/lib/ under Vitest and the dev server, but `astro build` bundles it into
// dist/.prerender/chunks/, so a fixed `../..` from import.meta.url would miss the repo root.
// Walking up to the nearest package.json finds it from either place.
function findRepoRoot(startDir: string): string {
  for (let dir = startDir; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (dirname(dir) === dir) throw new Error(`No package.json found above ${startDir}`);
  }
}

const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

/**
 * Read a YAML file (path relative to the repository root) and validate it against `schema`.
 * Throws an Error naming the file and listing every problem, so a bad data file fails the build.
 */
export function loadYaml<T>(relPath: string, schema: z.ZodType<T>): T {
  const raw = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
  let data: unknown;
  try {
    data = parse(raw);
  } catch (error) {
    throw new Error(`Invalid YAML in ${relPath}: ${(error as Error).message}`, { cause: error });
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid data in ${relPath}:\n${issues}`, { cause: result.error });
  }
  return result.data;
}

export const loadProfile = (): Profile => loadYaml('src/data/profile.yaml', profileSchema);
export const loadPublications = (): Publication[] =>
  loadYaml('src/data/publications.yaml', z.array(publicationSchema));
export const loadNews = (): News => loadYaml('src/data/news.yaml', newsSchema);
export const loadCv = (): Cv => loadYaml('src/data/cv.yaml', cvSchema);
export const loadMisc = (): Misc => loadYaml('src/data/misc.yaml', miscSchema);

/** True when public/cv.pdf exists, i.e. when the `/cv.pdf` link would resolve. */
export const cvPdfExists = (): boolean => existsSync(join(REPO_ROOT, 'public', 'cv.pdf'));
