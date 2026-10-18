// Scans committed git content for strings that must never reach the public repo (phone numbers,
// street addresses and postcodes, manuscript IDs, grade point averages), and holds back every PDF
// whose sha256 is not in scripts/reviewed-pdfs.txt. Used by CI and the pre-push hook.
//   node scripts/check-private.mjs               scan the files committed at HEAD
//   node scripts/check-private.mjs --pre-push    scan every line and PDF added by the commits being
//                                                pushed, plus the full tree of each pushed tip
// Everything is read from git objects, never the working tree, and every git or read failure
// throws, so a broken scan can never look like a clean one.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

// None of these may use the g or y flag: scanText relies on stateless RegExp#test.
export const PATTERNS = [
  // US phone number, e.g. +1 (267) 555-0100, 267-555-0100 or 267.555.0100. It must not start in
  // the middle of a number, or the tail of a dotted identifier (a DOI ending in a four-digit year,
  // a dot and a long number) reads as a phone number.
  /(?<!\d)\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  // Mainland China mobile number written as 11 plain digits
  /\b1[3-9]\d{9}\b/,
  // Mainland China mobile number grouped 3-4-4, optional +86, e.g. +86 138-1234-5678
  /\b(?:\+?86[\s-]?)?1[3-9]\d[\s.-]?\d{4}[\s.-]?\d{4}\b/,
  // Malaysian mobile number with the country code, e.g. +60 12-345 6789
  /\+?60[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}\b/,
  // Malaysian mobile number in the local form, e.g. 012-3456 7890
  /\b01\d[\s-]?\d{3,4}[\s-]?\d{4}\b/,
  // Elsevier-style manuscript number for any journal code, e.g. INS-D-24-01234
  /\b[A-Z]{2,8}-D-\d{2}-\d+\b/,
  // IEEE TPAMI manuscript number, e.g. TPAMI-2024-05-1234
  /\bTPAMI-\d{4}-\d{2}-\d+/,
  // Grade point average or cumulative grade point average, in any case
  /\bC?GPA\b/i,
  // A grade figure out of 4, e.g. 3.40/4.00 or 3.4 / 4
  /\b[0-4]\.\d{1,2}\s*\/\s*4(\.0{1,2})?\b/,
  // US state abbreviation plus ZIP code, i.e. a street address tail
  /\b(PA|MA|CA|NY)\s+\d{5}\b/,
  // House number and street, e.g. 12 Example Street or 7 Elm Ave. It ends in (?!\w) rather than
  // \b, because \b can never follow the period of an abbreviation such as "St.".
  /\b\d{1,5}\s+[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+)?\s+(Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.?|Lane|Ln\.|Drive|Dr\.)(?!\w)/,
  // Five-digit postcode and town, e.g. 12345 Springfield (a year has four digits)
  /\b\d{5}\s+[A-Z][a-z]+\b/,
];

// The committed list of PDFs the owner has checked by hand: one sha256 per line, `#` comments.
const PDF_ALLOWLIST = 'scripts/reviewed-pdfs.txt';
const SHA256 = /^[0-9a-f]{64}$/;

// Files that hold sample strings on purpose, a vendored script, and the lockfile (hashes).
const SKIP_FILES = new Set([
  'scripts/check-private.mjs',
  'tests/unit/check-private.test.ts',
  'package-lock.json',
]);
const SKIP_PREFIXES = ['public/oneko/'];
// SVG is text and is scanned. Anything else binary is caught by the NUL-byte check below.
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.zip',
]);

const ALL_ZEROS = /^0+$/; // git's "no such commit" id: a new remote branch, or a deleted one
const MAX_GIT_OUTPUT = 256 * 1024 * 1024; // exceeding it throws, which fails the scan

export function scanText(text, file) {
  const findings = [];
  text.split(/\r?\n/).forEach((lineText, index) => {
    for (const pattern of PATTERNS) {
      if (pattern.test(lineText)) {
        findings.push({
          file,
          line: index + 1,
          pattern: String(pattern),
          message: `matched ${pattern}`,
        });
      }
    }
  });
  return findings;
}

// A PDF is never scanned as text (it is compressed binary): every version of one must instead be
// listed by hash in PDF_ALLOWLIST. Its finding is reported at line 0, since it is the whole file.
function isPdf(file) {
  return extname(file).toLowerCase() === '.pdf';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// Parses the allowlist: one sha256 per line, `#` starts a comment. A malformed line throws, so a
// typo cannot silently allow nothing or the wrong file.
function parseReviewedPdfs(text) {
  const hashes = new Set();
  text.split(/\r?\n/).forEach((lineText, index) => {
    const entry = lineText.replace(/#.*/, '').trim().toLowerCase();
    if (entry === '') return;
    if (!SHA256.test(entry)) {
      throw new Error(`${PDF_ALLOWLIST}:${index + 1}: not a sha256 hash: ${lineText}`);
    }
    hashes.add(entry);
  });
  return hashes;
}

function checkPdf(buffer, file, reviewed) {
  const hash = sha256(buffer);
  if (reviewed.has(hash)) return [];
  return [{ file, line: 0, message: `unreviewed PDF (sha256 ${hash})` }];
}

function isSkipped(file) {
  return (
    SKIP_FILES.has(file) ||
    SKIP_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    BINARY_EXTENSIONS.has(extname(file).toLowerCase())
  );
}

// Throws if git is missing, fails, or `cwd` is not inside a repository.
function git(args, cwd, encoding = 'utf8') {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding,
    maxBuffer: MAX_GIT_OUTPUT,
  });
}

// Every scan runs from the repository root, so paths are root-relative from any directory.
function repoRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], cwd).replace(/\r?\n$/, '');
}

// Returns the text of a file, or null for binary content. UTF-16 files (recognised by their
// byte order mark) are decoded first, because their NUL bytes would look like binary.
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);
  if (buffer.subarray(0, 8192).includes(0)) return null;
  return buffer.toString('utf8');
}

// A revision is passed to git as a positional argument, so it must not look like an option.
function assertRevision(rev) {
  if (rev.startsWith('-')) throw new Error(`invalid revision: ${rev}`);
}

// The allowlist as committed at `rev`. A revision without the file has reviewed no PDF at all.
function reviewedPdfsAt(rev, root) {
  const listed = git(['ls-tree', '--name-only', rev, '--', PDF_ALLOWLIST], root);
  if (listed.trim() === '') return new Set();
  return parseReviewedPdfs(git(['show', `${rev}:${PDF_ALLOWLIST}`], root));
}

// Scans every text file as committed at `rev` (a commit or other tree-ish) of the repository
// containing `cwd`, and checks every PDF there against the allowlist committed at `rev`.
export async function scanRepo(rev = 'HEAD', cwd = process.cwd()) {
  assertRevision(rev);
  const root = repoRoot(cwd);
  const listing = git(['ls-tree', '-r', '--name-only', '-z', rev], root);
  const reviewed = reviewedPdfsAt(rev, root);
  const findings = [];
  for (const file of listing.split('\0').filter(Boolean)) {
    if (isPdf(file)) {
      findings.push(...checkPdf(git(['show', `${rev}:${file}`], root, 'buffer'), file, reviewed));
      continue;
    }
    if (isSkipped(file)) continue;
    const text = decode(git(['show', `${rev}:${file}`], root, 'buffer'));
    if (text !== null) findings.push(...scanText(text, file));
  }
  return findings;
}

// Scans only the lines added by the commits in `from..to` (all history up to `to` when `from`
// is the all-zeros id), and every PDF version those commits add. A line or PDF added in one commit
// and removed in a later one is still reported, because the intermediate commit is part of the
// public history. `line` is the line number in the file as that commit left it. PDFs are checked
// against the allowlist committed at `to`. A deleted push (`to` all zeros) has no commits and is not
// valid here.
export async function scanRange(from, to, cwd = process.cwd()) {
  assertRevision(from);
  assertRevision(to);
  const root = repoRoot(cwd);
  const revisions = ALL_ZEROS.test(from) ? [to] : [`${from}..${to}`];
  return [...scanPatch(addedLines(revisions, root)), ...scanPdfChanges(revisions, to, root)];
}

function addedLines(revisions, root) {
  return git(
    [
      // A user's log.showRoot=false would hide the diff of the root commit on a first push.
      '-c',
      'log.showRoot=true',
      'log',
      '-p',
      '-U0',
      '--format=',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--no-show-signature',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      ...revisions,
    ],
    root,
  );
}

// Checks every blob that a commit in the range adds or changes under a .pdf name. `git log --raw
// -z` gives each change as ":<old mode> <new mode> <old id> <new id> <status>", NUL, the path, NUL.
function scanPdfChanges(revisions, to, root) {
  const raw = git(
    [
      '-c',
      'log.showRoot=true',
      'log',
      '--raw',
      '-z',
      '--no-abbrev',
      '--no-renames',
      '--diff-filter=AMT',
      '--format=',
      ...revisions,
    ],
    root,
  );
  const tokens = raw.split('\0');
  const reviewed = reviewedPdfsAt(to, root);
  const findings = [];
  for (let i = 0; i < tokens.length; i++) {
    const meta = tokens[i].replace(/^\n+/, '');
    if (meta === '') continue;
    if (!meta.startsWith(':') || i + 1 >= tokens.length) {
      throw new Error(`unexpected git log --raw output: ${meta}`);
    }
    const file = tokens[++i];
    if (!isPdf(file)) continue;
    const blob = meta.slice(1).split(' ')[3];
    findings.push(...checkPdf(git(['cat-file', 'blob', blob], root, 'buffer'), file, reviewed));
  }
  return findings;
}

const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

// Walks `git log -p` output and scans the added lines. Hunk lengths from the @@ headers tell us
// exactly which lines are content, so an added line such as "++ x" (shown as "+++ x") is never
// mistaken for a file header. A line that does not fit the hunk throws instead of being skipped.
function scanPatch(patch) {
  const findings = [];
  let file = null;
  let oldLeft = 0;
  let newLeft = 0;
  let newLine = 0;
  for (const text of patch.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      const marker = text[0];
      if (marker === '+') {
        if (file !== null && !isSkipped(file)) {
          for (const found of scanText(text.slice(1), file)) {
            findings.push({ ...found, line: newLine });
          }
        }
        newLeft--;
        newLine++;
      } else if (marker === '-') {
        oldLeft--;
      } else if (marker === ' ') {
        oldLeft--;
        newLeft--;
        newLine++;
      } else if (marker !== '\\') {
        throw new Error(`unexpected line inside a diff hunk: ${text}`);
      }
      continue;
    }
    if (text.startsWith('+++ ')) {
      const path = text.slice(4).replace(/\t$/, '');
      file = path === '/dev/null' ? null : path.replace(/^b\//, '');
      continue;
    }
    const hunk = HUNK_HEADER.exec(text);
    if (hunk) {
      oldLeft = Number(hunk[1] ?? 1);
      newLine = Number(hunk[2]);
      newLeft = Number(hunk[3] ?? 1);
    }
  }
  return findings;
}

function withoutDuplicates(findings) {
  const seen = new Set();
  return findings.filter(({ file, line, message }) => {
    const key = JSON.stringify([file, line, message]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Parses the pre-push hook input: "<local ref> <local sha> <remote ref> <remote sha>" per line.
// For each pushed tip it scans the lines added by the pushed commits (catches a string added and
// later removed within the push) and the whole tree (catches what `git log -p` does not show as
// text: UTF-16 or NUL-containing files, -diff attributes, merge resolutions, renames).
async function scanPush(input) {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length === 0) {
    // Git always sends the refs being pushed. Nothing to read means something is wrong, so scan
    // the most that can be scanned instead of reporting a clean push.
    console.error('check-private: no refs on stdin, scanning HEAD instead');
    return scanRepo('HEAD');
  }
  const findings = [];
  for (const line of lines) {
    const fields = line.split(/\s+/);
    if (fields.length !== 4) throw new Error(`unexpected pre-push input: ${line}`);
    const [, localSha, , remoteSha] = fields;
    if (ALL_ZEROS.test(localSha)) continue; // deleting a remote ref pushes no commits
    findings.push(...(await scanRange(remoteSha, localSha)), ...(await scanRepo(localSha)));
  }
  return withoutDuplicates(findings);
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

// import.meta.main is true only for the process entry point, even through a symlink or junction.
if (import.meta.main) {
  const findings = process.argv.includes('--pre-push')
    ? await scanPush(await readStdin())
    : await scanRepo();
  if (findings.length === 0) {
    console.log('no private strings found');
  } else {
    for (const { file, line, message } of findings) {
      console.log(`${file}:${line}: ${message}`);
    }
    process.exitCode = 1;
  }
}
