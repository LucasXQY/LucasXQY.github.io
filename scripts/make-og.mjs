// Generates public/og.png, the 1200x630 social card, from src/data/profile.yaml.
// Run once and commit the PNG; run again only when the name or tagline changes:
//   node scripts/make-og.mjs
// The chirp is the nav's, drawn by the same function (src/lib/waveform.ts), which Node loads
// directly by stripping its types.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'yaml';
import { chirpPath } from '../src/lib/waveform.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 80;
const BACKGROUND = '#0b0f14';
const ACCENT = '#22d3ee';
const MUTED = '#9aa4b2';
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MAX_LINE_CHARS = 56;

const root = new URL('../', import.meta.url);
const profile = parse(readFileSync(new URL('src/data/profile.yaml', root), 'utf8'));

const escapeXml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// SVG text does not wrap, so break the tagline into lines of at most MAX_LINE_CHARS characters.
function wrap(text, limit) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line !== '' && `${line} ${word}`.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

const tagline = wrap(profile.tagline, MAX_LINE_CHARS)
  .map((line, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BACKGROUND}"/>
  <text x="${PAD}" y="230" font-family="${FONT}" font-size="84" font-weight="700" fill="#ffffff">${escapeXml(profile.name)}</text>
  <text x="${PAD}" y="310" font-family="${FONT}" font-size="34" fill="${MUTED}">${tagline}</text>
  <g transform="translate(${PAD} 440)">
    <path d="${chirpPath(WIDTH - 2 * PAD, 120)}" fill="none" stroke="${ACCENT}" stroke-width="2.5" stroke-linejoin="round"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
writeFileSync(fileURLToPath(new URL('public/og.png', root)), png);
console.log(`public/og.png written: ${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB`);
