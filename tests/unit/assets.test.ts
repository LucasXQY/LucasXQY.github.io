import { describe, expect, it } from 'vitest';
import { resolveAsset } from '../../src/lib/assets';

describe('resolveAsset', () => {
  it('rejects with an error naming the missing path', async () => {
    await expect(resolveAsset('src/assets/nope.png')).rejects.toThrow('asset not found');
    await expect(resolveAsset('src/assets/nope.png')).rejects.toThrow(/nope\.png/);
  });

  it('treats a leading slash as the same path and echoes the input in the message', async () => {
    await expect(resolveAsset('/src/assets/nope.png')).rejects.toThrow(
      'asset not found: /src/assets/nope.png',
    );
  });
});
