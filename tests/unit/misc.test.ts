import { describe, expect, test } from 'vitest';
import { isMiscEmpty } from '../../src/lib/misc';
import { miscSchema, type Misc } from '../../src/schemas';

/** A Misc as the loader returns it: `{}` parsed through the schema, then `overrides` merged in. */
const misc = (overrides: Record<string, unknown> = {}): Misc =>
  miscSchema.parse({ intro: '', hobbies: [], games: {}, music: {}, ...overrides });

describe('isMiscEmpty', () => {
  test('is true when nothing is filled in', () => {
    expect(isMiscEmpty(misc())).toBe(true);
    expect(isMiscEmpty(miscSchema.parse({}))).toBe(true);
  });

  test('is false for a game being played now', () => {
    expect(isMiscEmpty(misc({ games: { nowPlaying: { title: 'Celeste', platform: 'PC' } } }))).toBe(
      false,
    );
  });

  test('is false for an embed URL alone', () => {
    expect(isMiscEmpty(misc({ music: { embedUrl: 'https://example.com/embed' } }))).toBe(false);
  });

  test('is false for a hobby, a listed game or a playlist', () => {
    expect(isMiscEmpty(misc({ hobbies: [{ title: 'Climbing', text: 'Indoors.' }] }))).toBe(false);
    expect(isMiscEmpty(misc({ games: { list: [{ title: 'Hades' }] } }))).toBe(false);
    expect(
      isMiscEmpty(
        misc({ music: { playlists: [{ title: 'Focus', url: 'https://example.com/p' }] } }),
      ),
    ).toBe(false);
  });

  test('is true for an intro alone, because the page has nothing else to show', () => {
    expect(isMiscEmpty(misc({ intro: 'Hello there.' }))).toBe(true);
  });
});
