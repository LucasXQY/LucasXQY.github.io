// The "Certificate of Curiosity" on the hidden page: drawn on a canvas in the visitor's browser and
// handed over as a PNG download. Nothing is sent anywhere, and the only thing it knows about the
// visitor is the date. The drawing is a plain function of a 2D context, so a test can run it
// against a recording stand-in.

import { chirpPath } from './waveform';

export const CERTIFICATE_WIDTH = 1200;
export const CERTIFICATE_HEIGHT = 800;
export const CERTIFICATE_FILENAME = 'certificate-of-curiosity.png';

// The site's dark theme tokens, fixed: a certificate is an image, so it does not follow the theme.
const BACKGROUND = '#0b0f14';
const TEXT = '#e5e7eb';
const MUTED = '#9aa4b2';
const ACCENT = '#22d3ee';
const STAR = '#fbbf24';

const SANS = '"Inter Variable", "Segoe UI", system-ui, sans-serif';
const MONO = '"JetBrains Mono Variable", Consolas, "Cascadia Mono", monospace';

export interface CertificateContent {
  /** The heading, e.g. "Certificate of Curiosity". */
  title: string;
  /** The line that introduces the name. */
  lead: string;
  name: string;
  /** Shown as given: the caller formats it, see `isoDate`. */
  date: string;
  /** How many stars to draw. */
  stars: number;
}

/** Local calendar date as YYYY-MM-DD (not UTC, so late in the evening it is still today). */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Paints the certificate onto a `CERTIFICATE_WIDTH` x `CERTIFICATE_HEIGHT` canvas. */
export function drawCertificate(ctx: CanvasRenderingContext2D, content: CertificateContent): void {
  const centre = CERTIFICATE_WIDTH / 2;

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT);

  // A thin frame, faint so it does not compete with the text.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.strokeRect(40, 40, CERTIFICATE_WIDTH - 80, CERTIFICATE_HEIGHT - 80);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = TEXT;
  ctx.font = `700 68px ${SANS}`;
  ctx.fillText(content.title, centre, 190);

  ctx.fillStyle = STAR;
  ctx.font = `44px ${SANS}`;
  const gap = 70;
  for (let i = 0; i < content.stars; i += 1) {
    ctx.fillText('★', centre + (i - (content.stars - 1) / 2) * gap, 270);
  }

  ctx.fillStyle = MUTED;
  ctx.font = `400 28px ${SANS}`;
  ctx.fillText(content.lead, centre, 360);

  // The site owner's name, below the lead and smaller than the title: it names whose site the
  // stars were on, so it must not read as the recipient.
  ctx.fillStyle = ACCENT;
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText(content.name, centre, 420);

  // The chirp from the nav bar, as a thin line. Path2D reads the same path data the SVG uses.
  const waveWidth = 900;
  const waveHeight = 140;
  ctx.save();
  ctx.translate(centre - waveWidth / 2, 490);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ACCENT;
  ctx.stroke(new Path2D(chirpPath(waveWidth, waveHeight)));
  ctx.restore();

  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${MONO}`;
  ctx.fillText(content.date, centre, 700);
}

/** Makes sure the fonts the drawing names are loaded, so the canvas does not fall back. Never throws. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 68px ${SANS}`),
      document.fonts.load(`600 44px ${SANS}`),
      document.fonts.load(`400 28px ${SANS}`),
      document.fonts.load(`400 30px ${MONO}`),
    ]);
  } catch {
    // Unsupported or failed: the fallback faces in the font stacks are used.
  }
}

/**
 * Draws the certificate and starts a download of it as `CERTIFICATE_FILENAME`. Resolves true once
 * the download has been triggered and false when the browser could not produce the image.
 */
export async function downloadCertificate(content: CertificateContent): Promise<boolean> {
  await loadFonts();

  const canvas = document.createElement('canvas');
  canvas.width = CERTIFICATE_WIDTH;
  canvas.height = CERTIFICATE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  drawCertificate(ctx, content);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = CERTIFICATE_FILENAME;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers; a second is plenty.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
