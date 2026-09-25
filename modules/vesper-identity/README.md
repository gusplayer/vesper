# vesper-identity

A local Expo module for iOS and Android. It keeps the identity credential (ADR-0048,
point 4) in the one place each system copies to a new phone without the user doing
anything. `src/platform/identity.ts` is its only caller.

## What it stores

One opaque string, `<uuid>.<secret>`. The module never parses it and never logs it,
on either platform: logs carry only the name of the call that failed and a status code.

| | iOS | Android |
|---|---|---|
| Store | Keychain, generic password | Google Play services Block Store (`play-services-auth-blockstore` 16.4.0) |
| Where | service `com.gusplayer.vesper.identity`, account `identity` | key `vesper.identity` |
| How it travels | `kSecAttrSynchronizable`: iCloud Keychain, to every device on the Apple ID | `setShouldBackupToCloud` only with a screen lock (end-to-end encrypted): Google backup, plus device-to-device transfer during setup |
| Encryption on the way | End-to-end (iCloud Keychain) | End-to-end only when the phone has a screen lock (Android 9 or later) |
| Reinstall | Keychain items have long survived an uninstall, though Apple does not promise it | Survives while Google backup is on; "Clear storage" can wipe it |
| Access | `AfterFirstUnlock`: the background sync must read it while the phone is locked, and a synchronizable item cannot be `ThisDeviceOnly` | No permission |

## JS surface

```ts
identityModule(): VesperIdentityApi | null  // null in Expo Go, on web, in vitest, or in an older build

getCredential(): Promise<string | null>
setCredential(value: string): Promise<boolean>   // false when the store refused
clearCredential(): Promise<void>
describe(): Promise<{ travels: boolean; endToEnd: boolean; reason: IdentityTransportReason }>
```

None of them throws. `describe()` answers:

| `reason` | `travels` | `endToEnd` | When |
|---|---|---|---|
| `icloud-keychain` | true | true | Always on iOS |
| `block-store` | true | true | Android, Play services answers, screen lock set |
| `block-store-no-screen-lock` | false | false | Android without a screen lock (or Android 8): kept off the cloud, because the backup's key comes from this secret |
| `unavailable` | false | false | No Play services, or it failed or did not answer in 10 s |

`travels` is what the mechanism promises, not a fact about this phone. Neither system says
whether the user turned iCloud Keychain or Google backup off; in both cases the store
accepts the value and it stays on the phone.

## Why not expo-secure-store

It exposes neither `kSecAttrSynchronizable` nor Block Store. On iOS its items stay on
the phone; on Android its values are encrypted with a Keystore key that never leaves it,
which is why ADR-0048 (point 10) keeps it out of Auto Backup.

## Building

Autolinking picks the module up from `modules/` like `vesper-health`: no entry in
`package.json`. It needs a native rebuild (`pod install` on iOS, a Gradle sync on
Android); JS alone will not bring it in, and until then `identityModule()` is null.

The iOS item lives in the app's default access group, team prefix plus bundle id. A build
signed by another team, such as the free-team variant of `app.config.js`, reads a
different Keychain and does not see the item.

## Verified, and what a simulator cannot show

Written without building the app. The Swift type-checks against the prebuilt
`ExpoModulesCore` in `ios/Pods`, and the Kotlin compiles against `expo-modules-core`
and Block Store 16.4.0. Neither has run on a device.

What a simulator or emulator can show: store, read, replace and delete on one device;
on Android, an emulator image with Play services, where `describe()` changes when a PIN
is set.

What it cannot show:

- **iCloud Keychain sync** needs two real devices on one Apple ID with iCloud Keychain
  on, or one device erased and restored.
- **Block Store restore** needs a real Google backup and a target phone set up from it:
  a cloud restore (Pixel on Android 9 or later, other phones on Android 12 or later) or
  a device-to-device transfer during setup, usually after a factory reset.
- **Delete reaching the cloud copy.** On iOS iCloud Keychain carries the delete. On
  Android the cloud copy follows Block Store's next periodic backup; how soon is not
  documented.
