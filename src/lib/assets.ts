import type { ImageMetadata } from 'astro';

// Keys are root-relative, e.g. '/src/assets/pubs/prin.png'.
const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{png,jpg,jpeg,webp,svg}',
);

/**
 * Look up an image under src/assets by the path written in YAML or frontmatter, with or without a
 * leading slash. Rejects with the path in the message, so a typo fails the build instead of
 * rendering a broken image.
 */
export async function resolveAsset(path: string): Promise<ImageMetadata> {
  const load = assets[path.startsWith('/') ? path : `/${path}`];
  if (!load) throw new Error(`asset not found: ${path}`);
  return (await load()).default;
}
