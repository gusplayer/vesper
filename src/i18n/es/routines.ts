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
    /** The window is open but another session is running: the engine waits for it (ADR-0019). */
    waiting: (clock: string) => `Espera a que termine tu sesión · hasta ${clock}`,
    /**
     * The same three for a window with no end time: its session is open and ends when
     * you end it (ADR-0047 §3c), so no hour is named.
     */
    activeOpen: 'Activa · hasta que la termines',
    runningOpen: 'En curso · hasta que la termines',
    waitingOpen: 'Espera a que termine tu sesión',
    /**
     * A window that already started today and whose session is over: it will not
     * start again. 'Hoy ya pasó · mañana a las 9:00'. The day arrives capitalized
     * ('Mañana', 'El lunes') and goes mid-sentence here.
     */
    done: (day: string, clock: string) => `Hoy ya pasó · ${day.toLowerCase()} a ${clock}`,
    /** The same, for a routine with no next start to name. */
    doneOnly: 'Hoy ya pasó',
    /** 'Hoy a las 21:30', 'El lunes a las 9:00'. */
    next: (day: string, clock: string) => `${day} a ${clock}`,
    /** A routine you start by hand. */
    manual: (minutes: number) => `Cuando quieras · ${minutes} min`,
    never: 'Sin días elegidos',
  },
  list: {
    createA11y: 'Crear rutina',
    /** The row at the end of an empty list. */
    create: 'Crear rutina',
    createWhileRunning: 'No se pueden agregar rutinas durante una sesión activa',
    startWhileRunning: 'Ya hay una sesión en marcha',
    /** The line that names the mode on a card, when that mode is gone: the card opens the editor. */
    missingMode: 'Modo eliminado · toca para elegir otro',
    empty: 'Todavía no hay rutinas. Una rutina enciende un modo sola, a la hora que elijas, o cuando tú quieras.',
    crossesWith: (name: string) => `Se cruza con ${name}`,
    start: (name: string) => `Empezar ${name}`,
    /** The same play with a deep mode: it gets Focus ready, where the button is held. */
    prepare: (name: string) => `Preparar ${name} en Focus`,
    /** A routine that is off says so: its dimmed card is not read aloud. */
    cardA11y: (name: string, lines: string, off: boolean) => `${name}${off ? ', apagada' : ''}, ${lines}. Editar`,
    /** Android without the exact-alarm toggle (rule 8): why, and the word that opens it. */
    exactAlarmsOff: 'Sin alarmas exactas, una rutina puede empezar hasta diez minutos tarde.',
    exactAlarmsTurnOn: 'Activar',
    /** Once, above the cards, where this phone cannot block (rule 8). */
    cannotBlock: (reason: string) => `Las rutinas te avisan a su hora, pero no bloquean apps: ${reason}.`,
    /** Android, when the missing piece is a Settings toggle the app can send you to. */
    grantAccess: 'Dar el acceso',
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
    /**
     * What "Termina" says when the routine has no end time: its session starts open and
     * ends when you end it, deep running as firm (ADR-0047 §3c, like "Sin límite").
     */
    openEnd: 'Hasta que lo termines',
    /** An end at or before the start is the next day, as the engine reads it. */
    nextDay: (time: string) => `${time} (día siguiente)`,
    /** Start and end on the same minute: the engine would read a 24-hour window. */
    sameStartEnd: 'Empieza y termina a la misma hora. Elige otra hora de fin.',
    mode: 'Modo',
    pickMode: 'Elige uno',
    /** The mode sheet when there are no modes left to pick. */
    createMode: 'Crear un modo',
    repeat: 'Repetir',
    duration: 'Duración',
    /** '20 min', the duration chips. */
    minutesChip: (minutes: string) => `${minutes} min`,
    overlapTitle: 'Rutinas superpuestas',
    overlapMessage: (name: string) =>
      `Esta rutina se cruza con “${name}”. Si una ya está en curso, la otra espera a que termine.`,
    /** The two sections of the time sheet. */
    hour: 'Hora',
    minutes: 'Minutos',
  },
  /** Cancel comes from `common`. */
  deleteAlert: {
    title: (name: string) => `¿Eliminar “${name}”?`,
    message: 'No se puede deshacer.',
    confirm: 'Eliminar',
  },
};
