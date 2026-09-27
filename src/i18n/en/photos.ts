import type { photos as shape } from '../es/photos';

/** 'Ana', 'Ana and Luis', 'Ana, Luis and Sofía'. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Photos in a challenge (ADR-0051), in the same voice as the Spanish. */
export const photos: typeof shape = {
  cameraUnavailable: 'The camera is not available on this device.',
  pickerUnavailable: 'This build of Vesper cannot open your photos.',
  /** 'Tuesday, September 24'. */
  day: (weekday, day, month) => `${weekday}, ${month} ${day}`,
  row: {
    addToday: "Add today's photo",
    addYesterday: "Add yesterday's photo",
    changeToday: "Change today's photo",
    changeYesterday: "Change yesterday's photo",
    optional: 'It is optional: your mark counts the same.',
  },
  sheet: {
    today: "Today's photo",
    yesterday: "Yesterday's photo",
    take: 'Take a photo',
    pick: 'Choose from your library',
    preparing: 'Preparing the photo…',
    cameraDenied: 'Vesper has no camera access. You can choose from your library or allow it in Settings.',
    libraryDenied: 'Vesper has no access to your photos. You can allow it in Settings.',
    failed: 'The photo could not be prepared. Try again.',
  },
  preview: {
    caption: 'Caption',
    captionPlaceholder: 'One line, if you want',
    onlyYou: 'Only you see it.',
    audience: (names) =>
      names.length === 1
        ? `${joinNames(names)} sees it, only in this challenge.`
        : `${joinNames(names)} see it, only in this challenge.`,
    save: 'Save',
    add: 'Add to the challenge',
    queued: 'It uploads when you are online.',
    retake: 'Take another',
    repick: 'Choose another',
    slotGone: 'That day no longer takes a photo. Only today and yesterday, on a marked day.',
    photoA11y: 'The photo you are about to save',
  },
  viewer: {
    whoDay: (who, day) => `${who} · ${day}`,
    caption: (text) => `“${text}”`,
    fromCamera: (time) => `With the camera · ${time}`,
    fromLibrary: 'From the library',
    markSource: {
      health: 'Marked by Health',
      session: 'Marked by focus sessions',
      manual: 'Marked by hand',
    },
    mineA11y: (day) => `Your photo from ${day}`,
    theirsA11y: (name, day) => `${name}'s photo from ${day}`,
    remove: 'Remove the photo',
    removeQuestion: 'Remove the photo?',
    removeMessage: 'Your mark stays.',
    removeSharedMessage: 'It is deleted for everyone. Your mark stays.',
    removeConfirm: 'Remove',
    goneTitle: 'This photo is gone',
    goneDescription: 'Go back to the challenge.',
    downloading: 'Downloading the photo…',
    downloadProblem: {
      offline: 'No connection. The photo downloads when you open it again online.',
      gone: 'This photo is no longer on the server.',
      unavailable: 'This phone cannot open this photo.',
      failed: 'The photo could not be downloaded. Open it again to try once more.',
    },
    moreA11y: 'More options for the photo',
    reported: 'Reported. You no longer see it, and we will review it.',
    reportedQueued: 'Reported. You no longer see it, and the report goes out when you are online.',
    hidden: (name) => `You no longer see ${name}'s photos.`,
    hiddenBody: 'Their marks still show. You can show the photos again in Settings › Circle.',
  },
  options: {
    title: 'Options',
    report: 'Report the photo',
    hide: (name) => `Hide ${name}'s photos`,
    hideHint: 'Only for you. Their marks still show.',
    block: (name) => `Block ${name}`,
  },
  report: {
    title: 'Report the photo',
    anonymous: 'Nobody will know it was you.',
    reasons: {
      unwanted: 'It should not be here',
      consent: 'Someone is in it without consent',
      minor: 'It shows a minor',
      other: 'Something else',
    },
    note: 'Note',
    notePlaceholder: 'Tell us more, if you want',
    send: 'Send the report',
    sending: 'Sending…',
    failed: 'The report could not be sent. Try again.',
  },
  block: {
    label: 'Block',
    a11y: (name) => `Block ${name}`,
    question: (name) => `Block ${name}?`,
    message: 'They leave your circle and your challenges, and cannot ask to join again. They are not told.',
    confirm: 'Block',
    queued: 'Blocked on this phone. It completes as soon as you are online.',
  },
  hiddenPeople: {
    title: 'Hidden photos',
    footer: 'Only for you. Their marks still show.',
    show: 'Show',
    showA11y: (name) => `Show ${name}'s photos`,
  },
  terms: {
    title: 'Before your first photo',
    who: {
      heading: 'Who sees it',
      body: 'Only the people already in this challenge. There is no profile and no feed: the photo stays there.',
    },
    howLong: {
      heading: 'How long it stays',
      body: 'It leaves the server 14 days after the challenge ends, or after 28 days in a challenge with no end. You can remove it sooner.',
    },
    care: {
      heading: 'What to mind',
      body: "If someone else is in it, ask them first. We remove the photo's location. A screenshot cannot be prevented.",
    },
    zeroTolerance:
      'Zero tolerance for abuse: a reported photo is reviewed, and whoever adds anything sexual, violent, illegal or that exposes a minor is removed from Vesper.',
    termsRow: 'Terms of use',
    termsNote: 'By tapping Got it, you accept these terms for your photos.',
    accept: 'Got it',
    notNow: 'Not now',
  },
  invited: 'People share photos in this challenge. Yours are optional.',
  album: {
    title: 'Your album',
    note: 'Your photos stay on this phone until you archive the challenge.',
    groupTitle: 'The album',
    until: (date) => `The photos stay here until ${date}.`,
    archiveMessage: 'It leaves your list and its photos are deleted. Your habit and your marks stay.',
  },
  create: {
    toggle: 'Photos of the day',
    toggleHint: 'Everyone can add a photo to their mark. It is never required.',
  },
  share: {
    albumRow: 'Share your album',
    title: 'Share your album',
    button: 'Share',
    preparing: 'Preparing the image…',
    onlyYours: "Only your photos go, with no one else's name.",
    previewA11y: (name) => `The image you are about to share: your album of ${name}`,
    cardLine: (days) =>
      days === 7
        ? 'A one-week challenge.'
        : days % 7 === 0 && days !== 21
          ? `A ${days / 7}-week challenge.`
          : `A ${days}-day challenge.`,
    wordmark: 'Vesper',
    saveOrShare: 'Save or share',
    unavailable: 'This phone has nothing to share with.',
    cardUnavailable: 'This build of Vesper cannot prepare the image.',
    failed: 'The image could not be prepared. Try again.',
    shareFailed: 'The share sheet could not open. Try again.',
  },
};
