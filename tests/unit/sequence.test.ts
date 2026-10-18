import { describe, expect, it, vi } from 'vitest';
import { createSequenceWatcher } from '../../src/lib/eggs/sequence';

type Input = Parameters<ReturnType<typeof createSequenceWatcher>>[0];

/** A keydown reduced to what the watcher reads. `target` is a plain object: the watcher is DOM-free. */
function press(
  key: string,
  extra: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {},
  target: unknown = null,
): Input {
  return {
    key,
    target: target as EventTarget | null,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...extra,
  };
}

function setup(seq = 'cat') {
  const onMatch = vi.fn<() => void>();
  const feed = createSequenceWatcher(seq, onMatch);
  const type = (text: string, extra = {}, target: unknown = null) =>
    [...text].forEach((key) => feed(press(key, extra, target)));
  return { onMatch, feed, type };
}

describe('createSequenceWatcher', () => {
  it('fires once when the sequence is typed', () => {
    const { onMatch, type } = setup();
    type('cat');
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a partial sequence', () => {
    const { onMatch, type } = setup();
    type('ca');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('does not fire when another key comes between', () => {
    const { onMatch, type } = setup();
    type('cxat');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('matches case-insensitively', () => {
    const { onMatch, type } = setup();
    type('CAT');
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('finds the sequence after unrelated keys and after an overlapping start', () => {
    const { onMatch, type } = setup();
    type('xyzcat');
    expect(onMatch).toHaveBeenCalledTimes(1);
    type('cacat');
    expect(onMatch).toHaveBeenCalledTimes(2);
  });

  it('fires once for c, a, c, a, t', () => {
    const { onMatch, type } = setup();
    type('cacat');
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('clears the buffer on a match, so the tail of one match does not start the next', () => {
    const { onMatch, type } = setup();
    type('catcat');
    expect(onMatch).toHaveBeenCalledTimes(2);
    type('at');
    expect(onMatch).toHaveBeenCalledTimes(2);
  });

  it('matches again after a first match', () => {
    const { onMatch, type } = setup();
    type('cat');
    type('cat');
    expect(onMatch).toHaveBeenCalledTimes(2);
  });

  it('ignores keys that are not one character, such as Shift', () => {
    const { onMatch, feed } = setup();
    feed(press('Shift'));
    feed(press('C'));
    feed(press('Shift'));
    feed(press('A'));
    feed(press('Shift'));
    feed(press('T'));
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('does not fire for a %s target', (tagName) => {
    const { onMatch, type } = setup();
    type('cat', {}, { tagName });
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('does not fire for a contenteditable target', () => {
    const { onMatch, type } = setup();
    type('cat', {}, { tagName: 'DIV', isContentEditable: true });
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('fires for ordinary targets', () => {
    const { onMatch, type } = setup();
    type('cat', {}, { tagName: 'BODY', isContentEditable: false });
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('drops a half-typed sequence when focus moves into a field', () => {
    const { onMatch, type } = setup();
    type('ca');
    type('x', {}, { tagName: 'INPUT' });
    type('t');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('does not fire with %s held', (modifier) => {
    const { onMatch, type } = setup();
    type('cat', { [modifier]: true });
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('drops a half-typed sequence when a shortcut comes between', () => {
    const { onMatch, type } = setup();
    type('ca');
    type('x', { ctrlKey: true });
    type('t');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('works for any sequence and a never-matching empty one', () => {
    const konami = setup('ab');
    konami.type('aab');
    expect(konami.onMatch).toHaveBeenCalledTimes(1);

    const empty = setup('');
    empty.type('anything');
    expect(empty.onMatch).not.toHaveBeenCalled();
  });
});
