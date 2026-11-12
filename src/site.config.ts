export const GITHUB_USERNAME = 'LucasXQY';
export const SITE_URL = `https://${GITHUB_USERNAME.toLowerCase()}.github.io`;
export const SITE_TITLE = 'Qiyi (Lucas) Xie';
export const SELF_NAMES = ['Qiyi Xie', 'Q. Xie', 'Qiyi (Lucas) Xie'] as const;
// ponytail: the CV page is hidden for now. To bring it back, set this to true and rename
// src/pages/_cv.astro back to cv.astro (Astro skips files that start with an underscore).
export const SHOW_CV = false;
// The visitor map under the home-page sidebar (mapmyvisitors.com). Generate a widget there for
// SITE_URL and paste the value of `d=` from its script address here. Empty hides the widget.
export const MAPMYVISITORS_TOKEN = 'aaWwN0na5uVn8Mv6iZo7uZS5gBrtMn7qklaAfNYp4gU';
