import { SELF_NAMES } from '../site.config';
import type { PubStatus, Publication } from '../schemas';

/** Display order within a year: lower rank comes first. */
const STATUS_RANK: Record<PubStatus, number> = {
  published: 0,
  accepted: 1,
  preprint: 2,
  'under-review': 3,
  'in-preparation': 4,
};

const STATUS_LABEL: Record<PubStatus, string | null> = {
  published: null,
  accepted: 'accepted',
  preprint: 'preprint',
  'under-review': 'under review',
  'in-preparation': 'in preparation',
};

/**
 * Year descending, then status (published, accepted, preprint, under-review, in-preparation), then
 * title.
 */
export function sortPublications(pubs: Publication[]): Publication[] {
  return [...pubs].sort(
    (a, b) =>
      b.year - a.year ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.title.localeCompare(b.title),
  );
}

/** True when the first listed author is one of the `self` names (exact match after trimming). */
export function isFirstAuthor(pub: Publication, self: readonly string[] = SELF_NAMES): boolean {
  const first = pub.authors[0];
  return first !== undefined && self.includes(first.trim());
}

export function filterPublications(
  pubs: Publication[],
  mode: 'all' | 'first-author' | 'selected',
): Publication[] {
  if (mode === 'first-author') return pubs.filter((pub) => isFirstAuthor(pub));
  if (mode === 'selected') return pubs.filter((pub) => pub.selected);
  return [...pubs];
}

/** Mark which author names are `self` (exact, case-sensitive match after trimming). */
export function authorSegments(
  authors: string[],
  self: readonly string[] = SELF_NAMES,
): { name: string; self: boolean }[] {
  return authors.map((name) => ({ name, self: self.includes(name.trim()) }));
}

/** Badge text for an unpublished paper; `null` for a published one. */
export function statusLabel(status: PubStatus): string | null {
  return STATUS_LABEL[status];
}

/**
 * The PDF to link for a paper. Under-review and in-preparation papers never expose
 * `links.pdf` (the manuscript is not public), so they fall back to the arXiv link only. A preprint
 * is public by definition, so it behaves like a published paper.
 */
export function pdfLink(pub: Publication): string | null {
  const { status, links } = pub;
  if (status === 'under-review' || status === 'in-preparation') return links.arxiv ?? null;
  return links.pdf ?? links.arxiv ?? null;
}

/**
 * The CV's one-line count of papers by status, e.g. ['3 published or accepted', '1 preprint',
 * '4 under review']. Published and accepted papers count together; a group with no papers is left
 * out.
 */
export function statusSummary(pubs: Publication[]): string[] {
  const groups: { statuses: PubStatus[]; label: string }[] = [
    { statuses: ['published', 'accepted'], label: 'published or accepted' },
    { statuses: ['preprint'], label: 'preprint' },
    { statuses: ['under-review'], label: 'under review' },
    { statuses: ['in-preparation'], label: 'in preparation' },
  ];
  return groups
    .map(({ statuses, label }) => ({
      count: pubs.filter((pub) => statuses.includes(pub.status)).length,
      label,
    }))
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => `${count} ${label}`);
}

/** True for a link to arXiv itself (arxiv.org or one of its subdomains, such as export.arxiv.org). */
function isArxivUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'arxiv.org' || hostname.endsWith('.arxiv.org');
  } catch {
    return false;
  }
}

/**
 * Whether a project page may show its Paper button for `url`. It mirrors `pdfLink`: the manuscript
 * of an under-review or in-preparation paper is not public, so for one only an arXiv link may show.
 * A preprint is public, so any link may show. A project without a linked publication keeps its link.
 */
export function paperLinkAllowed(pub: Publication | undefined, url: string): boolean {
  if (pub === undefined) return true;
  if (pub.status === 'under-review' || pub.status === 'in-preparation') return isArxivUrl(url);
  return true;
}
