import type { format as shape } from '../es/format';

export const format: typeof shape = {
  ofTarget: (focus, target) => `${focus} of ${target}`,
  done: 'done',
  ofCount: (marked, target) => `${marked} of ${target}`,
  shortDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekdayInitials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  everyDay: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  noDay: 'No days',
  whenYouWant: (minutes) => `Whenever you want · ${minutes} min`,
};
