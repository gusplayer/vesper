import * as Linking from 'expo-linking';
import type { LiveActivity, LiveActivityFactory } from 'expo-widgets';
import { Platform } from 'react-native';

import { getStrings } from '../i18n';
import { durationText } from '../lib/format';
import type { FocusActivityProps } from '../widgets/FocusActivity';
import { isIos, type CapabilityStatus } from './capabilities';

/**
 * The session's Live Activity through expo-widgets. This is the only file that talks
 * to the module, and it loads it lazily: the widget factory is a native object, and
 * constructing it where the module is missing would throw at import time.
 *
 * One activity at a time, because there is one session at a time. Every native call
 * is wrapped: a failure is logged and swallowed, never thrown into a screen. When the
 * capability is not available, each function is a no-op.
 *
 * The widget extension cannot reach the dictionary, so every word it shows is
 * computed here with `getStrings()` at call time and travels as a prop.
 */

/** ActivityKit shipped in 16.1; updates from the app need 16.2. */
const MIN_IOS = 16.2;

/** Tapping the activity lands on the session, not the home page. */
const SESSION_PATH = '/session/active';

export type FocusInput = {
  modeName: string;
  /** What the clock is counting: the session down, an open session up, a break down. */
  phase: 'focus' | 'open' | 'break';
  startedAt: number;
  endsAt: number;
};

type Factory = LiveActivityFactory<FocusActivityProps>;
type Instance = LiveActivity<FocusActivityProps>;

/** Undefined until the first load attempt; null when the attempt failed. */
let factory: Factory | null | undefined;
let current: Instance | null = null;

function report(where: string, error: unknown): void {
  console.warn(`[liveActivity] ${where} failed`, error);
}

function unavailable(reason: string): CapabilityStatus {
  return { available: false, reason };
}

function iosVersion(): number {
  const version = Platform.Version;
  return typeof version === 'string' ? parseFloat(version) : version;
}

function platformSupported(): boolean {
  return isIos && iosVersion() >= MIN_IOS;
}

function loadFactory(): Factory | null {
  if (factory !== undefined) {
    return factory;
  }
  if (!platformSupported()) {
    factory = null;
    return null;
  }
  try {
    // Lazy on purpose: importing the widget file constructs the native factory.
    const widget = require('../widgets/FocusActivity') as typeof import('../widgets/FocusActivity');
    factory = widget.FocusActivity;
  } catch (error) {
    report('load', error);
    factory = null;
  }
  return factory;
}

export function status(): CapabilityStatus {
  const t = getStrings().session.liveActivity;
  if (!isIos) {
    return unavailable(t.notIos);
  }
  if (iosVersion() < MIN_IOS) {
    return unavailable(t.oldIos);
  }
  return loadFactory() === null ? unavailable(t.noModule) : { available: true, reason: null };
}

function propsOf(input: FocusInput, now: number): FocusActivityProps {
  const t = getStrings().session.liveActivity;
  const remainingText = durationText(Math.max(0, input.endsAt - now));
  const statusText =
    input.phase === 'break' ? t.statusBreak(remainingText) : input.phase === 'open' ? t.statusOpen : t.status(remainingText);
  return {
    modeName: input.modeName,
    startedAt: input.startedAt,
    endsAt: input.endsAt,
    countsUp: input.phase === 'open',
    remainingText,
    statusText,
  };
}

/**
 * Ends activities this process does not own: a previous launch that died mid-session
 * left them on the lock screen, and the system keeps them for hours on its own.
 */
function endOrphans(loaded: Factory): void {
  try {
    for (const instance of loaded.getInstances()) {
      if (instance !== current) {
        instance.end('immediate').catch((error: unknown) => report('end orphan', error));
      }
    }
  } catch (error) {
    report('getInstances', error);
  }
}

/** Shows the activity for a session. Calling it twice updates instead of duplicating. */
export function startFocus(input: FocusInput): void {
  const loaded = loadFactory();
  if (loaded === null) {
    return;
  }
  if (current !== null) {
    updateFocus(input);
    return;
  }
  endOrphans(loaded);
  try {
    current = loaded.start(propsOf(input, Date.now()), Linking.createURL(SESSION_PATH, { scheme: 'vesper' }));
  } catch (error) {
    report('start', error);
    current = null;
  }
}

/** Refreshes the minutes left. The big clock counts down natively and needs no help. */
export function updateFocus(input: FocusInput): void {
  if (current === null) {
    return;
  }
  current.update(propsOf(input, Date.now())).catch((error: unknown) => report('update', error));
}

/** Removes the activity right away. Also sweeps orphans when there is nothing current. */
export async function endFocus(): Promise<void> {
  const loaded = loadFactory();
  if (loaded === null) {
    return;
  }
  const instance = current;
  current = null;
  if (instance === null) {
    endOrphans(loaded);
    return;
  }
  try {
    await instance.end('immediate');
  } catch (error) {
    report('end', error);
  }
}
