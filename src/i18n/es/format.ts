/**
 * Words the formatters in `src/lib/format.ts` and `src/features/schedules/format.ts`
 * need: the week goal line, habit progress, schedule windows. Durations ('2h 15m') and
 * clock times ('21:30') are the same in every language and live in code.
 */
export const format = {
  /** '4h de 10h'. */
  ofTarget: (focus: string, target: string) => `${focus} de ${target}`,
  /** Done is a word, never a color. */
  done: 'hecho',
  /** '2 de 4', marked days against the weekly target. */
  ofCount: (marked: number, target: number) => `${marked} de ${target}`,
  /** Monday first, matching `Schedule.days`. */
  shortDays: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
  /** One letter per day, Monday first: the grid header and the day picker. X for miércoles, so no two match. */
  weekdayInitials: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  everyDay: 'Todos los días',
  weekdays: 'Entre semana',
  weekends: 'Fines de semana',
  noDay: 'Ningún día',
  /** A routine you start by hand: 'Cuando quieras · 20 min'. */
  whenYouWant: (minutes: number) => `Cuando quieras · ${minutes} min`,
};
