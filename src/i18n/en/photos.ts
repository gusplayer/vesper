import type { photos as shape } from '../es/photos';

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
    save: 'Save',
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
    removeConfirm: 'Remove',
    goneTitle: 'This photo is gone',
    goneDescription: 'Go back to the challenge.',
  },
  album: {
    title: 'Your album',
    note: 'Your photos stay on this phone until you archive the challenge.',
    archiveMessage: 'It leaves your list and its photos are deleted. Your habit and your marks stay.',
  },
  create: {
    toggle: 'Photos of the day',
    toggleHint: 'Everyone can add a photo to their mark. It is never required.',
  },
};
