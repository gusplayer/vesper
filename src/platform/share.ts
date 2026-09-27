import type { RefObject } from 'react';
import type { View } from 'react-native';

import type { CapabilityStatus } from './capabilities';

/**
 * Taking something of yours out of the app (ADR-0051 §13, ADR-0030): a file handed to
 * the system's share sheet, where the person saves it to their photos or sends it
 * wherever they like, and the image of a view to hand it. Two native modules, both
 * behind this file:
 *
 * - **expo-sharing** opens the sheet for one local file: `UIActivityViewController` on
 *   iOS, whose "Guardar imagen" writes to the photo library (which is why app.json
 *   carries `NSPhotoLibraryAddUsageDescription`), and an `ACTION_SEND` chooser through
 *   the module's own FileProvider on Android, where saving goes through Google Photos
 *   or Files. It resolves when the sheet is closed, and says nothing about what was
 *   chosen: Vesper does not know whether anything was shared, and does not count it.
 * - **react-native-view-shot**, pinned to 5.1.1 (5.1.0, the one SDK 57 names, fails in
 *   bridgeless), captures a mounted view to a PNG in the temporary directory.
 *
 * No config plugin: expo-sharing's is for receiving shares, which Vesper does not do.
 * Nothing leaves the phone through here but what the person picks in the sheet.
 *
 * Like the rest of `platform/`, the modules and the dictionary are required lazily in
 * a try/catch: under vitest, and in a dev client built before these modules, every
 * function degrades to "unavailable" instead of throwing into a screen.
 */

export type ShareMime = 'image/png' | 'image/jpeg';

/** 'closed': the sheet opened and was closed, whatever the person did in it. */
export type ShareOutcome = 'closed' | 'unavailable' | 'failed';

/** iOS reads the type from the UTI, Android from the MIME type. */
const UTI: Record<ShareMime, string> = {
  'image/png': 'public.png',
  'image/jpeg': 'public.jpeg',
};

const AVAILABLE: CapabilityStatus = { available: true, reason: null };

function report(where: string, error: unknown): void {
  console.warn(`[share] ${where} failed`, error);
}

// --- Pure ---------------------------------------------------------------------------------

/**
 * A `file://` URL for a local file. view-shot answers with a bare path on iOS
 * (`/private/var/…/tmp/ReactNative/….png`) and with a `file://` URI on Android, and
 * expo-sharing only takes the second: without a scheme, iOS refuses the file.
 */
export function fileUrl(uriOrPath: string): string {
  return uriOrPath.startsWith('/') ? `file://${encodeURI(uriOrPath)}` : uriOrPath;
}

export function utiOf(mimeType: ShareMime): string {
  return UTI[mimeType];
}

// --- Lazy modules -------------------------------------------------------------------------

type SharingModule = typeof import('expo-sharing');

/**
 * The part of react-native-view-shot this file uses, written here instead of imported:
 * under Expo's `react-native` resolution condition its types are its TypeScript source,
 * which does not pass this project's `noUnusedLocals`. `view` is a mounted host view,
 * which the library resolves with `findNodeHandle`.
 */
type ViewShotModule = {
  captureRef: (
    view: unknown,
    options: { format: 'png' | 'jpg'; quality: number; result: 'tmpfile' },
  ) => Promise<string>;
  releaseCapture: (uri: string) => void;
};

/** Undefined until the first load; null when the module cannot be used here. */
let sharingCached: SharingModule | null | undefined;
let viewShotCached: ViewShotModule | null | undefined;
let mobileCached: boolean | undefined;

function sharing(): SharingModule | null {
  if (sharingCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest and in older builds
      const loaded = require('expo-sharing') as SharingModule;
      sharingCached = typeof loaded.shareAsync === 'function' ? loaded : null;
    } catch {
      sharingCached = null;
    }
  }
  return sharingCached;
}

/**
 * view-shot's JavaScript is in every bundle, but its native half only in a build made
 * after it was added: without it `captureRef` throws, so the module counts only when
 * React Native can find `RNViewShot` (a TurboModule, or the legacy bridge's).
 */
function viewShot(): ViewShotModule | null {
  if (viewShotCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: loads React Native, absent under vitest
      const { NativeModules, TurboModuleRegistry } = require('react-native') as typeof import('react-native');
      const native: unknown = TurboModuleRegistry.get('RNViewShot') ?? NativeModules.RNViewShot;
      if (native === null || native === undefined) {
        viewShotCached = null;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest and in older builds
        const loaded = require('react-native-view-shot') as ViewShotModule;
        viewShotCached = typeof loaded.captureRef === 'function' ? loaded : null;
      }
    } catch {
      viewShotCached = null;
    }
  }
  return viewShotCached;
}

/** capabilities.ts, read lazily: it loads React Native and expo-constants. */
function mobile(): boolean {
  if (mobileCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: loads React Native, absent under vitest
      const capabilities = require('./capabilities') as typeof import('./capabilities');
      mobileCached = capabilities.isIos || capabilities.isAndroid;
    } catch {
      mobileCached = false;
    }
  }
  return mobileCached;
}

/** Read at call time, never cached: the language can change while the app runs (ADR-0020). */
function reason(key: 'unavailable' | 'cardUnavailable'): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the dictionary's store loads native modules
    const { getStrings } = require('../i18n') as typeof import('../i18n');
    return getStrings().photos.share[key];
  } catch {
    return null;
  }
}

// --- Status -------------------------------------------------------------------------------

/**
 * The system's share sheet ('share' in CapabilityName): enough to hand over a file that
 * already exists, like a photo of yours. Synchronous: `isAvailableAsync` only answers
 * something other than yes on the web, which Vesper does not run on.
 */
export function status(): CapabilityStatus {
  return mobile() && sharing() !== null ? AVAILABLE : { available: false, reason: reason('unavailable') };
}

/** The sheet and the capture: what "Compartir tu álbum" needs to make its image and hand it over. */
export function cardStatus(): CapabilityStatus {
  const sheet = status();
  if (!sheet.available) {
    return sheet;
  }
  return viewShot() !== null ? AVAILABLE : { available: false, reason: reason('cardUnavailable') };
}

// --- Sharing ------------------------------------------------------------------------------

/**
 * Opens the system's share sheet with one local file and resolves once it is closed.
 * 'unavailable' when this build has no sheet, 'failed' when it would not open (a file
 * it cannot read, another sheet still up). Never throws.
 */
export async function shareFile(uri: string, mimeType: ShareMime): Promise<ShareOutcome> {
  const sheet = sharing();
  if (sheet === null || !mobile()) {
    return 'unavailable';
  }
  try {
    await sheet.shareAsync(fileUrl(uri), { mimeType, UTI: utiOf(mimeType) });
    return 'closed';
  } catch (error) {
    report('shareAsync', error);
    return 'failed';
  }
}

/**
 * The view behind `ref` as a PNG in the temporary directory, at the view's size in
 * physical pixels: size the view in points for the pixels you want (AlbumCard does).
 * No `width`/`height` on purpose: view-shot reads them as points on iOS and as pixels
 * on Android. Null when there is no view or no capture here, or it failed.
 *
 * The file is the caller's until `releaseCapture`: hand it to `shareFile`, and release
 * it once the sheet that made it is gone.
 */
export async function captureView(ref: RefObject<View | null>): Promise<string | null> {
  const shot = viewShot();
  const view = ref.current;
  if (shot === null || view === null) {
    return null;
  }
  try {
    return await shot.captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch (error) {
    report('captureRef', error);
    return null;
  }
}

/**
 * Deletes a capture. view-shot only deletes inside its own temporary directory, and
 * wants the URI exactly as `captureView` gave it.
 */
export function releaseCapture(uri: string): void {
  const shot = viewShot();
  if (shot === null) {
    return;
  }
  try {
    shot.releaseCapture(uri);
  } catch (error) {
    report('releaseCapture', error);
  }
}
