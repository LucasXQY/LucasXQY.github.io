import { describe, expect, it } from 'vitest';
import { loadPublications } from '../../src/lib/data';
import {
  authorSegments,
  filterPublications,
  isFirstAuthor,
  paperLinkAllowed,
  pdfLink,
  sortPublications,
  statusLabel,
  statusSummary,
} from '../../src/lib/publications';
import type { Publication } from '../../src/schemas';

let counter = 0;
function pub(overrides: Partial<Publication> = {}): Publication {
  counter += 1;
  return {
    id: `paper-${counter}`,
    title: `Paper ${counter}`,
    authors: ['Qiyi Xie'],
    venue: 'Example Venue',
    year: 2026,
    status: 'published',
    type: 'journal',
    selected: false,
    links: {},
    ...overrides,
  };
}

describe('sortPublications', () => {
  // Titles run opposite to status rank, so a title-only (or input-order) sort would fail.
  const inPrep = pub({ title: 'A', year: 2026, status: 'in-preparation' });
  const underReview = pub({ title: 'B', year: 2026, status: 'under-review' });
  const preprint = pub({ title: 'E', year: 2026, status: 'preprint' });
  const accepted = pub({ title: 'C', year: 2026, status: 'accepted' });
  const published = pub({ title: 'D', year: 2026, status: 'published' });
  const old = pub({ title: 'A', year: 2024, status: 'published' });

  it('sorts by year desc, then status rank, regardless of title or input order', () => {
    const sorted = sortPublications([old, inPrep, underReview, preprint, accepted, published]);
    expect(sorted).toEqual([published, accepted, preprint, underReview, inPrep, old]);
  });

  it('puts a later year first even when its status ranks lower', () => {
    const sorted = sortPublications([old, inPrep]);
    expect(sorted).toEqual([inPrep, old]);
  });

  it('breaks ties on year and status by title', () => {
    const b = pub({ title: 'Beta', year: 2025, status: 'accepted' });
    const a = pub({ title: 'Alpha', year: 2025, status: 'accepted' });
    expect(sortPublications([b, a])).toEqual([a, b]);
  });

  it('keeps the input order for entries equal on every key (stable)', () => {
    const first = pub({ title: 'Same', year: 2025, status: 'accepted' });
    const second = pub({ title: 'Same', year: 2025, status: 'accepted' });
    expect(sortPublications([first, second])).toEqual([first, second]);
    expect(sortPublications([second, first])).toEqual([second, first]);
  });

  it('does not mutate its input', () => {
    const input = [old, inPrep, published];
    const snapshot = [...input];
    const sorted = sortPublications(input);
    expect(input).toEqual(snapshot);
    expect(sorted).not.toBe(input);
  });
});

describe('isFirstAuthor', () => {
  it('is true when the first author is a self name', () => {
    expect(isFirstAuthor(pub({ authors: ['Qiyi Xie', 'A. B'] }))).toBe(true);
    expect(isFirstAuthor(pub({ authors: ['Q. Xie', 'A. B'] }))).toBe(true);
    expect(isFirstAuthor(pub({ authors: ['Qiyi (Lucas) Xie'] }))).toBe(true);
  });

  it('is false when a self name only appears later', () => {
    expect(isFirstAuthor(pub({ authors: ['Wei Chen Ng', 'Qiyi Xie'] }))).toBe(false);
  });

  it('is false for an unrelated first author', () => {
    expect(isFirstAuthor(pub({ authors: ['Y. Wu', 'Z. Li', 'Qiyi Xie'] }))).toBe(false);
  });

  it('accepts a custom self list', () => {
    const p = pub({ authors: ['Someone Else', 'Qiyi Xie'] });
    expect(isFirstAuthor(p, ['Someone Else'])).toBe(true);
    expect(isFirstAuthor(p, ['Nobody'])).toBe(false);
  });
});

describe('filterPublications', () => {
  const mine = pub({ authors: ['Qiyi Xie', 'et al.'], selected: true });
  const notMine = pub({ authors: ['Y. Wu', 'Qiyi Xie'], selected: true });
  const unselected = pub({ authors: ['Q. Xie'], selected: false });
  const all = [mine, notMine, unselected];

  it("'all' returns every publication", () => {
    expect(filterPublications(all, 'all')).toEqual(all);
  });

  it("'first-author' keeps only first-author papers", () => {
    expect(filterPublications(all, 'first-author')).toEqual([mine, unselected]);
  });

  it("'selected' keeps only papers flagged selected", () => {
    expect(filterPublications(all, 'selected')).toEqual([mine, notMine]);
  });

  it('does not mutate its input', () => {
    const input = [...all];
    filterPublications(input, 'first-author');
    expect(input).toEqual(all);
  });

  it("'first-author' on the real data returns the five first-author papers", () => {
    const ids = filterPublications(loadPublications(), 'first-author')
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual(['dt-farming', 'dt-hrc', 'gw-yolo', 'prin', 'vetonet']);
  });
});

describe('authorSegments', () => {
  it('flags "Q. Xie" as self', () => {
    expect(authorSegments(['Q. Xie', 'A. B'])).toEqual([
      { name: 'Q. Xie', self: true },
      { name: 'A. B', self: false },
    ]);
  });

  it('flags "Qiyi Xie" as self', () => {
    expect(authorSegments(['Qiyi Xie'])).toEqual([{ name: 'Qiyi Xie', self: true }]);
  });

  it('flags self wherever it appears and treats "et al." as a plain segment', () => {
    expect(authorSegments(['Wei Chen Ng', 'Qiyi Xie', 'et al.'])).toEqual([
      { name: 'Wei Chen Ng', self: false },
      { name: 'Qiyi Xie', self: true },
      { name: 'et al.', self: false },
    ]);
  });

  it('matches exactly: case-sensitive, trimming surrounding whitespace only', () => {
    const segments = authorSegments(['qiyi xie', ' Qiyi Xie ', 'QIYI XIE']);
    expect(segments.map((s) => s.self)).toEqual([false, true, false]);
  });

  it('accepts a custom self list', () => {
    expect(authorSegments(['A. B', 'Q. Xie'], ['A. B'])).toEqual([
      { name: 'A. B', self: true },
      { name: 'Q. Xie', self: false },
    ]);
  });

  it('returns an empty list for no authors', () => {
    expect(authorSegments([])).toEqual([]);
  });
});

describe('statusLabel', () => {
  it('labels unpublished statuses', () => {
    expect(statusLabel('under-review')).toBe('under review');
    expect(statusLabel('in-preparation')).toBe('in preparation');
    expect(statusLabel('accepted')).toBe('accepted');
    expect(statusLabel('preprint')).toBe('preprint');
  });

  it('returns null for published', () => {
    expect(statusLabel('published')).toBeNull();
  });
});

describe('pdfLink', () => {
  const pdf = 'https://x/a.pdf';
  const arxiv = 'https://arxiv.org/abs/0000.00000';

  it('ignores links.pdf for an under-review paper', () => {
    expect(pdfLink(pub({ status: 'under-review', links: { pdf } }))).toBeNull();
  });

  it('returns arxiv rather than pdf for under-review and in-preparation papers', () => {
    expect(pdfLink(pub({ status: 'under-review', links: { pdf, arxiv } }))).toBe(arxiv);
    expect(pdfLink(pub({ status: 'in-preparation', links: { pdf, arxiv } }))).toBe(arxiv);
  });

  it('returns null for an in-preparation paper with only a pdf', () => {
    expect(pdfLink(pub({ status: 'in-preparation', links: { pdf } }))).toBeNull();
  });

  it('prefers pdf, then arxiv, for accepted and published papers', () => {
    expect(pdfLink(pub({ status: 'accepted', links: { pdf, arxiv } }))).toBe(pdf);
    expect(pdfLink(pub({ status: 'published', links: { pdf } }))).toBe(pdf);
    expect(pdfLink(pub({ status: 'published', links: { arxiv } }))).toBe(arxiv);
  });

  it('treats a preprint like a published paper: pdf, then arxiv, else null', () => {
    expect(pdfLink(pub({ status: 'preprint', links: { pdf, arxiv } }))).toBe(pdf);
    expect(pdfLink(pub({ status: 'preprint', links: { arxiv } }))).toBe(arxiv);
    expect(pdfLink(pub({ status: 'preprint', links: {} }))).toBeNull();
  });

  it('returns null when there is no link at all', () => {
    expect(pdfLink(pub({ status: 'published', links: {} }))).toBeNull();
  });
});

describe('statusSummary', () => {
  it('counts published and accepted together, then under review, then in preparation', () => {
    const pubs = [
      pub({ status: 'published' }),
      pub({ status: 'accepted' }),
      pub({ status: 'under-review' }),
      pub({ status: 'under-review' }),
      pub({ status: 'in-preparation' }),
    ];
    expect(statusSummary(pubs)).toEqual([
      '2 published or accepted',
      '2 under review',
      '1 in preparation',
    ]);
  });

  it('puts preprints between published or accepted and under review', () => {
    const pubs = [
      pub({ status: 'published' }),
      pub({ status: 'preprint' }),
      pub({ status: 'under-review' }),
      pub({ status: 'in-preparation' }),
    ];
    expect(statusSummary(pubs)).toEqual([
      '1 published or accepted',
      '1 preprint',
      '1 under review',
      '1 in preparation',
    ]);
    expect(statusSummary([pub({ status: 'preprint' })])).toEqual(['1 preprint']);
  });

  it('leaves out a group with no papers', () => {
    expect(statusSummary([pub({ status: 'under-review' })])).toEqual(['1 under review']);
    expect(statusSummary([])).toEqual([]);
  });

  it('on the real data: 4 published or accepted, 1 preprint, 3 under review, 1 in preparation', () => {
    expect(statusSummary(loadPublications())).toEqual([
      '4 published or accepted',
      '1 preprint',
      '3 under review',
      '1 in preparation',
    ]);
  });
});

describe('paperLinkAllowed', () => {
  const arxiv = 'https://arxiv.org/abs/0000.00000';
  const manuscript = 'https://example.com/manuscript.pdf';

  it('allows only an arXiv link for under-review and in-preparation papers', () => {
    for (const status of ['under-review', 'in-preparation'] as const) {
      expect(paperLinkAllowed(pub({ status }), manuscript)).toBe(false);
      expect(paperLinkAllowed(pub({ status }), arxiv)).toBe(true);
      expect(paperLinkAllowed(pub({ status }), 'https://export.arxiv.org/abs/0000.00000')).toBe(
        true,
      );
    }
  });

  it('is not fooled by a host that only contains arxiv.org', () => {
    const underReview = pub({ status: 'under-review' });
    expect(paperLinkAllowed(underReview, 'https://arxiv.org.example.com/abs/1')).toBe(false);
    expect(paperLinkAllowed(underReview, 'https://notarxiv.org/abs/1')).toBe(false);
    expect(paperLinkAllowed(underReview, 'not a url')).toBe(false);
  });

  it('allows any link for accepted, published and preprint papers', () => {
    expect(paperLinkAllowed(pub({ status: 'accepted' }), manuscript)).toBe(true);
    expect(paperLinkAllowed(pub({ status: 'published' }), manuscript)).toBe(true);
    expect(paperLinkAllowed(pub({ status: 'preprint' }), manuscript)).toBe(true);
    expect(paperLinkAllowed(pub({ status: 'preprint' }), arxiv)).toBe(true);
  });

  it('allows the link of a project with no linked publication', () => {
    expect(paperLinkAllowed(undefined, manuscript)).toBe(true);
  });
});
