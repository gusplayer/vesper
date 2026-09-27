import { describe, expect, it } from 'vitest';

import { cameraStatus, deleteAllPhotoFiles, deletePhotoFiles, photoUri, pickPhoto, preparePhoto, status, takePhoto } from './camera';

// Under vitest there is no React Native and no native module, which is exactly the
// situation of a build without expo-image-picker. The photo store imports this file and
// the circle store's tests import the photo store, so loading it here must not throw,
// and every function must degrade to "unavailable" instead.

describe('platform/camera without its native modules', () => {
  it('reports the photo capability and the camera as unavailable', () => {
    expect(status().available).toBe(false);
    expect(cameraStatus().available).toBe(false);
  });

  it('takes and picks nothing', async () => {
    await expect(takePhoto()).resolves.toBe('unavailable');
    await expect(pickPhoto()).resolves.toBe('unavailable');
  });

  it('rejects preparing a photo, since there is nothing to prepare it with', async () => {
    await expect(
      preparePhoto({ uri: 'file:///cache/picked.jpg', width: 4032, height: 3024, origin: 'library' }, 'abc'),
    ).rejects.toThrow();
  });

  it('has no URI for a file, and deleting is a quiet no-op', () => {
    expect(photoUri(null)).toBeNull();
    expect(photoUri('0199a1b2-c3d4-7e5f-8a9b-000000000001.jpg')).toBeNull();
    expect(() => deletePhotoFiles(['a.jpg', null, '../escape.jpg'])).not.toThrow();
    expect(() => deleteAllPhotoFiles()).not.toThrow();
  });
});
