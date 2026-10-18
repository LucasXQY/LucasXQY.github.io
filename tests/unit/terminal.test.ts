import { describe, expect, it, vi, type Mock } from 'vitest';
import { TERMINAL } from '../../src/data/eggs';
import { isKnownCommand, runCommand, type TermContext } from '../../src/lib/eggs/terminal';

function setup(): TermContext & {
  navigate: Mock<(path: string) => void>;
  setTheme: Mock<(theme: 'dark' | 'light') => void>;
  close: Mock<() => void>;
  clear: Mock<() => void>;
} {
  return {
    pages: ['about', 'publications', 'projects', 'cv', 'misc'],
    // Neutral fixtures: these ids and titles are not the real papers.
    pubs: [
      { id: 'paper-a', title: 'Paper A: A First Example' },
      { id: 'paper-b', title: 'Paper B: A Second Example' },
    ],
    navigate: vi.fn<(path: string) => void>(),
    setTheme: vi.fn<(theme: 'dark' | 'light') => void>(),
    close: vi.fn<() => void>(),
    clear: vi.fn<() => void>(),
  };
}

describe('runCommand', () => {
  it('returns nothing for empty or blank input and touches nothing', () => {
    const ctx = setup();
    expect(runCommand('', ctx)).toEqual([]);
    expect(runCommand('   \t ', ctx)).toEqual([]);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.setTheme).not.toHaveBeenCalled();
    expect(ctx.close).not.toHaveBeenCalled();
    expect(ctx.clear).not.toHaveBeenCalled();
  });

  it('help returns the help text', () => {
    expect(runCommand('help', setup())).toEqual(TERMINAL.help);
  });

  it('ls lists the pages, one per line', () => {
    const lines = runCommand('ls', setup());
    expect(lines).toEqual(['about', 'publications', 'projects', 'cv', 'misc']);
    expect(lines).toContain('publications');
  });

  it('cd navigates to /<page>/ for a listed page', () => {
    const ctx = setup();
    expect(runCommand('cd cv', ctx)).toEqual([]);
    expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith('/cv/');
  });

  it('cd about goes to the home page', () => {
    const ctx = setup();
    runCommand('cd about', ctx);
    expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith('/');
  });

  it('cd with an unknown page prints one error line and does not navigate', () => {
    const ctx = setup();
    expect(runCommand('cd nowhere', ctx)).toEqual(['cd: no such page: nowhere']);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('cd cannot be talked into leaving the listed pages', () => {
    const ctx = setup();
    expect(runCommand('cd //evil.example', ctx)).toEqual(['cd: no such page: //evil.example']);
    expect(runCommand('cd ..', ctx)).toEqual(['cd: no such page: ..']);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('cd without a page prints a usage line', () => {
    const ctx = setup();
    expect(runCommand('cd', ctx)).toEqual(['usage: cd <page>']);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('cat cv prints the short CV', () => {
    expect(runCommand('cat cv', setup())).toEqual(TERMINAL.catCv);
  });

  it('cat of anything else is a one-line error, and cat alone prints usage', () => {
    const ctx = setup();
    expect(runCommand('cat secrets', ctx)).toEqual(['cat: secrets: No such file']);
    expect(runCommand('cat', ctx)).toEqual(['usage: cat <file>']);
  });

  it('open <id> navigates to the paper on the publications page', () => {
    const ctx = setup();
    expect(runCommand('open paper-a', ctx)).toEqual([]);
    expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith('/publications/#paper-a');
  });

  it('open with an unknown id prints one error line and does not navigate', () => {
    const ctx = setup();
    expect(runCommand('open nope', ctx)).toEqual(['open: unknown paper id: nope']);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('open alone lists every id with its title, one per line', () => {
    const ctx = setup();
    const lines = runCommand('open', ctx);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('paper-a');
    expect(lines[0]).toContain('Paper A: A First Example');
    expect(lines[1]).toContain('paper-b');
    expect(lines[1]).toContain('Paper B: A Second Example');
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('whoami prints the whoami text', () => {
    expect(runCommand('whoami', setup())).toEqual(TERMINAL.whoami);
  });

  it('theme light and theme dark call setTheme and report the choice', () => {
    const ctx = setup();
    expect(runCommand('theme light', ctx)).toEqual(['theme: light']);
    expect(ctx.setTheme).toHaveBeenLastCalledWith('light');
    expect(runCommand('theme dark', ctx)).toEqual(['theme: dark']);
    expect(ctx.setTheme).toHaveBeenLastCalledWith('dark');
    expect(ctx.setTheme).toHaveBeenCalledTimes(2);
  });

  it('theme with anything else prints a usage line and changes nothing', () => {
    const ctx = setup();
    expect(runCommand('theme', ctx)).toEqual(['usage: theme dark|light']);
    expect(runCommand('theme sepia', ctx)).toEqual(['usage: theme dark|light']);
    expect(ctx.setTheme).not.toHaveBeenCalled();
  });

  it('clear calls ctx.clear and prints nothing', () => {
    const ctx = setup();
    expect(runCommand('clear', ctx)).toEqual([]);
    expect(ctx.clear).toHaveBeenCalledTimes(1);
  });

  it('exit calls ctx.close and prints nothing', () => {
    const ctx = setup();
    expect(runCommand('exit', ctx)).toEqual([]);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it('sudo with any arguments, or none, prints the sudo text', () => {
    const ctx = setup();
    expect(runCommand('sudo rm -rf /', ctx)).toEqual(TERMINAL.sudo);
    expect(runCommand('sudo', ctx)).toEqual(TERMINAL.sudo);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('an unknown command reports itself and nothing else', () => {
    const lines = runCommand('foo', setup());
    expect(lines).toEqual([TERMINAL.notFound('foo')]);
    expect(lines[0]).toContain('foo');
  });

  it('unknown commands report only the first word, as a shell does', () => {
    expect(runCommand('foo bar baz', setup())).toEqual([TERMINAL.notFound('foo')]);
  });

  it('ignores surrounding and repeated whitespace', () => {
    const ctx = setup();
    runCommand('  cd    cv  ', ctx);
    expect(ctx.navigate).toHaveBeenCalledExactlyOnceWith('/cv/');
  });

  it('matches commands case-sensitively: LS is not ls', () => {
    const ctx = setup();
    expect(runCommand('LS', ctx)).toEqual([TERMINAL.notFound('LS')]);
    expect(runCommand('Help', ctx)).toEqual([TERMINAL.notFound('Help')]);
    expect(runCommand('theme LIGHT', ctx)).toEqual(['usage: theme dark|light']);
    expect(runCommand('cd CV', ctx)).toEqual(['cd: no such page: CV']);
  });

  it('hands visitor-typed markup back byte for byte: the caller must render it as text', () => {
    const ctx = setup();
    expect(runCommand('<b>x</b>', ctx)).toEqual([TERMINAL.notFound('<b>x</b>')]);
    expect(runCommand('<b>x</b>', ctx)[0]).toContain('<b>x</b>');

    const img = runCommand('<img src=x onerror=1>', ctx);
    expect(img).toEqual([TERMINAL.notFound('<img')]);
    expect(img[0]).toContain('<img');
    expect(img[0]).not.toContain('&lt;');

    expect(runCommand('cd <script>', ctx)).toEqual(['cd: no such page: <script>']);
    expect(runCommand('open <i>', ctx)).toEqual(['open: unknown paper id: <i>']);
    expect(runCommand('cat <u>', ctx)).toEqual(['cat: <u>: No such file']);
  });

  it('returns fresh arrays, so a caller cannot corrupt the shared copy', () => {
    const lines = runCommand('help', setup());
    lines.push('tampered');
    expect(runCommand('help', setup())).toEqual(TERMINAL.help);
    expect(TERMINAL.help).not.toContain('tampered');
  });
});

describe('isKnownCommand', () => {
  it('is true for every command the help text lists, and for sudo', () => {
    for (const input of [
      'help',
      'ls',
      'cd x',
      'cat x',
      'open',
      'whoami',
      'theme',
      'clear',
      'exit',
      'sudo',
    ]) {
      expect(isKnownCommand(input), input).toBe(true);
    }
  });

  it('is false for empty input, unknown words and wrong case', () => {
    for (const input of ['', '   ', 'foo', 'LS', 'Help', '<b>x</b>']) {
      expect(isKnownCommand(input), input).toBe(false);
    }
  });

  it('counts a known command with bad arguments as known: it was understood', () => {
    expect(isKnownCommand('cd nowhere')).toBe(true);
    expect(isKnownCommand('  theme sepia ')).toBe(true);
  });
});
