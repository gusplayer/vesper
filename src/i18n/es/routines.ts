/**
 * The Rutinas tab and the routine editor. The tab title lives in `common.tabs`;
 * days and windows ('9:00 – 18:00 · Entre semana') come from `format`.
 */
export const routines = {
  /** The first line under a routine's name, built by `features/schedules/status.ts`. */
  status: {
    /** Indexed by `Date.getDay()`, Sunday first. Lowercase, like everything the user sees. */
    weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    today: 'Hoy',
    tomorrow: 'Mañana',
    /** 'El lunes'. */
    onWeekday: (weekday: string) => `El ${weekday}`,
    /** 'las 9:00', but 'la 1:00': one o'clock is singular in Spanish. */
    clock: (time: string, hour: number) => `${hour === 1 ? 'la' : 'las'} ${time}`,
    /** 'Activa · hasta las 18:00'. */
    active: (clock: string) => `Activa · hasta ${clock}`,
    /** The same window, while its session runs. */
    running: (clock: string) => `En curso · hasta ${clock}`,
    /** 'Hoy a las 21:30', 'El lunes a las 9:00'. */
    next: (day: string, clock: string) => `${day} a ${clock}`,
    /** A routine you start by hand. */
    manual: (minutes: number) => `Cuando quieras · ${minutes} min`,
    never: 'Sin días elegidos',
  },
  list: {
    createA11y: 'Crear rutina',
    createWhileRunning: 'No se pueden agregar rutinas durante una sesión activa',
    startWhileRunning: 'Ya hay una sesión en marcha',
    /** The line that names the mode on a card, when that mode is gone. */
    missingMode: 'Modo eliminado',
    empty: 'Todavía no hay rutinas. Una rutina enciende un modo sola, a la hora que elijas.',
    crossesWith: (name: string) => `Se cruza con ${name}`,
    start: (name: string) => `Empezar ${name}`,
    cardA11y: (name: string, lines: string) => `${name}, ${lines}. Editar`,
    /** Android without the exact-alarm toggle (rule 8): why, and the word that opens it. */
    exactAlarmsOff: 'Sin alarmas exactas, una rutina puede empezar hasta diez minutos tarde.',
    exactAlarmsTurnOn: 'Activar',
  },
  edit: {
    newTitle: 'Nueva rutina',
    editTitle: 'Editar rutina',
    save: 'Guardar rutina',
    remove: 'Eliminar rutina',
    kindTimed: 'A una hora',
    kindManual: 'Cuando quieras',
    name: 'Nombre',
    namePlaceholder: 'p. ej. Trabajo, Familia',
    starts: 'Empieza',
    ends: 'Termina',
    /** What "Termina" says when the routine runs until the user ends it. */
    openEnd: 'Hasta que lo termines',
    mode: 'Modo',
    pickMode: 'Elige uno',
    repeat: 'Repetir',
    duration: 'Duración',
    /** '20 min', the duration chips. */
    minutesChip: (minutes: string) => `${minutes} min`,
    overlapTitle: 'Rutinas superpuestas',
    overlapMessage: (name: string) =>
      `Esta rutina se cruza con '${name}'. Si las dos están encendidas, solo una corre a la vez.`,
    pickTime: 'Elige la hora',
    hour: 'hora',
    minutes: 'minutos',
  },
  /** Cancel comes from `common`. */
  deleteAlert: {
    title: '¿Eliminar esta rutina?',
    message: 'No se puede deshacer.',
    confirm: 'Eliminar',
  },
};
