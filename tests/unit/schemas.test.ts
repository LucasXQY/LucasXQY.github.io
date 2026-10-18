import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  miscSchema,
  newsSchema,
  projectSchema,
  pubStatus,
  publicationSchema,
} from '../../src/schemas';

const validPublication = {
  id: 'example-paper-2026',
  title: 'An Example Paper',
  authors: ['Qiyi Xie', 'Another Author'],
  venue: 'Example Conference',
  year: 2026,
  status: 'accepted',
  type: 'conference',
};

// projectSchema takes Astro's `image` helper; a plain string schema stands in for it here.
const project = projectSchema(() => z.string());
const validProject = {
  title: 'Example Project',
  summary: 'A short summary.',
  tags: ['vision'],
  date: '2026-08',
  status: 'ongoing',
};

describe('publicationSchema', () => {
  it('accepts a valid entry and fills defaults', () => {
    const parsed = publicationSchema.parse(validPublication);
    expect(parsed.selected).toBe(false);
    expect(parsed.links).toEqual({});
  });

  it('rejects an unknown status', () => {
    expect(() => publicationSchema.parse({ ...validPublication, status: 'draft' })).toThrow();
  });

  it('accepts exactly the five statuses, in display order', () => {
    expect(pubStatus.options).toEqual([
      'published',
      'accepted',
      'preprint',
      'under-review',
      'in-preparation',
    ]);
    for (const status of pubStatus.options) {
      expect(publicationSchema.parse({ ...validPublication, status }).status).toBe(status);
    }
  });
});

describe('projectSchema', () => {
  it('rejects enhanceDemo that only has dark', () => {
    const both = { dark: 'dark.png', bright: 'bright.png' };
    expect(project.parse({ ...validProject, enhanceDemo: both }).enhanceDemo).toEqual(both);
    expect(() => project.parse({ ...validProject, enhanceDemo: { dark: 'dark.png' } })).toThrow();
  });

  it('accepts an optional label and alt on enhanceDemo', () => {
    const demo = { dark: 'dark.png', bright: 'bright.png', label: 'model output', alt: 'A scene' };
    expect(project.parse({ ...validProject, enhanceDemo: demo }).enhanceDemo).toEqual(demo);
    expect(() => project.parse({ ...validProject, enhanceDemo: { ...demo, label: 3 } })).toThrow();
  });

  // Type-level pin (checked by `npm run check`): the type `image()` returns must survive into the
  // parsed data, since Astro derives `entry.data` from it and pages pass `cover` to <Image>.
  it('keeps the image output type', () => {
    const parsed = project.parse({ ...validProject, cover: 'cover.png' });
    expectTypeOf(parsed.cover).toEqualTypeOf<string | undefined>();
    expectTypeOf(parsed.enhanceDemo).toEqualTypeOf<
      | { dark: string; bright: string; label?: string | undefined; alt?: string | undefined }
      | undefined
    >();
  });
});

describe('newsSchema', () => {
  it('rejects a date that is not YYYY-MM', () => {
    expect(newsSchema.parse([{ date: '2026-08', text: 'Something happened' }])).toHaveLength(1);
    expect(() => newsSchema.parse([{ date: '2026-8', text: 'Something happened' }])).toThrow();
  });
});

describe('miscSchema', () => {
  it('fills every default, including nested lists, from an empty object', () => {
    expect(miscSchema.parse({})).toEqual({
      intro: '',
      hobbies: [],
      games: { list: [] },
      music: { playlists: [] },
    });
  });
});
