import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACHIEVEMENTS,
  createStore,
  safeStorage,
  type AchievementId,
} from '../../src/lib/achievements';

const KEY = 'qx.achievements';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('ACHIEVEMENTS', () => {
  it('lists the six ids in order', () => {
    expect([...ACHIEVEMENTS]).toEqual([
      'console',
      'blackhole',
      'terminal',
      'cat',
      'chirp',
      'enhance',
    ]);
  });
});

describe('createStore with a storage', () => {
  it('unlocks once: true the first time, false after, and all() lists it', () => {
    const store = createStore(memoryStorage());
    expect(store.has('cat')).toBe(false);
    expect(store.unlock('cat')).toBe(true);
    expect(store.unlock('cat')).toBe(false);
    expect(store.has('cat')).toBe(true);
    expect(store.all()).toEqual(['cat']);
  });

  it('writes a JSON array of ids under qx.achievements and a new store reads it back', () => {
    const storage = memoryStorage();
    createStore(storage).unlock('chirp');
    expect(JSON.parse(storage.data.get(KEY)!)).toEqual(['chirp']);

    const next = createStore(storage);
    expect(next.has('chirp')).toBe(true);
    expect(next.all()).toEqual(['chirp']);
  });

  it('returns all() in the canonical order whatever order they were unlocked in', () => {
    const store = createStore(memoryStorage());
    store.unlock('enhance');
    store.unlock('console');
    store.unlock('cat');
    expect(store.all()).toEqual(['console', 'cat', 'enhance']);
  });

  it('is complete only after all six are unlocked', () => {
    const store = createStore(memoryStorage());
    expect(store.complete()).toBe(false);
    for (const id of ACHIEVEMENTS.slice(0, -1)) store.unlock(id);
    expect(store.complete()).toBe(false);
    store.unlock(ACHIEVEMENTS[ACHIEVEMENTS.length - 1]);
    expect(store.complete()).toBe(true);
  });

  it('does not clobber what another store on the same storage unlocked in the meantime', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    const b = createStore(storage);
    a.unlock('cat');
    b.unlock('chirp');
    expect(JSON.parse(storage.data.get(KEY)!)).toEqual(['cat', 'chirp']);
    expect(b.all()).toEqual(['cat', 'chirp']);
  });
});

describe('reading stored state', () => {
  it('treats malformed JSON as empty', () => {
    const store = createStore(memoryStorage({ [KEY]: '{not json' }));
    expect(store.all()).toEqual([]);
    expect(store.unlock('cat')).toBe(true);
  });

  it('treats JSON that is not an array as empty', () => {
    for (const raw of ['{"cat":true}', '"cat"', '42', 'null']) {
      expect(createStore(memoryStorage({ [KEY]: raw })).all()).toEqual([]);
    }
  });

  it('ignores unknown and non-string entries and keeps the known ids', () => {
    const stored = JSON.stringify(['cat', 'nope', 7, null, 'chirp']);
    const store = createStore(memoryStorage({ [KEY]: stored }));
    expect(store.all()).toEqual(['cat', 'chirp']);
    expect(store.unlock('cat')).toBe(false);
  });

  it('treats a getItem that throws as empty', () => {
    const store = createStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(store.all()).toEqual([]);
    expect(store.unlock('cat')).toBe(true);
  });
});

describe('without usable storage', () => {
  it('createStore(null) keeps state in memory and unlock still returns true', () => {
    const store = createStore(null);
    expect(() => store.unlock('cat')).not.toThrow();
    expect(store.has('cat')).toBe(true);
    expect(store.unlock('cat')).toBe(false);
    expect(store.all()).toEqual(['cat']);
  });

  it('a setItem that throws never reaches the caller and is not retried', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    const store = createStore({ getItem: () => null, setItem });
    expect(() => store.unlock('cat')).not.toThrow();
    expect(store.unlock('chirp')).toBe(true);
    expect(store.all()).toEqual(['cat', 'chirp']);
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

describe('subscribe', () => {
  it('calls back immediately with the current ids and again on every change', () => {
    const store = createStore(memoryStorage({ [KEY]: JSON.stringify(['cat']) }));
    const seen: AchievementId[][] = [];
    store.subscribe((ids) => seen.push(ids));
    expect(seen).toEqual([['cat']]);

    store.unlock('chirp');
    expect(seen).toEqual([['cat'], ['cat', 'chirp']]);
  });

  it('does not call back when an unlock changes nothing', () => {
    const store = createStore(null);
    store.unlock('cat');
    const fn = vi.fn();
    store.subscribe(fn);
    store.unlock('cat');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops calling back after unsubscribe', () => {
    const store = createStore(null);
    const fn = vi.fn();
    const unsubscribe = store.subscribe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.unlock('cat');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('the qx:achievement event', () => {
  it('fires on window with the id for a new unlock only', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const details: unknown[] = [];
    target.addEventListener('qx:achievement', (event) =>
      details.push((event as CustomEvent).detail),
    );

    const store = createStore(null);
    store.unlock('cat');
    store.unlock('cat');
    store.unlock('blackhole');
    expect(details).toEqual([{ id: 'cat' }, { id: 'blackhole' }]);
  });

  it('is skipped quietly when there is no window', () => {
    expect(typeof window).toBe('undefined');
    expect(() => createStore(null).unlock('cat')).not.toThrow();
  });
});

describe('safeStorage', () => {
  it('is null when there is no window', () => {
    expect(safeStorage()).toBeNull();
  });

  it('is null when reading window.localStorage throws', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('storage blocked');
      },
    });
    expect(safeStorage()).toBeNull();
  });

  it('is the window localStorage when it is available', () => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', { localStorage });
    expect(safeStorage()).toBe(localStorage);
  });
});
