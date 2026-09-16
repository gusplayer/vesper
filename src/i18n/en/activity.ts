import type { activity as shape, LedgerStrings } from '../es/activity';

const ledger: LedgerStrings = {
  unknown: 'unregistered',
  usage: 'social',
  health: {
    workout: 'workout',
    steps: 'walking',
    sleep: 'sleep',
    exercise_time: 'exercise',
  },
};

export const activity: typeof shape = {
  header: {
    title: {
      week: 'Weekly activity',
      month: 'Monthly activity',
      lifetime: 'Lifetime activity',
    },
    option: {
      week: 'Weekly',
      month: 'Monthly',
      lifetime: 'Lifetime',
    },
    chooseView: 'Choose which activity to see',
    sheetTitle: 'View',
  },
  dates: {
    monthShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayLong: (weekday, day, month) => `${weekday}, ${month} ${day}`,
    dayShort: (weekday, day, month) => `${weekday}, ${month} ${day}`,
  },
  units: {
    sessions: (count) => (count === 0 ? 'No sessions' : count === 1 ? '1 session' : `${count} sessions`),
    hours: (count, tag) => (count === 1 ? '1 hour' : `${count.toLocaleString(tag)} hours`),
    days: (count, tag) => (count === 1 ? '1 day' : `${count.toLocaleString(tag)} days`),
    weeks: (count, tag) => (count === 1 ? '1 week' : `${count.toLocaleString(tag)} weeks`),
  },
  spoken: {
    delta: (percent, direction) => `${percent}% ${direction === 'up' ? 'more' : 'less'} than last week`,
    deltaFlat: 'Same as last week',
    noFocus: 'no focus',
    today: 'Today',
  },
  weekly: {
    lastWeek: 'LAST WEEK',
    thisWeek: 'THIS WEEK',
    averagePerDay: 'Average per day',
    firstWeek: 'Your first week is under way. Come back for your average.',
    today: 'TODAY',
  },
  monthly: {
    totalFocused: 'Total focused time',
    noFocusedDays: (current) => `No focused days ${current ? 'this month' : 'that month'} yet.`,
    dailyAverage: (current, duration) =>
      `Your daily average ${current ? 'this month' : 'that month'} was ${duration}`,
    patterns: 'PATTERNS',
    rhythmTitle: 'Your weekly rhythm',
    rhythmDescription: 'This is your average focused time by day of the week.',
  },
  lifetime: {
    totalFocused: 'FOCUSED IN TOTAL',
    bestDay: (duration) => `Your best day: ${duration}.`,
    noSessionYet: 'Your first session has not happened yet.',
    daysWithFocus: 'DAYS WITH FOCUS',
    noDayYet: 'None yet.',
    since: (month) => `Since ${month}.`,
  },
  today: {
    title: 'Today',
    focused: 'Focused',
    social: 'Social (estimate)',
    socialDescription: 'always a floor, never exact',
    unregistered: 'Unregistered',
    footer: 'Three separate currencies. Never added up.',
  },
  weeklyGoal: {
    title: 'Weekly goal',
    change: 'Change the weekly goal',
    noGoal: 'No goal. Tap to pick one.',
    met: 'Goal met',
    untilClose: (days) => `${days} until the week closes`,
    footer: 'Resets on Monday. One goal per week, no streaks.',
    sheetTitle: 'Hours per week',
    none: 'None',
  },
  ledger,
};
