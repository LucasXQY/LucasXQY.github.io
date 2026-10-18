// The console easter egg: a chirp drawn in ASCII, a hint, and a global help() that lights a star.
// Pure TypeScript with no DOM access beyond the window it is handed, so it unit-tests with a fake.

import type { AchievementStore } from '../achievements';
import { CONSOLE_ART, CONSOLE_HINT, HELP_OUTPUT } from '../../data/eggs';

type EggWindow = Window & { help?: () => void };

/** Marks a window that already has the egg, so a second install is a no-op. */
const INSTALLED = '__qxConsoleEgg';

/**
 * Logs the art (one multi-line `log` call, so the console keeps its alignment) and then the hint,
 * and defines `win.help`. help() prints HELP_OUTPUT one line per `log` call and unlocks the
 * 'console' achievement, which only the first call does. Installing twice on one window does
 * nothing the second time.
 */
export function installConsoleEgg(
  win: EggWindow,
  log: (line: string) => void,
  store: AchievementStore,
): void {
  const flagged = win as unknown as Record<string, boolean | undefined>;
  if (flagged[INSTALLED]) return;
  flagged[INSTALLED] = true;

  log(CONSOLE_ART);
  log(CONSOLE_HINT);

  win.help = () => {
    HELP_OUTPUT.forEach((line) => log(line));
    store.unlock('console');
  };
}
