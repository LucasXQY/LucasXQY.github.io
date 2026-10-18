import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { scanRange, scanRepo, scanText } from '../../scripts/check-private.mjs';

const SCRIPT = fileURLToPath(new URL('../../scripts/check-private.mjs', import.meta.url));
const ZERO_SHA = '0'.repeat(40);
const ALLOWLIST = 'scripts/reviewed-pdfs.txt';
// Two versions of a tiny PDF; the NUL and high bytes make them binary, as real PDFs are.
const PDF_V1 = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from([0, 0xe2, 0xe3, 1])]);
const PDF_V2 = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from([0, 0xe2, 0xe3, 2])]);
const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
const GIT_TIMEOUT = 30_000; // these suites run dozens of git processes, slow on Windows and CI

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-private-'));
  tempDirs.push(dir);
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.autocrlf=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

function makeRepo(): string {
  const dir = tempDir();
  git(dir, 'init', '-q');
  return dir;
}

/** Writes the files (null deletes one), commits everything and returns the new HEAD sha. */
function commit(dir: string, files: Record<string, string | Buffer | null>): string {
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    if (content === null) {
      rmSync(path);
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'test commit');
  return git(dir, 'rev-parse', 'HEAD');
}

describe('scanText', () => {
  it('flags a US phone number', () => {
    expect(scanText('call +1 (267) 555-0100', 'a.md')).toHaveLength(1);
  });

  it('flags a GPA mention', () => {
    expect(scanText('GPA: 3.7', 'b.yaml')).toHaveLength(1);
  });

  it('flags a US state plus ZIP code', () => {
    expect(scanText('Philadelphia, PA 19104', 'c')).toHaveLength(1);
  });

  it('passes ordinary research text', () => {
    expect(scanText('PSNR 24.1 dB on LOL-v1', 'd')).toHaveLength(0);
  });

  it('passes DOI and arXiv links whose digits happen to group like a phone number', () => {
    expect(scanText('https://doi.org/10.1109/CIITE62244.2024.10987837', 'd')).toHaveLength(0);
    expect(scanText('https://doi.org/10.48550/arXiv.2610.21335', 'd')).toHaveLength(0);
    expect(scanText('https://doi.org/10.1016/j.neucom.2026.135279', 'd')).toHaveLength(0);
  });

  it('still flags a phone number that follows a year, a colon or a letter', () => {
    expect(scanText('In 2024 call 267.555.0100', 'd')).toHaveLength(1);
    expect(scanText('tel:267-555-0100', 'd')).toHaveLength(1);
    expect(scanText('phone267-555-0100', 'd')).toHaveLength(1);
  });

  it.each([
    '138 1234 5678',
    '138-1234-5678',
    '+86 138-1234-5678',
    '267.555.0100',
    '+1 267.555.0100',
  ])('flags the phone number format %s', (phone) => {
    expect(scanText(phone, 'e')).toHaveLength(1);
  });

  it.each(['+60 12-345 6789', '+6012-3456 7890', '60 12 3456 7890'])(
    'flags the Malaysian mobile number %s, written with the country code',
    (phone) => {
      expect(scanText(phone, 'f')).toHaveLength(1);
    },
  );

  it.each(['012-3456 7890', '011 2345 6789'])(
    'flags the Malaysian mobile number %s, written in the local form',
    (phone) => {
      expect(scanText(phone, 'g')).toHaveLength(1);
    },
  );

  it.each(['CGPA: 3.9', 'cgpa 3.9', 'Cumulative GPA'])('flags the grade mention %s', (text) => {
    expect(scanText(text, 'h')).toHaveLength(1);
  });

  it.each(['3.40/4.00', '3.4 / 4', 'ranked first, 3.72/4.0'])(
    'flags the grade figure %s even without the word',
    (text) => {
      expect(scanText(text, 'i')).toHaveLength(1);
    },
  );

  it.each(['INS-D-24-01234', 'NEUCOM-D-25-00001', 'TPAMI-2024-05-1234'])(
    'flags the manuscript number %s',
    (id) => {
      expect(scanText(id, 'j')).toHaveLength(1);
    },
  );

  it.each([
    '12 Example Street',
    '450 North Maple Road',
    '9 Sample Blvd',
    '88 Pine Lane',
    '7 Elm Ave.',
    '21 Elm St. upstairs',
    '5 Oak Dr.',
  ])('flags the street address %s', (address) => {
    expect(scanText(address, 'k')).toHaveLength(1);
  });

  it('flags a five-digit postcode followed by a town', () => {
    expect(scanText('12345 Springfield', 'l')).toHaveLength(1);
  });

  it.each([
    'Sept 2021 – Aug 2025, vol. 103, pp. 7–13',
    'PSNR 24.1 dB and SSIM 0.85 on LOL-v1',
    'planned over 20 activities, including Pathfinding Automated Vehicle workshop',
    'Never commit phone numbers, street addresses, grade point average figures',
    'Selangor, MYS & Remote',
    'the 2024 Highlights in Science, Engineering and Technology',
  ])('passes the ordinary text %s', (text) => {
    expect(scanText(text, 'm')).toHaveLength(0);
  });
});

describe('scanRepo', { timeout: GIT_TIMEOUT }, () => {
  it('reports committed content even when the working tree copy is gone', async () => {
    const dir = makeRepo();
    commit(dir, { 'cv.md': 'name\nGPA 3.9\n' });
    rmSync(join(dir, 'cv.md'));
    expect(await scanRepo('HEAD', dir)).toMatchObject([{ file: 'cv.md', line: 2 }]);
  });

  it('reports paths relative to the repository root from any directory', async () => {
    const dir = makeRepo();
    commit(dir, { 'sub/cv.md': 'GPA 3.9\n' });
    expect(await scanRepo('HEAD', join(dir, 'sub'))).toMatchObject([
      { file: 'sub/cv.md', line: 1 },
    ]);
  });

  it('decodes UTF-16 files that start with a byte order mark', async () => {
    const dir = makeRepo();
    const text = Buffer.from('GPA 3.9\n', 'utf16le');
    commit(dir, {
      'le.txt': Buffer.concat([Buffer.from([0xff, 0xfe]), text]),
      'be.txt': Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text).swap16()]),
    });
    expect(await scanRepo('HEAD', dir)).toMatchObject([
      { file: 'be.txt', line: 1 },
      { file: 'le.txt', line: 1 },
    ]);
  });

  it('skips sample files, the lockfile, vendored code and binaries', async () => {
    const dir = makeRepo();
    const secret = 'GPA 3.9\n';
    commit(dir, {
      'scripts/check-private.mjs': secret,
      'tests/unit/check-private.test.ts': secret,
      'package-lock.json': secret,
      'public/oneko/oneko.js': secret,
      'logo.png': secret,
      'blob.dat': Buffer.concat([Buffer.from(secret), Buffer.from([0, 0])]),
      'icon.svg': secret,
    });
    expect(await scanRepo('HEAD', dir)).toMatchObject([{ file: 'icon.svg', line: 1 }]);
  });

  it('scans the tree of the revision it is given', async () => {
    const dir = makeRepo();
    const first = commit(dir, { 'cv.md': 'GPA 3.9\n' });
    commit(dir, { 'cv.md': 'clean\n' });
    expect(await scanRepo(first, dir)).toMatchObject([{ file: 'cv.md', line: 1 }]);
    expect(await scanRepo('HEAD', dir)).toHaveLength(0);
  });
});

describe('scanRepo on PDFs', { timeout: GIT_TIMEOUT }, () => {
  it('reports a committed PDF whose sha256 is not in the allowlist, at line 0', async () => {
    const dir = makeRepo();
    commit(dir, { 'public/cv.pdf': PDF_V1 });
    expect(await scanRepo('HEAD', dir)).toEqual([
      { file: 'public/cv.pdf', line: 0, message: `unreviewed PDF (sha256 ${hash(PDF_V1)})` },
    ]);
  });

  it('passes a listed PDF, whatever the case of the hash, around comments and blank lines', async () => {
    const dir = makeRepo();
    commit(dir, {
      'public/cv.pdf': PDF_V1,
      [ALLOWLIST]: `# reviewed by hand\n\n${hash(PDF_V1).toUpperCase()}  # cv.pdf\n`,
    });
    expect(await scanRepo('HEAD', dir)).toHaveLength(0);
  });

  it('a listed hash allows only that exact file', async () => {
    const dir = makeRepo();
    commit(dir, { 'cv.pdf': PDF_V2, [ALLOWLIST]: `${hash(PDF_V1)}\n` });
    expect(await scanRepo('HEAD', dir)).toMatchObject([
      { file: 'cv.pdf', line: 0, message: `unreviewed PDF (sha256 ${hash(PDF_V2)})` },
    ]);
  });

  it('matches the extension in any case and never scans a PDF as text', async () => {
    const dir = makeRepo();
    const pdf = Buffer.from('%PDF-1.4\nGPA 3.9\n');
    commit(dir, { 'Paper.PDF': pdf });
    expect(await scanRepo('HEAD', dir)).toEqual([
      { file: 'Paper.PDF', line: 0, message: `unreviewed PDF (sha256 ${hash(pdf)})` },
    ]);
  });

  it('reads the allowlist from the commit, not the working tree', async () => {
    const dir = makeRepo();
    commit(dir, { 'cv.pdf': PDF_V1 });
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, ALLOWLIST), `${hash(PDF_V1)}\n`);
    expect(await scanRepo('HEAD', dir)).toMatchObject([{ file: 'cv.pdf', line: 0 }]);
  });

  it('throws on an allowlist line that is not a sha256 hash', async () => {
    const dir = makeRepo();
    commit(dir, { 'cv.pdf': PDF_V1, [ALLOWLIST]: 'public/cv.pdf\n' });
    await expect(scanRepo('HEAD', dir)).rejects.toThrow(/not a sha256 hash/);
  });
});

describe('scanRange', { timeout: GIT_TIMEOUT }, () => {
  it('catches a string that is added and removed inside one pushed range', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    commit(dir, { 'cv.md': 'name\nGPA 3.9\n' });
    const tip = commit(dir, { 'cv.md': null });
    expect(await scanRange(base, tip, dir)).toMatchObject([{ file: 'cv.md', line: 2 }]);
    expect(await scanRange(ZERO_SHA, tip, dir)).toMatchObject([{ file: 'cv.md', line: 2 }]);
  });

  it('shows the root commit even when log.showRoot is false', async () => {
    const dir = makeRepo();
    git(dir, 'config', 'log.showRoot', 'false');
    const tip = commit(dir, { 'cv.md': 'GPA 3.9\n' });
    expect(await scanRange(ZERO_SHA, tip, dir)).toMatchObject([{ file: 'cv.md', line: 1 }]);
  });

  it('ignores removed lines', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'cv.md': 'GPA 3.9\n' });
    const tip = commit(dir, { 'cv.md': 'clean\n' });
    expect(await scanRange(base, tip, dir)).toHaveLength(0);
  });

  it('tracks line numbers across hunks and handles lines that start with ++', async () => {
    const dir = makeRepo();
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const base = commit(dir, { 'notes.md': lines.join('\n') + '\n' });
    lines[19] = 'GPA 3.9';
    lines[24] = '++ call 267 555 0100';
    const tip = commit(dir, { 'notes.md': lines.join('\n') + '\n' });
    expect(await scanRange(base, tip, dir)).toMatchObject([
      { file: 'notes.md', line: 20 },
      { file: 'notes.md', line: 25 },
    ]);
  });

  it('applies the skip rules to the changed paths', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const tip = commit(dir, {
      'package-lock.json': 'GPA 3.9\n',
      'public/oneko/oneko.js': 'GPA 3.9\n',
      'scripts/check-private.mjs': 'GPA 3.9\n',
    });
    expect(await scanRange(base, tip, dir)).toHaveLength(0);
  });

  it('catches an unreviewed PDF that is added and removed inside one pushed range', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    commit(dir, { 'docs/cv.pdf': PDF_V1 });
    const tip = commit(dir, { 'docs/cv.pdf': null });
    const expected = [
      { file: 'docs/cv.pdf', line: 0, message: `unreviewed PDF (sha256 ${hash(PDF_V1)})` },
    ];
    expect(await scanRange(base, tip, dir)).toEqual(expected);
    expect(await scanRange(ZERO_SHA, tip, dir)).toEqual(expected);
  });

  it('checks every changed version of a PDF against the allowlist at the pushed tip', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'cv.pdf': PDF_V1, [ALLOWLIST]: `${hash(PDF_V1)}\n` });
    const changed = commit(dir, { 'cv.pdf': PDF_V2 });
    expect(await scanRange(base, changed, dir)).toMatchObject([
      { file: 'cv.pdf', line: 0, message: `unreviewed PDF (sha256 ${hash(PDF_V2)})` },
    ]);
    const listed = commit(dir, { [ALLOWLIST]: `${hash(PDF_V1)}\n${hash(PDF_V2)}\n` });
    expect(await scanRange(base, listed, dir)).toHaveLength(0);
  });

  it('ignores a deleted PDF, which pushes no content', async () => {
    const dir = makeRepo();
    const base = commit(dir, { 'cv.pdf': PDF_V1 });
    const tip = commit(dir, { 'cv.pdf': null });
    expect(await scanRange(base, tip, dir)).toHaveLength(0);
  });
});

describe('command line', { timeout: GIT_TIMEOUT }, () => {
  function run(cwd: string, args: string[] = [], input = '', script = SCRIPT) {
    return spawnSync(process.execPath, [script, ...args], { cwd, input, encoding: 'utf8' });
  }

  it('prints a clean result for a clean repository', () => {
    const dir = makeRepo();
    commit(dir, { 'README.md': 'hello\n' });
    const result = run(dir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('no private strings found');
  });

  it('still runs and exits 1 on a hit when started through a symlinked directory', () => {
    const dir = makeRepo();
    commit(dir, { 'cv.md': 'GPA 3.9\n' });
    const link = join(tempDir(), 'scripts-link');
    symlinkSync(dirname(SCRIPT), link, 'junction');
    const result = run(dir, [], '', join(link, 'check-private.mjs'));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('cv.md:1: matched');
  });

  it('--pre-push scans the pushed range read from stdin', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    commit(dir, { 'cv.md': 'name\nGPA 3.9\n' });
    const tip = commit(dir, { 'cv.md': null });
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${base}\n`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('cv.md:2: matched');
  });

  it('--pre-push also scans the pushed tree, which catches UTF-16 files git shows as binary', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('GPA 3.9\n', 'utf16le')]);
    const tip = commit(dir, { 'cv.txt': utf16 });
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${base}\n`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('cv.txt:1: matched');
  });

  it('--pre-push reports a hit seen by both the range and the tree scan only once', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const tip = commit(dir, { 'cv.md': 'GPA 3.9\n' });
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${base}\n`);
    expect(result.status).toBe(1);
    expect(result.stdout.trim().split('\n')).toHaveLength(1);
  });

  it('prints an unreviewed PDF with its hash and exits 1', () => {
    const dir = makeRepo();
    commit(dir, { 'cv.pdf': PDF_V1 });
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe(`cv.pdf:0: unreviewed PDF (sha256 ${hash(PDF_V1)})`);
  });

  it('--pre-push reports a PDF seen by both the range and the tree scan only once', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const tip = commit(dir, { 'cv.pdf': PDF_V1 });
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${base}\n`);
    expect(result.status).toBe(1);
    expect(result.stdout.trim().split('\n')).toEqual([
      `cv.pdf:0: unreviewed PDF (sha256 ${hash(PDF_V1)})`,
    ]);
  });

  it('--pre-push passes a reviewed PDF', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const tip = commit(dir, { 'cv.pdf': PDF_V1, [ALLOWLIST]: `${hash(PDF_V1)}\n` });
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${base}\n`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('no private strings found');
  });

  it('--pre-push with empty stdin falls back to scanning HEAD and says so', () => {
    const dir = makeRepo();
    commit(dir, { 'cv.md': 'GPA 3.9\n' });
    const result = run(dir, ['--pre-push'], '');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('cv.md:1: matched');
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr).toContain('scanning HEAD');
  });

  it('--pre-push passes a clean range and ignores branch deletions', () => {
    const dir = makeRepo();
    const base = commit(dir, { 'README.md': 'hello\n' });
    const tip = commit(dir, { 'README.md': 'hello again\n' });
    const input =
      `refs/heads/main ${tip} refs/heads/main ${base}\n` +
      `(delete) ${ZERO_SHA} refs/heads/old ${base}\n`;
    const result = run(dir, ['--pre-push'], input);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('no private strings found');
  });

  it('--pre-push fails closed when the range cannot be read', () => {
    const dir = makeRepo();
    const tip = commit(dir, { 'README.md': 'hello\n' });
    const unknown = 'a'.repeat(40);
    const result = run(dir, ['--pre-push'], `refs/heads/main ${tip} refs/heads/main ${unknown}\n`);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('no private strings found');
  });
});
