import type { Directory } from 'expo-file-system';
import type { ImagePickerOptions, ImagePickerResult } from 'expo-image-picker';

import type { PhotoOrigin } from '../domain/types';
import { stripJpegMetadata } from '../lib/jpegMetadata';
import type { CapabilityStatus } from './capabilities';

/**
 * Photos for a marked day of a challenge (ADR-0051 §15): taking or choosing one, and
 * turning it into the two files the app keeps. Three Expo modules, all behind this file:
 *
 * - **expo-image-picker** opens the system's camera and the system's photo picker. The
 *   picker needs no permission: PHPicker on iOS, the Photo Picker on Android
 *   (`legacy: false`), which is also why app.json blocks the storage permissions the
 *   module declares. The camera asks for its permission when "Tomar una foto" is tapped
 *   and not before (rule 8). The EXIF is never requested: nothing here reads where or
 *   when a photo was taken, least of all to judge a mark.
 * - **expo-image-manipulator** decodes, turns the pixels upright and re-encodes. On iOS,
 *   `manipulate()` always runs a fix-orientation step first, which redraws the image so
 *   the pixels match what the EXIF orientation said; on Android the loader (Glide)
 *   applies the EXIF rotation while decoding. Either way the image that is resized and
 *   saved is upright in its pixels, and its width and height are the upright ones.
 * - **expo-file-system** (the `File`/`Directory`/`Paths` API of SDK 57) reads the
 *   re-encoded bytes and writes them to `Paths.document/photos/`.
 *
 * Between the two, `stripJpegMetadata` drops every APP1 (Exif, XMP), APP13 (IPTC) and
 * COM segment. The re-encode already leaves no GPS (the pixels are redrawn and the
 * encoders write none), and this makes it a guarantee with a test instead of a property
 * of two native encoders. A file the stripper cannot walk is not written at all.
 *
 * The database keeps file **names**, never paths: the iOS container moves between
 * launches and installs. `photoUri` turns a name back into a `file://` URI.
 *
 * Nothing here is imported at load time but types and the pure stripper. This file is
 * reached from the photo store, which the circle store's tests load under vitest, where
 * React Native and native modules do not exist. The modules, the platform facts and the
 * dictionary are required lazily, each in a try/catch, and every failure is logged and
 * turned into "unavailable" instead of thrown into a screen. The one exception is
 * `preparePhoto`: its contract has no failure value, so it rejects, after removing
 * whatever it had written.
 */

export type PickedPhoto = { uri: string; width: number; height: number; origin: PhotoOrigin };
export type PreparedPhoto = { fullFile: string; thumbFile: string; width: number; height: number };
export type PickOutcome = PickedPhoto | 'cancelled' | 'denied' | 'unavailable';

/** ADR-0051 §15: about 200 KB for the full image, and a thumbnail for the grid and the album. */
const FULL_LONG_SIDE = 1280;
const THUMB_LONG_SIDE = 320;
const JPEG_QUALITY = 0.7;

const PHOTOS_DIRECTORY = 'photos';
const FULL_SUFFIX = '.jpg';
const THUMB_SUFFIX = '.thumb.jpg';

/**
 * Android 10. Below it, expo-image-picker's camera also demands WRITE_EXTERNAL_STORAGE,
 * and app.json blocks that permission so the Photo Picker is the only way into the
 * library. Asking for it would be refused by the system without a dialog, so on
 * Android 8 and 9 the camera is reported as unavailable instead of as denied.
 */
const ANDROID_10_API = 29;

/**
 * The picker returns the photo as it is (quality 1, no crop, no EXIF, no base64): the
 * only re-encode is the manipulator's, so the image is compressed once.
 */
const PICK_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  allowsMultipleSelection: false,
  quality: 1,
  exif: false,
  base64: false,
  legacy: false,
};

const AVAILABLE: CapabilityStatus = { available: true, reason: null };

function report(where: string, error: unknown): void {
  console.warn(`[camera] ${where} failed`, error);
}

// --- Lazy modules -------------------------------------------------------------------------

type PickerModule = typeof import('expo-image-picker');
type ManipulatorModule = typeof import('expo-image-manipulator');
type FileSystemModule = typeof import('expo-file-system');
type ImageRef = import('expo-image-manipulator').ImageRef;

/** Undefined until the first load; null when the module cannot be used here. */
let pickerCached: PickerModule | null | undefined;
let manipulatorCached: ManipulatorModule | null | undefined;
let fileSystemCached: FileSystemModule | null | undefined;

function picker(): PickerModule | null {
  if (pickerCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest and in older builds
      const loaded = require('expo-image-picker') as PickerModule;
      pickerCached = typeof loaded.launchImageLibraryAsync === 'function' ? loaded : null;
    } catch {
      pickerCached = null;
    }
  }
  return pickerCached;
}

function manipulator(): ManipulatorModule | null {
  if (manipulatorCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest and in older builds
      const loaded = require('expo-image-manipulator') as ManipulatorModule;
      manipulatorCached = typeof loaded.ImageManipulator?.manipulate === 'function' ? loaded : null;
    } catch {
      manipulatorCached = null;
    }
  }
  return manipulatorCached;
}

function fileSystem(): FileSystemModule | null {
  if (fileSystemCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: native, absent under vitest
      const loaded = require('expo-file-system') as FileSystemModule;
      fileSystemCached = typeof loaded.File === 'function' ? loaded : null;
    } catch {
      fileSystemCached = null;
    }
  }
  return fileSystemCached;
}

type Facts = { isIos: boolean; isAndroid: boolean; isDevice: boolean; androidApi: number | null };

let factsCached: Facts | undefined;

/** capabilities.ts, read lazily: it loads React Native and expo-constants. */
function facts(): Facts {
  if (factsCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: loads React Native, absent under vitest
      const capabilities = require('./capabilities') as typeof import('./capabilities');
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: same reason
      const { Platform } = require('react-native') as typeof import('react-native');
      factsCached = {
        isIos: capabilities.isIos,
        isAndroid: capabilities.isAndroid,
        isDevice: capabilities.isDevice,
        androidApi: capabilities.isAndroid && typeof Platform.Version === 'number' ? Platform.Version : null,
      };
    } catch {
      factsCached = { isIos: false, isAndroid: false, isDevice: false, androidApi: null };
    }
  }
  return factsCached;
}

/** Read at call time, never cached: the language can change while the app runs (ADR-0020). */
function reason(key: 'cameraUnavailable' | 'pickerUnavailable'): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the dictionary's store loads native modules
    const { getStrings } = require('../i18n') as typeof import('../i18n');
    return getStrings().photos[key];
  } catch {
    return null;
  }
}

// --- Status -------------------------------------------------------------------------------

/**
 * The photo capability as a whole ('camera' in CapabilityName): the picker, the
 * manipulator and the file system are in this build. Choosing from the library needs
 * nothing more, so wherever this is available a photo can be added.
 */
export function status(): CapabilityStatus {
  const { isIos, isAndroid } = facts();
  const ready = (isIos || isAndroid) && picker() !== null && manipulator() !== null && fileSystem() !== null;
  return ready ? AVAILABLE : { available: false, reason: reason('pickerUnavailable') };
}

/**
 * The camera specifically. Not in the iOS simulator, which has none (and where opening
 * it would crash the picker), and not on Android 8 and 9 (see ANDROID_10_API). Says
 * nothing about the permission: that is asked, and answered, in `takePhoto`.
 */
export function cameraStatus(): CapabilityStatus {
  const whole = status();
  if (!whole.available) {
    return whole;
  }
  const { isIos, isAndroid, isDevice, androidApi } = facts();
  if (isIos && !isDevice) {
    return { available: false, reason: reason('cameraUnavailable') };
  }
  if (isAndroid && androidApi !== null && androidApi < ANDROID_10_API) {
    return { available: false, reason: reason('cameraUnavailable') };
  }
  return AVAILABLE;
}

// --- Taking and choosing ------------------------------------------------------------------

function outcomeOf(result: ImagePickerResult, origin: PhotoOrigin): PickOutcome {
  if (result.canceled) {
    return 'cancelled';
  }
  const asset = result.assets[0];
  if (asset === undefined || typeof asset.uri !== 'string' || asset.uri === '') {
    return 'cancelled';
  }
  return { uri: asset.uri, width: asset.width, height: asset.height, origin };
}

/** The picker's rejections carry a code; the permission ones say so in it. */
function isPermissionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' && code.toUpperCase().includes('PERMISSION');
}

/**
 * The system camera. Asks for the camera permission here, when the user tapped "Tomar
 * una foto" (rule 8): 'denied' when they say no, or said no before and the system will
 * not ask again (only Settings can change it then). The library stays available either
 * way.
 */
export async function takePhoto(): Promise<PickOutcome> {
  const imagePicker = picker();
  if (imagePicker === null || !cameraStatus().available) {
    return 'unavailable';
  }
  try {
    const permission = await imagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return 'denied';
    }
  } catch (error) {
    report('requestCameraPermissionsAsync', error);
    return 'unavailable';
  }
  try {
    return outcomeOf(await imagePicker.launchCameraAsync(PICK_OPTIONS), 'camera');
  } catch (error) {
    report('launchCameraAsync', error);
    // Android asks again inside launchCameraAsync and rejects if it is refused there.
    return isPermissionError(error) ? 'denied' : 'unavailable';
  }
}

/**
 * The system photo picker: PHPicker on iOS, the Photo Picker on Android (backported by
 * Google Play services below Android 13). Neither asks for a permission, and Vesper
 * only sees the one photo the user chose.
 */
export async function pickPhoto(): Promise<PickOutcome> {
  const imagePicker = picker();
  if (imagePicker === null || !status().available) {
    return 'unavailable';
  }
  try {
    return outcomeOf(
      await imagePicker.launchImageLibraryAsync({
        ...PICK_OPTIONS,
        selectionLimit: 1,
        // iOS: a JPEG the system transcodes, not the library's own file. The original
        // can be a HEIC or a wide-gamut image the manipulator's orientation step cannot
        // draw ("Image context has been lost"), seen with the simulator's sample HEIC.
        preferredAssetRepresentationMode: imagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }),
      'library',
    );
  } catch (error) {
    report('launchImageLibraryAsync', error);
    return 'unavailable';
  }
}

// --- Preparing ----------------------------------------------------------------------------

/** A size whose long side is `longSide`, or null when the image is already that small. */
function fitLongSide(width: number, height: number, longSide: number): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (!(width > 0) || !(height > 0) || long <= longSide) {
    return null;
  }
  const scale = longSide / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Releasable = { release(): void };

/**
 * `source` resized so its long side is `longSide`, or `source` itself when it is not
 * larger. Width and height are both given, rounded, so both platforms produce the exact
 * same size instead of each rounding the derived side its own way.
 */
async function scaled(
  modules: ManipulatorModule,
  source: ImageRef,
  longSide: number,
  held: Releasable[],
): Promise<ImageRef> {
  const size = fitLongSide(source.width, source.height, longSide);
  if (size === null) {
    return source;
  }
  const context = modules.ImageManipulator.manipulate(source);
  held.push(context);
  const image = await context.resize(size).renderAsync();
  held.push(image);
  return image;
}

function photosDirectory(fs: FileSystemModule): Directory {
  return new fs.Directory(fs.Paths.document, PHOTOS_DIRECTORY);
}

/**
 * A name this file may join to the photos directory: letters, digits, dots, dashes and
 * underscores, not starting with a dot. A UUID with its suffix always is; anything with
 * a slash or `..` never is.
 */
function isSafeName(name: string): boolean {
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name) && !name.includes('..');
}

/** Reads the manipulator's JPEG, strips it and writes it under `name`. Fails closed. */
async function writeStripped(fs: FileSystemModule, sourceUri: string, name: string): Promise<void> {
  const bytes = await new fs.File(sourceUri).bytes();
  const clean = stripJpegMetadata(bytes);
  if (clean === bytes) {
    // Handed back untouched means it could not be walked, so it cannot be vouched for.
    throw new Error('the encoded image is not a JPEG the stripper can read');
  }
  new fs.File(photosDirectory(fs), name).write(clean);
}

function withoutScheme(uri: string): string {
  return uri.replace(/^file:\/\//, '').replace(/\/+$/, '');
}

/**
 * Removes the temporary files: what the manipulator saved, and the picker's copy of the
 * original, which still has every tag it came with. Only inside the app's cache, where
 * both modules write; a URI anywhere else is left alone.
 */
function deleteTemporary(fs: FileSystemModule, uris: readonly string[]): void {
  let cache: string;
  try {
    cache = withoutScheme(fs.Paths.cache.uri);
  } catch (error) {
    report('Paths.cache', error);
    return;
  }
  for (const uri of uris) {
    if (!uri.startsWith('file://') || !withoutScheme(uri).startsWith(`${cache}/`)) {
      continue;
    }
    try {
      const file = new fs.File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      report('delete a temporary file', error);
    }
  }
}

/**
 * Turns a picked photo into the two files the app keeps, `<id>.jpg` (long side 1280 px)
 * and `<id>.thumb.jpg` (long side 320 px), both JPEG at 0.7, upright in their pixels and
 * with no metadata, in `Paths.document/photos/`. Width and height are the full image's,
 * after the orientation was applied.
 *
 * The picked file is consumed: the picker's copy of the original is deleted here,
 * whether this succeeds or not, so show the preview from `photoUri(prepared.fullFile)`.
 * Rejects when the photo cannot be prepared, and leaves nothing behind for this id.
 */
export async function preparePhoto(picked: PickedPhoto, id: string): Promise<PreparedPhoto> {
  const fs = fileSystem();
  const modules = manipulator();
  if (fs === null || modules === null) {
    throw new Error('[camera] preparePhoto: this build cannot process photos');
  }
  const fullFile = `${id}${FULL_SUFFIX}`;
  const thumbFile = `${id}${THUMB_SUFFIX}`;
  if (!isSafeName(fullFile)) {
    throw new Error('[camera] preparePhoto: the id cannot name a file');
  }

  const held: Releasable[] = [];
  const temporary: string[] = [picked.uri];
  try {
    photosDirectory(fs).create({ intermediates: true, idempotent: true });

    // Decoded and upright: from here on width and height are the ones people see.
    const loaded = modules.ImageManipulator.manipulate(picked.uri);
    held.push(loaded);
    const upright = await loaded.renderAsync();
    held.push(upright);

    const full = await scaled(modules, upright, FULL_LONG_SIDE, held);
    // The thumbnail comes from the full image: cheaper, and the same pixels.
    const thumb = await scaled(modules, full, THUMB_LONG_SIDE, held);

    const savedFull = await full.saveAsync({ format: modules.SaveFormat.JPEG, compress: JPEG_QUALITY });
    temporary.push(savedFull.uri);
    const savedThumb = await thumb.saveAsync({ format: modules.SaveFormat.JPEG, compress: JPEG_QUALITY });
    temporary.push(savedThumb.uri);

    await writeStripped(fs, savedFull.uri, fullFile);
    await writeStripped(fs, savedThumb.uri, thumbFile);

    return { fullFile, thumbFile, width: savedFull.width, height: savedFull.height };
  } catch (error) {
    report('preparePhoto', error);
    deletePhotoFiles([fullFile, thumbFile]);
    throw error instanceof Error ? error : new Error('[camera] preparePhoto failed');
  } finally {
    for (const object of held) {
      try {
        object.release();
      } catch {
        // Already released, or the runtime is gone: nothing left to free.
      }
    }
    deleteTemporary(fs, temporary);
  }
}

// --- Files --------------------------------------------------------------------------------

/** The `file://` URI for an `<Image>`, or null when there is no name or the file is gone. */
export function photoUri(file: string | null): string | null {
  if (file === null || !isSafeName(file)) {
    return null;
  }
  const fs = fileSystem();
  if (fs === null) {
    return null;
  }
  try {
    const handle = new fs.File(photosDirectory(fs), file);
    return handle.exists ? handle.uri : null;
  } catch (error) {
    report('photoUri', error);
    return null;
  }
}

/** Deletes these files from the photos directory. Null names and missing files are skipped. */
export function deletePhotoFiles(files: readonly (string | null)[]): void {
  const fs = fileSystem();
  if (fs === null) {
    return;
  }
  for (const name of files) {
    if (name === null || !isSafeName(name)) {
      continue;
    }
    try {
      const handle = new fs.File(photosDirectory(fs), name);
      if (handle.exists) {
        handle.delete();
      }
    } catch (error) {
      report('deletePhotoFiles', error);
    }
  }
}

/** Deletes the photos directory and everything in it ("Borrar todo y reiniciar"). */
export function deleteAllPhotoFiles(): void {
  const fs = fileSystem();
  if (fs === null) {
    return;
  }
  try {
    const directory = photosDirectory(fs);
    if (directory.exists) {
      directory.delete();
    }
  } catch (error) {
    report('deleteAllPhotoFiles', error);
  }
}
