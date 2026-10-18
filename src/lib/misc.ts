import type { Misc } from '../schemas';

/**
 * True when the Misc data has nothing to show: no hobbies, no games (listed or playing now) and no
 * music (playlists or an embed). The intro alone does not count, since a page that is only a
 * sentence is not worth a nav entry. Used to decide whether the nav links to /misc/.
 */
export function isMiscEmpty(misc: Misc): boolean {
  return (
    misc.hobbies.length === 0 &&
    misc.games.list.length === 0 &&
    misc.games.nowPlaying === undefined &&
    misc.music.playlists.length === 0 &&
    misc.music.embedUrl === undefined
  );
}
