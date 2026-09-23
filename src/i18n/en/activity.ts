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
    today: 'Today',
  },
  monthly: {
    totalFocused: 'Total focused time',
    noFocusedDays: (current) => `No focused days ${current ? 'this month' : 'that month'} yet.`,
    dailyAverage: (current, duration) =>
      `Your daily average ${current ? 'this month' : 'that month'} was ${duration}`,
    patterns: 'Patterns',
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
  chart: {
    average: 'AVG',
  },
  today: {
    title: 'Today',
    focused: 'Focused',
    social: 'Social (estimate)',
    socialDescription: 'always a floor, never exact',
    atLeast: (duration) => `at least ${duration}`,
    unregistered: 'Unregistered',
    footer: 'Three separate currencies. Never added up.',
    usage: {
      appLabel: (name, duration) => `${name}, at least ${duration}`,
      demo: 'Breakdown with sample data.',
      readAt: (time) => `Read at ${time}.`,
      ios: 'iOS only shows per-app use inside Screen Time.',
      noModule: 'This version of Vesper cannot read per-app use.',
      noUsageAccess:
        'Usage access is missing. Turn it on in System Settings › Apps › Special access › Usage access.',
      noApps: 'Pick real apps in a blocking mode to measure their use.',
      readFailed: "The phone could not report today's use.",
    },
  },
  weeklyGoal: {
    title: 'Weekly goal',
    change: 'Change the weekly goal',
    noGoal: 'No goal. Tap to pick one.',
    met: 'Goal met',
    untilClose: (days) => `${days} until the week closes`,
    footer: 'Resets on Monday. One goal a week.',
    sheetTitle: 'Hours per week',
    none: 'None',
  },
  streak: {
    title: 'Streak',
    days: (count, tag) => (count === 1 ? '1 day in a row' : `${count.toLocaleString(tag)} days in a row`),
    none: 'No streak yet',
    explain: (minutes, graceLeft) =>
      `A day counts with ${minutes} minutes of focus. ${
        graceLeft === 0
          ? 'No grace days left this month.'
          : graceLeft === 1
            ? 'You have 1 grace day left this month.'
            : `You have ${graceLeft} grace days left this month.`
      }`,
    footer: 'Grace days apply on their own to the first day that fails. Three a month.',
  },
  ledger,
};
