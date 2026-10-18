// Stand-in thumbnail for entries that have no image yet. Returns a data URI, so it works anywhere
// an <img src> does and needs no file on disk.

// Dark surface variants close to --surface; one is chosen per seed so neighbouring cards differ.
const SURFACES = ['#0f1620', '#111827', '#0f172a', '#12202b', '#171a2b', '#1b1626'] as const;

function hash(seed: string): number {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `data:image/svg+xml;utf8,...` showing the first two characters of `label` on a seeded dark tile. */
export function placeholderSvg(seed: string, label: string): string {
  const fill = SURFACES[hash(seed) % SURFACES.length];
  const text = escapeXml(Array.from(label).slice(0, 2).join(''));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='132' height='88' viewBox='0 0 132 88' ` +
    `preserveAspectRatio='xMidYMid slice'>` +
    `<rect width='132' height='88' fill='${fill}'/>` +
    `<text x='66' y='44' text-anchor='middle' dominant-baseline='central' ` +
    `font-family='system-ui, sans-serif' font-size='28' font-weight='700' fill='#22d3ee' ` +
    `fill-opacity='0.8'>${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
}
