/**
 * The Focus tab: the pill on top, the recent-days grid, the mode picker, the line
 * about the next routine and the one button. Durations ('1h 45m') and clock times
 * ('18:00') arrive already formatted; only the words live here.
 */
export const focus = {
  home: {
    /** The footer button while a session runs. */
    resume: 'Seguir',
    holdToFocus: 'Mantén para enfocar',
    /** '25 min · toca para cambiar', under the hold button. */
    holdHint: (minutes: string) => `${minutes} min · toca para cambiar`,
    noModes: 'Sin modos',
    noModesHint: 'Un modo dice qué se bloquea mientras enfocas',
    createFirstMode: 'Crea tu primer modo ›',
  },
  pill: {
    /** '1h 45m hoy · 6h de 15h esta semana', when there is a weekly goal. */
    todayAndWeek: (today: string, week: string) => `${today} hoy · ${week} esta semana`,
    /** '1h 45m enfocado hoy', when there is no goal. */
    todayOnly: (today: string) => `${today} enfocado hoy`,
    /** What VoiceOver reads: the same numbers spelled out, then what a tap does. */
    label: (today: string, week: string | null) =>
      `Hoy: ${today} enfocado${week === null ? '' : `. Esta semana: ${week}`}. Ver la actividad`,
  },
  modePicker: {
    title: 'Modo',
    label: (name: string) => `Modo: ${name}. Toca para elegir otro`,
    manage: 'Gestionar modos ›',
  },
  nextRoutine: {
    /** 'Trabajo · activa hasta las 18:00', while a routine is inside its window. */
    activeUntil: (name: string, time: string) => `${name} · activa hasta las ${time}`,
    startsAt: (name: string, time: string) => `${name} empieza a las ${time}`,
    startsTomorrowAt: (name: string, time: string) => `${name} empieza mañana a las ${time}`,
  },
  recentDays: {
    /** Monday-first initials for the grid header. X for miércoles, so no two match. */
    weekdayInitials: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    /** What VoiceOver reads for the grid: the count, then what a tap does. */
    gridSummary: (days: number) =>
      `Últimas cuatro semanas: ${days === 1 ? '1 día' : `${days} días`} con foco. Toca para ver la actividad`,
  },
};
