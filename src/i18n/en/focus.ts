import type { focus as shape } from '../es/focus';

export const focus: typeof shape = {
  home: {
    resume: 'Resume',
    holdToFocus: 'Hold to focus',
    holdHint: (minutes) => `${minutes} min · tap to change`,
    noModes: 'No modes',
    noModesHint: 'A mode says what gets blocked while you focus',
    createFirstMode: 'Create your first mode ›',
  },
  pill: {
    todayAndWeek: (today, week) => `${today} today · ${week} this week`,
    todayOnly: (today) => `${today} focused today`,
    label: (today, week) =>
      `Today: ${today} focused${week === null ? '' : `. This week: ${week}`}. See activity`,
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
    weekdayInitials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    gridSummary: (days) =>
      `Last four weeks: ${days === 1 ? '1 day' : `${days} days`} with focus. Tap to see activity`,
  },
};
