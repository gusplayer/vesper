import type { session as shape } from '../es/session';

export const session: typeof shape = {
  stayFocused: 'Stay focused',
  active: {
    elapsedLabel: 'Focused for',
    openSince: (time) => `No limit · since ${time}`,
    takeBreak: '15 min break',
    breakIn: (remaining) => `Break in ${remaining}`,
    focused: 'Focused',
    fallbackName: 'Session',
    modeLabel: (name) => `${name}. See what this mode does`,
    art: 'Art',
    end: 'End',
    deepOnlyTimer: 'Deep · only the timer ends it',
    emergencyLabel: (left) =>
      left === 0
        ? 'Emergency unlock, none left this month'
        : left === 1
          ? 'Emergency unlock, 1 left'
          : `Emergency unlock, ${left} left`,
    interruptions: (count) => (count === 1 ? '1 interruption' : `${count} interruptions`),
  },
  duration: {
    title: 'How long?',
    minutes: (minutes) => `${minutes} min`,
    open: 'No limit',
    openHint: 'Ends when you say, or at 12 hours. A deep mode runs as firm.',
  },
  break: {
    title: 'Break',
    body: (time) => `You are back at ${time}. Apps are unblocked meanwhile.`,
    resumeNow: 'Back now',
    endSession: 'End the session',
  },
  emergency: {
    title: 'Emergency unlock',
    body: (left) =>
      `You have ${left} left this month. It ends the session right now, without the ritual, and counts as cancelled.`,
    ready: 'If it really is an emergency, go ahead.',
    wait: (seconds) => `You can confirm in ${seconds} s.`,
    use: 'Use an unlock',
    none: 'You have no unlocks left this month.',
    noneHint: 'They come back with the next month.',
    reason: 'emergency unlock',
  },
  closed: {
    title: 'Session closed.',
    counted: (served) => `${served} stays counted.`,
    emergency: (left) =>
      left === 0
        ? 'You used an unlock. None left this month.'
        : left === 1
          ? 'You used an unlock. 1 left this month.'
          : `You used an unlock. ${left} left this month.`,
    reason: 'Reason',
  },
  art: {
    label: (name, percent) => `${name}, ${percent} percent. Tap to go back to the clock`,
    works: {
      dog: { name: 'Dog', caption: 'It sits and waits with you.' },
      eiffel: { name: 'Eiffel Tower', caption: 'Raised piece by piece, like your session.' },
      face: { name: 'Face', caption: 'Look inward. The rest can wait.' },
      liberty: { name: 'Statue of Liberty', caption: 'She has held the torch up since 1886. You only have to hold this session.' },
      pagoda: { name: 'Pagoda', caption: 'Five roofs rising toward the silence.' },
    },
  },
  exit: {
    breatheFirst: 'Before you decide, breathe.',
    holdHint: 'Hold the object and breathe with it.',
    releasedHint: 'You let go. The round starts over.',
    holdLabel: 'Vesper object. Hold to breathe',
    phase: {
      inhale: 'Inhale',
      hold: 'Hold',
      exhale: 'Exhale',
    },
    counted: 'What you did counts; what is left does not.',
    oneRound: 'One round.',
    round: (cycle, cycles) => `Round ${cycle} of ${cycles}`,
    wantToEnd: 'I want to end',
    endWithServed: (served) => `End · ${served} so far`,
    typeSentence: 'Type the sentence.',
    sentence: 'I choose to leave this now',
    sentenceField: 'Sentence',
    sentencePlaceholder: 'As written',
    sentenceMismatch: 'The sentence does not match',
    reasonField: 'Reason',
    reasonPlaceholder: 'Optional',
    reasonHint: 'Saved with the session. Nobody else sees it.',
  },
  complete: {
    firstTitle: 'First session complete.',
    title: 'Session complete.',
    subtitle: 'You got your time back.',
    cappedTitle: 'The session reached 12 hours.',
    cappedSubtitle: 'It closed on its own. What you did counts.',
    mode: 'Mode',
    duration: 'Duration',
    intention: 'Intention',
  },
  liveActivity: {
    statusFocus: 'Focused',
    statusOpen: 'Focused · no limit',
    statusBreak: 'Break',
    fallbackModeName: 'Focus',
    notIos: 'Live Activities only exist on iPhone.',
    oldIos: 'Live Activities need iOS 16.2 or newer.',
    noModule: 'This build does not include the Live Activities module. Rebuild the dev client.',
  },
  shield: {
    subtitle: 'You are focused. This app can wait.',
    close: 'Close',
    home: 'Back',
    releasesAt: 'Unblocks at {time}',
    channelName: 'Focus session',
    channelDescription: 'Shown while a session blocks apps.',
    session: 'Focus session',
    pause: 'Break',
  },
};
