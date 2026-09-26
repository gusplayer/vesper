import { describe, expect, it } from 'vitest';

import { captureView, cardStatus, fileUrl, releaseCapture, shareFile, status, utiOf } from './share';

describe('fileUrl', () => {
  it('turns the bare path view-shot gives on iOS into a file URL', () => {
    expect(fileUrl('/private/var/mobile/Containers/Data/Application/A1/tmp/ReactNative/B2.png')).toBe(
      'file:///private/var/mobile/Containers/Data/Application/A1/tmp/ReactNative/B2.png',
    );
  });

  it('leaves a file URI as it is', () => {
    expect(fileUrl('file:///data/user/0/com.gusplayer.vesper/cache/ReactNative-snapshot-image1.png')).toBe(
      'file:///data/user/0/com.gusplayer.vesper/cache/ReactNative-snapshot-image1.png',
    );
  });

  it('encodes what a URL cannot carry as it is', () => {
    expect(fileUrl('/Users/me/Library/Developer/Core Simulator/x.png')).toBe(
      'file:///Users/me/Library/Developer/Core%20Simulator/x.png',
    );
  });
});

describe('utiOf', () => {
  it('names the type iOS reads for each image', () => {
    expect(utiOf('image/png')).toBe('public.png');
    expect(utiOf('image/jpeg')).toBe('public.jpeg');
  });
});

// Under vitest there is no React Native and no native module: the situation of a dev
// client built before expo-sharing and view-shot. Nothing may throw into a screen.
describe('platform/share without its native modules', () => {
  it('reports the sheet and the card as unavailable', () => {
    expect(status().available).toBe(false);
    expect(cardStatus().available).toBe(false);
  });

  it('shares nothing, captures nothing, and releasing is a quiet no-op', async () => {
    await expect(shareFile('file:///photos/a.jpg', 'image/jpeg')).resolves.toBe('unavailable');
    await expect(captureView({ current: null })).resolves.toBeNull();
    expect(() => releaseCapture('/tmp/ReactNative/a.png')).not.toThrow();
  });
});
