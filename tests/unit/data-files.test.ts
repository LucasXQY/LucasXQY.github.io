import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cvPdfExists,
  loadCv,
  loadMisc,
  loadNews,
  loadProfile,
  loadPublications,
} from '../../src/lib/data';

describe('data files', () => {
  it('publications: 9 entries with the expected ids and selected set', () => {
    const pubs = loadPublications();
    const expectedIds = [
      'prin',
      'vetonet',
      'gw-yolo',
      'mamba-llie',
      'jepa-review',
      'self-improvement-review',
      'battery',
      'dt-hrc',
      'dt-farming',
    ];
    expect(pubs).toHaveLength(9);
    expect(pubs.map((p) => p.id).sort()).toEqual([...expectedIds].sort());
    expect(
      pubs
        .filter((p) => p.selected)
        .map((p) => p.id)
        .sort(),
    ).toEqual(['mamba-llie', 'prin', 'vetonet']);
  });

  it('publications: VetoNet is a preprint that links arXiv and its DOI', () => {
    const vetonet = loadPublications().find((p) => p.id === 'vetonet');
    expect(vetonet).toMatchObject({
      status: 'preprint',
      type: 'preprint',
      venue: 'arXiv:2610.21335',
      links: {
        arxiv: 'https://arxiv.org/abs/2610.21335',
        doi: 'https://doi.org/10.48550/arXiv.2610.21335',
      },
    });
  });

  it('publications: the JEPA review is published with a DOI', () => {
    const jepa = loadPublications().find((p) => p.id === 'jepa-review');
    expect(jepa).toMatchObject({
      status: 'published',
      links: { doi: 'https://doi.org/10.1016/j.neucom.2026.135279' },
    });
  });

  it('news: four entries, the two newest from 2026-10', () => {
    const news = loadNews();
    expect(news).toHaveLength(4);
    expect(news.slice(0, 2).map((n) => n.date)).toEqual(['2026-10', '2026-10']);
    expect(news[0]?.link).toBe('https://arxiv.org/abs/2610.21335');
    expect(news[1]?.link).toBe('https://doi.org/10.1016/j.neucom.2026.135279');
  });

  it('profile: at least one bio paragraph', () => {
    expect(loadProfile().bio.length).toBeGreaterThanOrEqual(1);
  });

  it('cv: two education entries', () => {
    expect(loadCv().education).toHaveLength(2);
  });

  it('misc: all three blocks are empty', () => {
    expect(loadMisc()).toEqual({
      intro: '',
      hobbies: [],
      games: { list: [] },
      music: { playlists: [] },
    });
  });

  it('cvPdfExists follows the presence of public/cv.pdf', () => {
    expect(cvPdfExists()).toBe(existsSync(resolve('public/cv.pdf')));
  });
});
