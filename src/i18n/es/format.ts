/**
 * Words the formatters in `src/lib/format.ts` and `src/features/schedules/format.ts`
 * need: the week goal line, habit progress, schedule windows. Durations ('2h 15m') and
 * clock times ('21:30') are the same in every language and live in code.
 */
export const format = {
  /** '4h de 10h'. */
  ofTarget: (focus: string, target: string) => `${focus} de ${target}`,
  /** The header on Sunday, whatever the numbers say (ADR-0013). */
  closeWeek: 'cerrar la semana',
  /** '4h esta semana', when there is no goal. */
  thisWeek: (focus: string) => `${focus} esta semana`,
  /** 'meta hecha · 10h'. */
  goalMet: (focus: string) => `meta hecha · ${focus}`,
  /** '5d', the days left in the week. */
  daysLeft: (days: number) => `${days}d`,
  closing: {
    noTarget: 'no había meta esta semana. pon una para la que empieza mañana',
    met: 'meta cumplida. la semana que empieza mañana arranca en cero',
    missed: 'la semana que empieza mañana arranca en cero. sin rachas que perder',
  },
  /** Done is a word, never a color. */
  done: 'hecho',
  /** '2 de 4', marked days against the weekly target. */
  ofCount: (marked: number, target: number) => `${marked} de ${target}`,
  /** Monday first, matching `Schedule.days`. */
  shortDays: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
  everyDay: 'Todos los días',
  weekdays: 'Entre semana',
  weekends: 'Fines de semana',
  noDay: 'Ningún día',
  /** A routine you start by hand: 'Cuando quieras · 20 min'. */
  whenYouWant: (minutes: number) => `Cuando quieras · ${minutes} min`,
};
