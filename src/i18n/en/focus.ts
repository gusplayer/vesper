import type { focus as shape } from '../es/focus';

export const focus: typeof shape = {
  home: {
    resume: 'Resume',
    inSession: (elapsed, planned) => `In session · ${elapsed} of ${planned}`,
    inSessionOpen: (elapsed) => `In session · ${elapsed} · no limit`,
    focusFor: (minutes) => `Focus for ${minutes} min`,
    focusOpen: 'Focus with no limit',
    holdFor: (minutes) => `Hold to focus for ${minutes} min`,
    noModes: 'No modes',
    noModesHint: 'A mode says what gets blocked while you focus',
    createFirstMode: 'Create your first mode ›',
  },
  pill: {
    today: (today) => `${today} focused today`,
    label: (today) => `Today: ${today} focused. See activity`,
  },
  durationPicker: {
    minutes: (minutes) => `${minutes} min`,
    open: 'No limit',
    label: (current) => `Duration: ${current}. Tap to change`,
  },
  modePicker: {
    title: 'Mode',
    label: (name) => `Mode: ${name}. Tap to pick another`,
    manage: 'Manage modes ›',
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
    none: (minutes) => `No streak yet. ${minutes} minutes today count.`,
    graceYesterday: (days) =>
      `You used a grace day yesterday. ${days === 1 ? '1 day' : `${days} days`} so far.`,
  },
};
