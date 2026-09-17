/**
 * The Focus tab: the pill on top, the recent-days grid, the mode picker, the lines
 * about the next routine and the running session, and the one button. Durations ('1h 45m') and clock times
 * ('18:00') arrive already formatted; only the words live here.
 */
export const focus = {
  home: {
    /** The footer button while a session runs. */
    resume: 'Seguir',
    /** 'En sesión · 12m de 25m', the last line above the button while a session runs. */
    inSession: (elapsed: string, planned: string) => `En sesión · ${elapsed} de ${planned}`,
    /** 'En sesión · 1h 12m · sin límite', the same line for an open session. */
    inSessionOpen: (elapsed: string) => `En sesión · ${elapsed} · sin límite`,
    /** The button: a tap starts. 'Enfocarme 25 min'. */
    focusFor: (minutes: string) => `Enfocarme ${minutes} min`,
    focusOpen: 'Enfocarme sin límite',
    /** The deep-mode button: the only one that asks for a hold. 'Mantén para enfocarme 25 min'. */
    holdFor: (minutes: string) => `Mantén para enfocarme ${minutes} min`,
    noModes: 'Sin modos',
    noModesHint: 'Un modo dice qué se bloquea mientras enfocas',
    createFirstMode: 'Crea tu primer modo ›',
  },
  pill: {
    /** '1h 45m enfocado hoy'. Only today: the week and its goal live in Actividad. */
    today: (today: string) => `${today} enfocado hoy`,
    /** What VoiceOver reads: the same number spelled out, then what a tap does. */
    label: (today: string) => `Hoy: ${today} enfocado. Ver la actividad`,
  },
  durationPicker: {
    /** '25 min', the row above the button. Tapping it opens the sheet. */
    minutes: (minutes: string) => `${minutes} min`,
    open: 'Sin límite',
    label: (current: string) => `Duración: ${current}. Toca para cambiar`,
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
