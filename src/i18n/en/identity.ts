import type { identity as shape } from '../es/identity';

/**
 * The identity without login (ADR-0048): finding a previous Vesper on a new phone,
 * restoring it with the backup key, and whether the key travels by itself.
 */
export const identity: typeof shape = {
  travel: {
    icloudKeychain: 'Your key reaches a new iPhone on your Apple account by itself, end-to-end encrypted.',
    blockStore: 'Your key reaches a new Android phone on your Google account by itself, encrypted with your screen lock.',
    blockStoreNoScreenLock:
      'With a screen lock, your key would reach a new Android phone by itself. Without one, keep your backup key.',
    unavailable: 'This phone does not carry your key to another one by itself. Keep your backup key.',
  },
  welcome: {
    found: 'We found your previous Vesper.',
    foundBackup: (when: string) => `We found your previous Vesper, with a backup from ${when}.`,
    foundNoBackup: 'We found your previous Vesper. It has no backup: your circle and your challenge marks come back.',
    foundUnknown: 'We found your previous Vesper. Without a connection there is no way to see when its backup is from.',
    restore: 'Restore',
    startFresh: 'Start from scratch',
    haveKey: 'I have a key',
    freshQuestion: 'Start from scratch?',
    freshMessage: 'Your previous Vesper, its backup and its circle are deleted from the server. This cannot be undone.',
    freshConfirm: 'Delete and start',
    freshPending: 'No connection: your previous Vesper is deleted as soon as there is one.',
  },
  key: {
    title: 'Your backup key',
    body: 'Paste it the way you saved it, with or without spaces. It brings back your backup, your circle and your challenges.',
    label: 'Key',
    placeholder: 'Paste your key here',
    invalid: 'That does not look like a Vesper key. Check that it is complete.',
    replaces: 'Restoring replaces what is on this phone with what that key holds.',
    restore: 'Restore',
  },
  restoring: {
    title: 'Restore',
    working: 'Restoring your Vesper…',
    workingNote: 'It takes a few seconds. Keep the app open.',
    restored: 'Done. Your data is back on this phone.',
    circleOnly: 'There was no backup. Your circle and your challenge marks came back.',
    keyOnly: 'The key is yours, but there was no backup or circle to bring back.',
    unreadable: 'Your backup could not be opened with this key. Your circle came back, and the next backup replaces it.',
    wrongKey: 'That key does not belong to any Vesper account. Check that it is the last one you saved.',
    offline: 'No connection. Nothing changed: try again when you are online.',
    newerApp: 'That backup is from a newer version of Vesper. Update the app and try again. Nothing changed.',
    noKeychain: 'This phone cannot keep the key, so nothing was restored.',
    failed: 'The restore did not go through. Nothing changed: try again.',
    keyChanged:
      'Your backup key is new and the old one stops working. If you kept it in a password manager, save the new one from Settings › Backup.',
    permissions: 'Permissions are asked for again, each one when it is needed.',
    iosApps: 'On iPhone, pick the apps of each mode again: Screen Time does not carry them from one phone to another.',
    continue: 'Continue',
    retry: 'Try again',
    otherKey: 'Try another key',
  },
};
