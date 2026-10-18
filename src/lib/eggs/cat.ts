// The pixel cat easter egg. Typing "cat" (see Base.astro) loads the vendored oneko.js, which puts a
// cat on the page that chases the pointer. Typing it again, or calling window.qxToggleCat(), sends
// the cat away.
//
// oneko.js (public/oneko/, MIT, adryd325/oneko.js) starts itself the moment it runs, so it is only
// loaded when the cat is called, never with the page. It is one closure that makes a single
// `#oneko` div and stops its animation loop on its own once that div leaves the document. So:
//   - hiding the cat removes the element, which ends the loop (nothing keeps running unseen), and
//   - showing it again injects the script again for a new closure and a fresh element. The old
//     closure leaves one idle mousemove listener behind, which is a few bytes and does no work.
// oneko.js also returns early under prefers-reduced-motion; we check that first so no script is
// fetched and no star is given for a cat the visitor will never see.

import { store } from '../achievements';

const SCRIPT_SRC = '/oneko/oneko.js';
// oneko.js reads this from its own <script data-cat>. Its default, ./oneko.gif, is resolved against
// the page, so it would be /cv/oneko.gif on the CV page.
const SPRITE_SRC = '/oneko/oneko.gif';
const CAT_ID = 'oneko';

/** The script element while oneko.js is being fetched; a toggle in that window is ignored. */
let loading: HTMLScriptElement | null = null;

const catElement = (): HTMLElement | null => document.getElementById(CAT_ID);

export function isCatVisible(): boolean {
  return catElement() !== null;
}

function summon(): void {
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.dataset.cat = SPRITE_SRC;
  // Without this oneko.js keeps the cat's position in localStorage between pages. The cat does not
  // follow the visitor from page to page, so there is nothing to restore, and it would also fail
  // if storage is blocked.
  script.dataset.persistPosition = 'false';

  const done = (): void => {
    script.remove(); // the script has run; the element is only clutter
    loading = null;
    const cat = catElement();
    // oneko.js sets `ariaHidden` and pointer-events: none itself. The first is the ARIA reflection
    // property, which older browsers lack (there it would not become an attribute), so set it here.
    cat?.setAttribute('aria-hidden', 'true');
    cat?.classList.add('egg'); // global.css hides .egg in print, so the cat is not on a printed CV
  };
  script.addEventListener('load', done);
  script.addEventListener('error', done);

  loading = script;
  document.body.append(script);
}

/** Calls the cat in, or sends it away if it is out. Does nothing under reduced motion. */
export function toggleCat(): void {
  if (loading) return;

  const cat = catElement();
  if (cat) {
    cat.remove();
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  summon();
  store.unlock('cat'); // does nothing after the first time
}
