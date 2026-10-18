// The terminal easter egg's command interpreter. Pure TypeScript with no DOM access: everything
// it can do to the page goes through the TermContext it is handed, so it unit-tests with mocks.
//
// Security: several replies echo what the visitor typed (the unknown-command line, "no such page",
// "unknown paper id"). Those strings are returned exactly as typed, never escaped or wrapped in
// markup, so whoever displays them must render each line as plain text (textContent), never as HTML.
//
// Commands are matched case-sensitively, in lowercase, like a real shell: `LS` is not `ls`.
// Only the first word picks the command; for cd, cat, open and theme, the second word is the
// argument and any further words are ignored.

import { TERMINAL } from '../../data/eggs';

export interface TermContext {
  pages: string[];
  pubs: { id: string; title: string }[];
  navigate(path: string): void;
  setTheme(t: 'dark' | 'light'): void;
  close(): void;
  clear(): void;
}

const COMMANDS = [
  'help',
  'ls',
  'cd',
  'cat',
  'open',
  'whoami',
  'theme',
  'clear',
  'exit',
  'sudo',
] as const;

const words = (input: string): string[] => input.trim().split(/\s+/).filter(Boolean);

/**
 * True when the first word of `input` is a command this terminal understands, whatever its
 * arguments: `cd nowhere` is known (it was understood, and refused), `foo` and an empty line are not.
 */
export function isKnownCommand(input: string): boolean {
  const [cmd] = words(input);
  return cmd !== undefined && (COMMANDS as readonly string[]).includes(cmd);
}

/** The lines the terminal should print for `input`, after carrying out whatever it asked for. */
export function runCommand(input: string, ctx: TermContext): string[] {
  const [cmd, arg] = words(input);
  if (cmd === undefined) return [];

  switch (cmd) {
    case 'help':
      return [...TERMINAL.help];

    case 'ls':
      return [...ctx.pages];

    case 'cd': {
      if (arg === undefined) return ['usage: cd <page>'];
      if (!ctx.pages.includes(arg)) return [`cd: no such page: ${arg}`];
      ctx.navigate(arg === 'about' ? '/' : `/${arg}/`);
      return [];
    }

    case 'cat': {
      if (arg === undefined) return ['usage: cat <file>'];
      return arg === 'cv' ? [...TERMINAL.catCv] : [`cat: ${arg}: No such file`];
    }

    case 'open': {
      if (arg === undefined) {
        const width = Math.max(0, ...ctx.pubs.map((pub) => pub.id.length));
        return ctx.pubs.map((pub) => `${pub.id.padEnd(width)}  ${pub.title}`);
      }
      if (!ctx.pubs.some((pub) => pub.id === arg)) return [`open: unknown paper id: ${arg}`];
      ctx.navigate(`/publications/#${arg}`);
      return [];
    }

    case 'whoami':
      return [...TERMINAL.whoami];

    case 'theme': {
      if (arg !== 'dark' && arg !== 'light') return ['usage: theme dark|light'];
      ctx.setTheme(arg);
      return [`theme: ${arg}`];
    }

    case 'clear':
      ctx.clear();
      return [];

    case 'exit':
      ctx.close();
      return [];

    case 'sudo':
      return [...TERMINAL.sudo];

    default:
      return [TERMINAL.notFound(cmd)];
  }
}
