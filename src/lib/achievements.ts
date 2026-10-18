// The six easter-egg achievements and the store that remembers which ones a visitor has found.
// Stored as a JSON array of ids under one localStorage key. Nothing here throws: unusable storage
// just means the progress lasts for the page view.

export const ACHIEVEMENTS = [
  'console',
  'blackhole',
  'terminal',
  'cat',
  'chirp',
  'enhance',
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];

export interface AchievementStore {
  /** Returns true for a new unlock and false when it was already unlocked. */
  unlock(id: AchievementId): boolean;
  has(id: AchievementId): boolean;
  /** The unlocked ids, in the order of ACHIEVEMENTS. */
  all(): AchievementId[];
  complete(): boolean;
  /** Calls `fn` now with the current ids and again on every change. Returns the unsubscribe. */
  subscribe(fn: (ids: AchievementId[]) => void): () => void;
}

type Backing = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'qx.achievements';

const isId = (value: unknown): value is AchievementId =>
  typeof value === 'string' && (ACHIEVEMENTS as readonly string[]).includes(value);

/** The ids held in storage. Missing, unreadable, malformed or unknown entries read as nothing. */
function readStored(storage: Backing | null): AchievementId[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isId) : [];
  } catch {
    return [];
  }
}

export function createStore(storage: Backing | null): AchievementStore {
  let backing = storage; // set to null after the first failed write: memory only from then on
  const unlocked = new Set<AchievementId>(readStored(backing));
  const listeners = new Set<(ids: AchievementId[]) => void>();

  const all = () => ACHIEVEMENTS.filter((id) => unlocked.has(id));

  return {
    unlock(id) {
      // Merge what is stored now, so a second tab's unlocks are not overwritten by this one.
      for (const stored of readStored(backing)) unlocked.add(stored);
      if (unlocked.has(id)) return false;
      unlocked.add(id);

      if (backing) {
        try {
          backing.setItem(STORAGE_KEY, JSON.stringify(all()));
        } catch {
          backing = null; // quota or blocked: keep the progress in memory and stop retrying
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qx:achievement', { detail: { id } }));
      }
      const ids = all();
      for (const fn of [...listeners]) fn(ids);
      return true;
    },
    has: (id) => unlocked.has(id),
    all,
    complete: () => unlocked.size === ACHIEVEMENTS.length,
    subscribe(fn) {
      listeners.add(fn);
      fn(all());
      return () => void listeners.delete(fn);
    },
  };
}

/** `localStorage`, or null where there is no window or touching it throws (blocked, SSR). */
export function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const store: AchievementStore = createStore(safeStorage());
