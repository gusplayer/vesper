import type { session as shape } from '../es/session';

export const session: typeof shape = {
  stayFocused: 'Stay focused',
  active: {
    elapsedLabel: 'Focused for',
    openSince: (time) => `No limit · since ${time}`,
    takeBreak: '15 min break',
    breakIn: (remaining) => `Break available in ${remaining}`,
    focused: 'Focused',
    fallbackName: 'Session',
    modeHint: 'Shows what this mode does',
    progressLabel: 'Session progress',
    art: 'See the drawing',
    clock: 'See the clock',
    end: 'End',
    deepOnlyTimer: 'Deep · only the timer ends it',
    routine: (name, time) => `Routine ${name} · ends at ${time}`,
    intention: (text) => `“${text}”`,
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
    openHint: (hours) => `No limit ends when you say, or at ${hours} hours. With a deep mode it runs as firm.`,
  },
  break: {
    title: 'Break',
    body: (time) => `You are back at ${time}. Apps are unblocked meanwhile.`,
    resumeNow: 'Resume now',
    endSession: 'End the session',
  },
  emergency: {
    title: 'Emergency unlock',
    body: (left) =>
      `You have ${left} left this month. It ends the session right now, without the ritual, and counts as cancelled.`,
    ready: 'If it really is an emergency, go ahead.',
    freeWay: {
      soft: 'This mode ends without spending one: go back, tap End and breathe one round.',
      firm: 'This mode ends without spending one: go back, tap End, breathe two rounds and type the sentence.',
    },
    wait: (seconds) => `You can confirm in ${seconds} s.`,
    use: 'Use an unlock',
    waitLabel: 'Wait',
    none: 'You have no unlocks left this month.',
    noneHint: 'They come back next month.',
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
    servedOf: (served, planned) => `${served} of ${planned}`,
    servedOpen: (served) => `${served} · no limit`,
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
    progressLabel: 'Breathing',
    round: (cycle, cycles) => `Round ${cycle} of ${cycles}`,
    wantToEnd: 'I want to end',
    backToBreak: 'Back to the break',
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
    cappedTitle: (hours) => `The session reached ${hours} hours.`,
    cappedSubtitle: 'It closed on its own. What you did counts.',
    mode: 'Mode',
    duration: 'Duration',
    intention: 'Intention',
    blocking: 'Blocking',
    blockingNone: 'None',
    notBlocked: (reason) => `This phone does not block apps: ${reason}.`,
    notBlockedHere: 'This phone does not block apps.',
  },
  liveActivity: {
    statusFocus: 'Focused',
    statusOpen: 'Focused · no limit',
    statusBreak: 'Break',
    fallbackModeName: 'Focus',
    notIos:
      'Live Activities only exist on iPhone. On Android the session shows as a pinned notification, also on the lock screen.',
    oldIos: 'Live Activities need iOS 16.2 or newer.',
    noModule: 'This version of Vesper cannot show Live Activities.',
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
