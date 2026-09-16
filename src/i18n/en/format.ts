import type { format as shape } from '../es/format';

export const format: typeof shape = {
  ofTarget: (focus, target) => `${focus} of ${target}`,
  closeWeek: 'close the week',
  thisWeek: (focus) => `${focus} this week`,
  goalMet: (focus) => `goal met · ${focus}`,
  daysLeft: (days) => `${days}d`,
  closing: {
    noTarget: 'there was no goal this week. set one for the week that starts tomorrow',
    met: 'goal met. the week that starts tomorrow starts at zero',
    missed: 'the week that starts tomorrow starts at zero. no streaks to lose',
  },
  done: 'done',
  ofCount: (marked, target) => `${marked} of ${target}`,
  shortDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  everyDay: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  noDay: 'No days',
  whenYouWant: (minutes) => `Whenever you want · ${minutes} min`,
};
