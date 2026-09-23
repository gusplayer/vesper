import type { Strings } from '../es';

/** The key (ADR-0034), in the same voice as the Spanish: direct, short, sentence case. */
export const keys: Strings['keys'] = {
  title: 'Keys',
  subtitle: 'A device that opens and closes your sessions. It has to be nearby.',
  empty: 'You have no keys yet.',
  emptyHint: 'With a key, a session does not end until you scan it again.',
  add: 'Add a key',
  max: (n: number) => `Up to ${n} keys.`,
  pairedOn: (date: string) => `Paired on ${date}`,
  remove: 'Remove',
  removeConfirm: 'Remove this key. The sessions it opened stay as they are.',
  nameLabel: 'Name',
  /** What a key this phone holds is called until the user renames it. */
  defaultName: 'This key',
  namePlaceholder: "Ana's phone",

  choose: {
    title: 'Does this phone hold the key or use it?',
    isKey: 'Holds the key',
    isKeyHint: 'This phone shows the code. The other one cannot leave without it.',
    usesKey: 'Uses it',
    usesKeyHint: 'This phone scans the code to start and to end.',
  },

  show: {
    title: 'Show this code to the other phone',
    hint: 'It is scanned once. After that the code changes on its own.',
    done: 'Done',
    codeTitle: 'Scan to start',
    codeHint: 'The code changes every 30 seconds, and each one works once.',
    gone: 'This key is no longer on this phone.',
  },

  pair: {
    title: "Scan the other phone's code",
    hint: 'Hold it in front of the camera.',
    named: 'That is it. What do you want to call it?',
    save: 'Save',
    badCode: 'That code is not a key.',
    full: 'You already have as many keys as fit.',
    noKeychain: 'This phone could not store the key.',
  },

  session: {
    start: 'Start with a key',
    startHint: 'The session does not end until you scan again.',
    scanToStart: 'Scan the key to start',
    scanToEnd: 'Scan the key to end',
    tooSoon: 'The key does not end a session that just started. Give it a moment.',
    noMode: 'Pick a mode before you scan.',
    wrongKey: "That is not this session's code.",
    sameCode: 'Wait for the next code.',
    locked: 'Only the key ends this session.',
    lockedFoot: 'With the key · or the emergency unlock',
  },

  receipt: {
    title: 'Session over',
    duration: (text: string) => `${text} of focus`,
    completed: 'Ran its time',
    cut: 'Ended early',
  },

  role: {
    shows: 'This phone shows it',
    scans: 'Opens this phone',
  },

  platform: {
    noModule: 'This build has no camera module. The dev client needs rebuilding.',
    simulator: 'The simulator has no camera. This is tested on a phone.',
    denied: 'Vesper cannot use the camera. You can turn it on in system Settings.',
    noKeychain: 'This phone has nowhere to store the key.',
    permissionTitle: 'Vesper needs the camera',
    permissionBody: 'Only to read the key code. It takes no pictures and stores none.',
    permissionAsk: 'Allow the camera',
  },
};
