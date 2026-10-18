// All easter-egg copy lives here, so the wording can change without touching any egg logic.
// House rules: English, every string fits in two lines, nothing private, no figures (the one
// exception is the application cycle in TERMINAL.catCv, which must match profile.yaml), and
// nothing in UNLOCKED.bio that the public pages do not already say.

import type { AchievementId } from '../lib/achievements';

/** Logged to the browser console on page load: a chirp's track on a time–frequency map. */
export const CONSOLE_ART: string = [
  '  f',
  '  ^   +-[ chirp ]------------------------+',
  '  |   |                           /      |',
  "  |   |                         .'       |",
  "  |   |                     _.-'         |",
  "  |   |             __..--''             |",
  "  |   |  ___...---''                     |",
  '  |   +----------------------------------+',
  '  +-----------------------------------------> t',
].join('\n');

export const CONSOLE_HINT: string = 'type help() for a hint';

/** Printed by help() in the console. The last line points at the backtick key. */
export const HELP_OUTPUT: string[] = [
  'Hello, curious visitor. A star just lit up in the footer.',
  "There are a few more around the site. The stars keep count, so you don't have to.",
  'Next: click back into the page and press the grave little key above Tab.',
];

export const TERMINAL: {
  banner: string[];
  help: string[];
  whoami: string[];
  sudo: string[];
  notFound: (cmd: string) => string;
  catCv: string[];
} = {
  banner: [
    'You found the back door. Nothing in here can break anything, so feel free to poke around.',
    "Type 'help' to see what it understands. Esc or 'exit' closes it.",
  ],
  help: [
    'help               show this list',
    'ls                 list the pages',
    'cd <page>          go to a page, e.g. cd projects',
    'cat cv             the short version of the CV',
    'open <paper-id>    jump to a paper, e.g. open prin',
    'whoami             a fair question',
    'theme dark|light   switch the color scheme',
    'clear              clear the screen',
    'exit               close the terminal (Esc works too)',
  ],
  whoami: [
    'you: a guest, evidently of the curious kind.',
    "me: Qiyi (Lucas) Xie. 'cat cv' has the short version.",
  ],
  sudo: [
    'sudo: permission denied. A static site has no root to escalate to.',
    'This incident will be reported to no one.',
  ],
  notFound: (cmd) => `${cmd}: command not found. Try 'help'.`,
  catCv: [
    'Qiyi (Lucas) Xie · M.S.E. student in Electrical Engineering, University of Pennsylvania',
    'Works on reliable restoration and detection from low-quality, low-SNR measurements.',
    'Seeking PhD positions starting Fall 2027.',
  ],
};

/** One riddle per footer star: enough to send a visitor looking, never the answer itself. */
export const STAR_HINTS: Record<AchievementId, string> = {
  console: 'Not everything this site says is printed on the page.',
  blackhole: 'Every map has an edge. Try walking off it.',
  terminal: 'There is a key you have probably never pressed on purpose.',
  cat: 'Spell out a curious animal. Against its nature, it comes when called.',
  chirp: 'The wave above every page can be heard as well as seen.',
  enhance: 'Somewhere among the projects, a picture is too dark for its own good. Linger on it.',
};

export const BLACKHOLE_COPY: { title: string; body: string; back: string } = {
  title: 'This page has collapsed into a black hole.',
  body: 'Whatever lived at this address has crossed the event horizon. The rest of the site is still in orbit.',
  back: 'Back to the home page',
};

/** The hidden page shown once every star is lit. */
export const UNLOCKED: { title: string; bio: string[]; certificateTitle: string } = {
  title: 'The unofficial bio',
  bio: [
    'You found every one. Officially, this page does not exist: it is left out of the sitemap and asks search engines to look away.',
    'The site is static and kept simple on purpose. The main pages stay quiet so they read quickly; the personality went into the corners.',
    'Getting here took opening the console, pressing keys nobody presses and walking off the edge of the map. Good research runs on the same habit.',
    'Off the record, the work is the same as on it: decide what the measurements actually support, then claim no more than that.',
    'Your stars live only in your browser. The certificate below is drawn there too and knows nothing about you but the date. Thanks for looking.',
  ],
  certificateTitle: 'Certificate of Curiosity',
};

/** The line on the certificate that leads into the site owner's name (see src/lib/certificate.ts). */
export const CERTIFICATE_LEAD = 'For finding every star hidden on the site of';

/** Caption shown on an enhance figure once it has brightened, e.g. ENHANCE_LABEL('Retinex'). */
export const ENHANCE_LABEL = (params: string): string => '✦ enhanced · ' + params;

/** Pill at the top-left of an enhance figure: how to start it, then how to let go once pinned. */
export const ENHANCE_HINT: { idle: string; pinned: string } = {
  idle: 'hover to enhance',
  pinned: 'pinned · click to release',
};
