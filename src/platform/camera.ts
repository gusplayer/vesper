import { getStrings } from '../i18n';
import { isDevice, type CapabilityStatus } from './capabilities';

/**
 * The camera, and only for reading a key's code (ADR-0035).
 *
 * This is the first capability that lets the outside world change what the app is
 * doing, so it is deliberately narrow: no photos, no video, no microphone, no library.
 * The view itself is `src/platform/CameraScanner.tsx`, next to `BlockingSelectionView`,
 * because a native view cannot live in the design system.
 *
 * ADR-0021 decided there would be no scanner and no camera permission; ADR-0035
 * replaces that decision. The permission is asked in the scan flow and nowhere else,
 * and where it is missing `status().reason` says so (rule 8).
 */

type Module = typeof import('expo-camera');

let cached: Module | null | undefined;

/** Remembers a refusal for the rest of the launch, like blocking's entitlement. */
let denied = false;

export function nativeModule(): Module | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    cached = require('expo-camera') as Module;
  } catch {
    cached = null;
  }
  return cached;
}

export function status(): CapabilityStatus {
  const t = getStrings().keys.platform;
  if (nativeModule() === null) {
    return { available: false, reason: t.noModule };
  }
  if (!isDevice) {
    // The simulator has no camera to point at anything. Saying so is better than a
    // black rectangle that never scans.
    return { available: false, reason: t.simulator };
  }
  if (denied) {
    return { available: false, reason: t.denied };
  }
  return { available: true, reason: null };
}

export type PermissionResult = 'granted' | 'denied' | 'unavailable';

/** True once the user has said yes. */
export async function isGranted(): Promise<boolean> {
  const module = nativeModule();
  if (module === null) {
    return false;
  }
  try {
    return (await module.Camera.getCameraPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Asks for the camera, in the flow that needs it. Resolves, never rejects. A refusal
 * is remembered so `status()` explains the scanner instead of showing it empty.
 */
export async function requestPermission(): Promise<PermissionResult> {
  const module = nativeModule();
  if (module === null) {
    return 'unavailable';
  }
  try {
    const response = await module.Camera.requestCameraPermissionsAsync();
    if (response.granted) {
      denied = false;
      return 'granted';
    }
    denied = true;
    return 'denied';
  } catch {
    return 'unavailable';
  }
}
