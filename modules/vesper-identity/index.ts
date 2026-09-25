/**
 * The typed surface of the local module in ./ios and ./android (ADR-0048, point 4):
 * the identity credential kept where the operating system carries it to a new phone
 * by itself. iOS: one synchronizable Keychain item, so iCloud Keychain. Android: Google
 * Play services Block Store, backed up to the cloud.
 *
 * The value is opaque here (`<uuid>.<secret>`) and is never logged, on either side of
 * the bridge. src/platform/identity.ts is the only caller.
 */

/**
 * 'icloud-keychain': iOS; end-to-end encrypted by Apple. 'block-store': Android with a
 * screen lock, so the cloud copy is end-to-end encrypted. 'block-store-no-screen-lock':
 * Android without one; it stays off the cloud (a copy Google could read would be a
 * backup Google could read), so it does not travel and the backup key is the way.
 * 'unavailable': no Play services, or it failed to answer; nothing travels.
 */
export type IdentityTransportReason =
  | 'icloud-keychain'
  | 'block-store'
  | 'block-store-no-screen-lock'
  | 'unavailable';

export type IdentityTransport = {
  /** What is stored reaches a new phone on the same Apple or Google account without the user doing anything. */
  travels: boolean;
  /** And it does so end-to-end encrypted: neither Apple nor Google can read it. */
  endToEnd: boolean;
  /** Why, for the screen that has to say so (CLAUDE.md rule 8). */
  reason: IdentityTransportReason;
};

export type VesperIdentityApi = {
  /** The stored credential, or null when there is none or the store could not be read. */
  getCredential(): Promise<string | null>;
  /** Stores or replaces it. False when the store refused. */
  setCredential(value: string): Promise<boolean>;
  /** Removes it here and, with the next sync, from the copy that travels. */
  clearCredential(): Promise<void>;
  /** Whether what is stored reaches a new phone by itself, and how. */
  describe(): Promise<IdentityTransport>;
};

const UNAVAILABLE: IdentityTransport = { travels: false, endToEnd: false, reason: 'unavailable' };

const REASONS: readonly IdentityTransportReason[] = [
  'icloud-keychain',
  'block-store',
  'block-store-no-screen-lock',
  'unavailable',
];

/** Undefined until the first load; null when the native module is not in this build. */
let cached: VesperIdentityApi | null | undefined;

/**
 * The module, or null in Expo Go, on web, in vitest or in a build made before it
 * existed. Never throws, and neither do its methods: every native failure resolves to
 * null, false or 'unavailable', because a missing identity must never cost the app
 * its boot.
 */
export function identityModule(): VesperIdentityApi | null {
  if (cached === undefined) {
    cached = load();
  }
  return cached;
}

function load(): VesperIdentityApi | null {
  try {
    // Lazy on purpose: expo-modules-core loads react-native, which vitest cannot parse,
    // and platform/identity.ts is imported by code that tests run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the module may be absent
    const core = require('expo-modules-core') as typeof import('expo-modules-core');
    const native = core.requireOptionalNativeModule<VesperIdentityApi>('VesperIdentity');
    return native === null ? null : guarded(native);
  } catch {
    return null;
  }
}

/**
 * The native module behind the same four methods, with every rejection turned into its
 * "nothing" answer. The native side already resolves instead of throwing; this covers
 * a stale build that lacks a method and an argument the bridge refuses. Errors are
 * swallowed without logging: a message could carry what was passed in.
 */
function guarded(native: VesperIdentityApi): VesperIdentityApi {
  return {
    async getCredential() {
      try {
        const value: unknown = await native.getCredential();
        return typeof value === 'string' && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    },
    async setCredential(value) {
      if (value.length === 0) {
        return false;
      }
      try {
        return (await native.setCredential(value)) === true;
      } catch {
        return false;
      }
    },
    async clearCredential() {
      try {
        await native.clearCredential();
      } catch {
        // Nothing to clear, or nothing to clear it with: either way there is no credential here.
      }
    },
    async describe() {
      try {
        const transport: unknown = await native.describe();
        return isTransport(transport) ? transport : UNAVAILABLE;
      } catch {
        return UNAVAILABLE;
      }
    },
  };
}

function isTransport(value: unknown): value is IdentityTransport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { travels, endToEnd, reason } = value as Record<string, unknown>;
  return (
    typeof travels === 'boolean' &&
    typeof endToEnd === 'boolean' &&
    REASONS.includes(reason as IdentityTransportReason)
  );
}
