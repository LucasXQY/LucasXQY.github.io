// Watches a stream of keydown events for a secret word. Pure: it reads a few fields off each event
// and never touches the DOM, so it unit-tests with plain objects.

type KeyInput = Pick<KeyboardEvent, 'key' | 'target' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** True for fields where a key is just a character being typed. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  return (
    !!el && (!!el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? ''))
  );
}

/**
 * Returns a keydown handler that calls `onMatch` each time `seq` has been typed, one printable
 * character after another, in any letter case. The buffer is cleared on a match, so the tail of one
 * match never starts the next. Keys typed into a text field or with Ctrl, Meta or Alt held are not
 * part of the word, and they also drop whatever was half typed. Keys that are not one character
 * (Shift, arrows, ...) are skipped without breaking the run, so capital letters still count.
 */
export function createSequenceWatcher(seq: string, onMatch: () => void): (e: KeyInput) => void {
  const want = seq.toLowerCase();
  let typed = '';

  return (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) {
      typed = '';
      return;
    }
    if (!want || e.key.length !== 1) return;

    // The last want.length characters are all that can still matter, and a mismatch just slides
    // out of the window: "cacat" ends in "cat" without any special handling.
    typed = (typed + e.key.toLowerCase()).slice(-want.length);
    if (typed === want) {
      typed = '';
      onMatch();
    }
  };
}
