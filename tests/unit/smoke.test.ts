import { expect, test } from 'vitest';
import { SITE_TITLE } from '../../src/site.config';

test('site title is configured', () => {
  expect(SITE_TITLE).toBe('Qiyi (Lucas) Xie');
});
