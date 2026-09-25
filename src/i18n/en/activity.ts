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
  demo: {
    line: 'Includes sample data. Remove it in Settings.',
    hint: 'Opens Settings',
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
    month: (month, total, days, best) => `${month}: ${total} over ${days}. Your best day: ${best}.`,
    monthEmpty: (month) => `${month}: no focus.`,
    monthGrid: (month, days) => `${month}: ${days} with focus`,
  },
  weekly: {
    lastWeek: 'Last week',
    thisWeek: 'This week',
    averagePerDay: 'Average per day',
    firstWeek: 'Your first week is under way. Come back for your average.',
    noFocusYet: 'No focus this week yet.',
    noFocusThatWeek: 'No focus that week.',
    today: 'Today',
  },
  monthly: {
    totalFocused: 'Total focused time',
    noFocusedDays: (current) => (current ? 'No focused days this month yet.' : 'No focused days that month.'),
    dailyAverage: (current, duration) =>
      current ? `Your daily average this month is ${duration}.` : `Your daily average that month was ${duration}.`,
    patterns: 'Patterns',
    rhythmTitle: 'Your weekly rhythm',
    rhythmDescription: 'Your average focused time by day of the week, since your first session.',
    rhythmEmpty: 'It shows up after your first week of focus.',
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
    capped: '6h daily cap for declared time reached',
    footer: 'Focus, social use and what Health confirms are counted apart. Never added up.',
    usage: {
      appLabel: (name, duration) => `${name}, at least ${duration}`,
      demo: 'The social figure and its breakdown are sample data.',
      readAt: (time) => `Read at ${time}.`,
      ios: 'iOS only shows per-app use inside Screen Time.',
      noModule: 'This version of Vesper cannot read per-app use.',
      noUsageAccess:
        'Usage access is missing. Turn it on in System Settings › Apps › Special access › Usage access.',
      noApps: 'No mode blocks apps on this phone, so there is no use to measure.',
      readFailed: "The phone could not report today's use.",
      pickApps: 'See modes',
      grantAccess: 'Give usage access',
    },
  },
  life: {
    demoNote: 'Estimate with sample data.',
    gridA11y: (lived, total, tag) => `${lived.toLocaleString(tag)} weeks lived out of ${total.toLocaleString(tag)}`,
  },
  weeklyGoal: {
    title: 'Weekly goal',
    change: 'Changes the weekly goal',
    cardA11y: (progress, status) => `${progress}, ${status}`,
    noGoal: 'No goal. Tap to pick one.',
    met: 'Goal met',
    untilClose: (days) => `${days} until the week closes`,
    footer: 'Tap the card to change it. It resets every Monday.',
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
    footer: (minutes, perMonth) =>
      `If a day falls short of ${minutes} minutes, a grace day covers it on its own. You get ${perMonth} a month.`,
  },
  ledger,
};
