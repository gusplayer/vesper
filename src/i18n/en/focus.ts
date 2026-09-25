import type { focus as shape } from '../es/focus';

export const focus: typeof shape = {
  home: {
    resume: 'Resume',
    inSession: (elapsed, planned) => `In session · ${elapsed} of ${planned}`,
    inSessionOpen: (elapsed) => `In session · ${elapsed} · no limit`,
    focusFor: (minutes) => `Focus for ${minutes} min`,
    focusOpen: 'Focus with no limit',
    holdFor: (minutes) => `Hold to focus for ${minutes} min`,
    holdHint: 'Press and hold to start',
    noModes: 'No modes',
    noModesHint: 'A mode says what gets blocked while you focus',
    createFirstMode: 'Create your first mode',
    openRunsFirm: 'No limit: this mode runs as firm.',
    demo: 'Includes sample data. Remove it in Settings.',
    demoHint: 'Opens Settings',
    routineReady: (name) => `Routine ${name} ready to start.`,
  },
  blocking: {
    blocks: (summary) => `Blocks ${summary}`,
    allowsOnly: (summary) => `Allows only ${summary}`,
    none: 'Blocks no apps',
    unavailable: 'This phone does not block apps.',
    unavailableBecause: (reason) => `This phone does not block apps: ${reason}.`,
  },
  pill: {
    today: (today) => `${today} focused today`,
    label: (today) => `Today: ${today} focused. See activity`,
  },
  durationPicker: {
    minutes: (minutes) => `${minutes} min`,
    open: 'No limit',
    hint: 'Opens the durations',
    intention: 'Intention',
    intentionPlaceholder: 'Optional',
    intentionHint: 'What you want to do in this session. Shown while it runs and when it ends.',
    intentionQueued: (text) => `“${text}”`,
  },
  modePicker: {
    title: 'Mode',
    hint: 'Opens the list of modes',
    manage: 'Manage modes',
  },
  nextRoutine: {
    activeUntil: (name, time) => `${name} · active until ${time}`,
    startsAt: (name, time) => `${name} starts at ${time}`,
    startsTomorrowAt: (name, time) => `${name} starts tomorrow at ${time}`,
  },
  recentDays: {
    gridSummary: (days) =>
      `Last four weeks: ${days === 1 ? '1 day' : `${days} days`} with focus. Tap to see activity`,
  },
  streak: {
    line: (days, graceLeft) =>
      `${days === 1 ? '1 day in a row' : `${days} days in a row`} · ${graceLeft === 1 ? '1 grace day' : `${graceLeft} grace days`}`,
    none: (minutes) => `No streak yet. Today, ${minutes} minutes count.`,
    graceYesterday: (days) =>
      `You used a grace day yesterday. ${days === 1 ? '1 day' : `${days} days`} so far.`,
  },
};
