import type { backup as shape } from '../es/backup';

/**
 * The encrypted backup (ADR-0048): Settings › Backup and what it says about itself.
 * Same promises as the Spanish, in the same voice.
 */
export const backup: typeof shape = {
  title: 'Backup',
  toggleTitle: 'Encrypted backup',
  toggleDescription:
    'A copy of your data, encrypted on this phone before it leaves. The server keeps it but cannot read it.',
  toggleDescriptionWithEmail:
    'A copy of your data, encrypted on this phone before it leaves. Since you added an email, Vesper also keeps your key, encrypted, to give it back to you.',
  contents:
    'It holds your modes, routines, sessions, habits with their Health marks, your goal, Life and your circle. The apps you pick on iPhone do not travel: Screen Time ties them to each phone, so you pick them again.',
  offNote: 'While it is off nothing goes up, and the copy on the server is deleted as soon as there is a connection.',
  backupNow: 'Back up now',
  backingUp: 'Backing up…',
  done: 'Done. Your backup is up to date.',
  keyTitle: 'Backup key',
  keyHint:
    'Only this key opens your backup. Keep it in your password manager: if you lose your phone and the key did not reach the new one by itself, your backup cannot be opened without it. Nobody else has it, Vesper included.',
  keyHintWithEmail:
    'Only this key opens your backup. Keep it in your password manager. Since you added a recovery email, Vesper can also give it back to you.',
  keyMoved:
    'This key no longer opens your Vesper. If you brought it to another device, the new key is there. Paste a key in "I have a key" or start a new identity here.',
  keySave: 'Copy or save the key…',
  keyMissing: 'This phone does not have its key yet. It shows up here as soon as it is registered.',
  keyLost: 'Your data reached this phone, but your key did not. Without it nothing is backed up: paste it in "I have a key" or start a new identity.',
  newIdentityRow: 'Start a new identity',
  newIdentityHint: 'Your data stays on this phone and the backup goes out again. Your previous circle only comes back with your key.',
  newIdentityTitle: 'Start a new identity?',
  newIdentityMessage: 'Your data on this phone stays. The previous backup and circle can only be recovered with your key; without it they stay closed.',
  newIdentityConfirm: 'Start',
  newIdentityFailed: 'Nothing was started: no connection, or the server did not answer. Try again.',
  recoveryRow: 'Recovery email',
  recoveryNone: 'None',
  recoveryHint: 'With an email, Vesper can give your key back, so your backup is no longer closed to you alone.',
  restoreRow: 'I have a key',
  restoreHint: 'To bring the backup of another phone to this one.',
  status: {
    off: 'The backup is off.',
    noKey: 'Nothing is backed up until this phone has its key.',
    moved:
      "This device's key stopped working: your Vesper moved to another device or its key changed. Nothing is backed up from here.",
    noCrypto: 'This phone cannot encrypt the backup, so nothing leaves.',
    noIdentity: 'The backup starts once this phone is registered with the server. It happens by itself, the next time there is a connection.',
    never: 'No backup yet. One is made when a session ends and, at most, once a day.',
    last: (when) => `Last backup: ${when}.`,
    failed: (why, when) => `${why} The last backup from this phone was on ${when}.`,
    failedNever: (why) => `${why} There is no backup yet.`,
  },
  recoveryEmail: {
    title: 'Recovery email',
    price: 'With an email, Vesper can give your key back, so your backup is no longer closed to you alone.',
    body: 'If you lose your phone and your key, you get your Vesper back on any phone with a code sent to this email.',
    loading: 'Checking your account…',
    unknown: 'Without a connection there is no way to see whether you already have a recovery email.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    send: 'Send code',
    sending: 'Sending…',
    codeSent: (email: string) => `We sent a code to ${email}. It lasts ten minutes.`,
    codeLabel: 'Code',
    codePlaceholder: '123456',
    confirm: 'Confirm',
    confirming: 'Confirming…',
    otherEmail: 'Use another email',
    confirmedTitle: 'Your email',
    confirmedNote: 'If you lose your key, this email gets your Vesper back on any phone.',
    done: 'Done. Your email is confirmed.',
    change: 'Change the email',
    remove: 'Remove the email',
    removing: 'Removing…',
    removeQuestion: 'Remove the email?',
    removeMessage: 'Vesper deletes your email and the copy of your key. Your backup opens only with your key again.',
    removeConfirm: 'Remove',
    removed: 'You removed the email. Vesper no longer keeps a copy of your key.',
  },
  errors: {
    offline: 'Could not back up: no connection.',
    tooLarge: 'Could not back up: the copy is over 5 MB, the server limit.',
    unauthorized: "Could not back up: the server does not recognize this phone's key.",
    rateLimited: 'Could not back up: too many attempts in a row. It tries again in a while.',
    server: 'Could not back up: the server did not answer.',
    crypto: 'Could not encrypt the backup on this phone, so nothing left.',
    failed: "Could not read this phone's database to back it up.",
    newerElsewhere:
      'Your account has a newer backup, made from another phone. It is not replaced on its own: “Back up now” swaps it for this one.',
  },
};
