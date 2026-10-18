import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/lib/achievements';
import { CONSOLE_ART, CONSOLE_HINT, HELP_OUTPUT } from '../../src/data/eggs';
import { installConsoleEgg } from '../../src/lib/eggs/console';

type EggWindow = Window & { help?: () => void };

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function setup() {
  const win = {} as EggWindow;
  const log = vi.fn<(line: string) => void>();
  const store = createStore(memoryStorage());
  return { win, log, store };
}

describe('installConsoleEgg', () => {
  it('logs the art and then the hint, and defines win.help', () => {
    const { win, log, store } = setup();
    installConsoleEgg(win, log, store);

    expect(log.mock.calls.map(([line]) => line)).toEqual([CONSOLE_ART, CONSOLE_HINT]);
    expect(typeof win.help).toBe('function');
  });

  it('does not unlock anything until help() is called', () => {
    const { win, log, store } = setup();
    installConsoleEgg(win, log, store);
    expect(store.has('console')).toBe(false);
  });

  it('help() logs every HELP_OUTPUT line after the art and unlocks the console star', () => {
    const { win, log, store } = setup();
    installConsoleEgg(win, log, store);
    log.mockClear();

    win.help!();

    expect(log.mock.calls.map(([line]) => line)).toEqual(HELP_OUTPUT);
    expect(store.has('console')).toBe(true);
  });

  it('help() unlocks once per store: the second call logs again but unlocks silently', () => {
    const { win, log, store } = setup();
    const unlock = vi.spyOn(store, 'unlock');
    installConsoleEgg(win, log, store);

    win.help!();
    win.help!();

    expect(unlock.mock.results.map((result) => result.value)).toEqual([true, false]);
    expect(store.all()).toEqual(['console']);
  });

  it('is idempotent: a second install neither logs again nor replaces win.help', () => {
    const { win, log, store } = setup();
    installConsoleEgg(win, log, store);
    const help = win.help;
    const logged = log.mock.calls.length;

    installConsoleEgg(win, log, store);

    expect(log).toHaveBeenCalledTimes(logged);
    expect(win.help).toBe(help);
  });

  it('installs separately on separate windows', () => {
    const first = setup();
    const second = setup();
    installConsoleEgg(first.win, first.log, first.store);
    installConsoleEgg(second.win, second.log, second.store);

    expect(first.log).toHaveBeenCalledTimes(2);
    expect(second.log).toHaveBeenCalledTimes(2);
  });
});
