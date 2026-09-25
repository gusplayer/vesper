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
    /** Under the deep-mode button after a press too short to start. */
    holdHint: 'Mantén presionado para empezar',
    noModes: 'Sin modos',
    noModesHint: 'Un modo dice qué se bloquea mientras enfocas',
    createFirstMode: 'Crea tu primer modo',
    /** Under the mode line when a deep mode meets "sin límite": the session will not be deep. */
    openRunsFirm: 'Sin límite: este modo corre como firme.',
    /** While any seeded row is left (ADR-0047 §1). Tapping it opens Ajustes. */
    demo: 'Incluye datos de ejemplo. Quítalos en Ajustes.',
    demoHint: 'Abre Ajustes',
    /** After a routine's play set the mode and the duration here (ADR-0047 §3a). */
    routineReady: (name: string) => `Rutina ${name} lista para empezar.`,
  },
  /**
   * What a session in the mode really blocks (rule 8, ADR-0047 §1). A mode that blocks
   * no apps is a valid choice, so it is said as a plain fact. Only "this phone cannot
   * block" carries its reason, once per page. `summary` is the platform's own words for
   * the selection ('3 apps · 1 categoría'); `reason` is its lowercase fragment.
   */
  blocking: {
    blocks: (summary: string) => `Bloquea ${summary}`,
    allowsOnly: (summary: string) => `Permite solo ${summary}`,
    none: 'No bloquea apps',
    unavailable: 'Este teléfono no bloquea apps.',
    unavailableBecause: (reason: string) => `Este teléfono no bloquea apps: ${reason}.`,
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
    /** What VoiceOver adds after the row's words. */
    hint: 'Abre las duraciones',
    /**
     * The optional intention in the same sheet (ADR-0047 §10): kept with the session,
     * shown while it runs and on its closing.
     */
    intention: 'Intención',
    intentionPlaceholder: 'Opcional',
    intentionHint: 'Qué quieres hacer en esta sesión. Se ve mientras corre y al cerrarla.',
    /** Under the duration row once one is written: '“Terminar el esquema”'. */
    intentionQueued: (text: string) => `“${text}”`,
  },
  modePicker: {
    title: 'Modo',
    /** What VoiceOver adds after the mode's name. */
    hint: 'Abre la lista de modos',
    manage: 'Gestionar modos',
  },
  nextRoutine: {
    /** 'Trabajo · activa hasta las 18:00', while a routine is inside its window. */
    activeUntil: (name: string, time: string) => `${name} · activa hasta las ${time}`,
    startsAt: (name: string, time: string) => `${name} empieza a las ${time}`,
    startsTomorrowAt: (name: string, time: string) => `${name} empieza mañana a las ${time}`,
  },
  recentDays: {
    /** What VoiceOver reads for the grid: the count, then what a tap does. */
    gridSummary: (days: number) =>
      `Últimas cuatro semanas: ${days === 1 ? '1 día' : `${days} días`} con foco. Toca para ver la actividad`,
  },
  streak: {
    /** '12 días seguidos · 2 de gracia', the line under the pill (ADR-0027). */
    line: (days: number, graceLeft: number) =>
      `${days === 1 ? '1 día seguido' : `${days} días seguidos`} · ${graceLeft === 1 ? '1 de gracia' : `${graceLeft} de gracia`}`,
    /** Without a streak: what a day needs. The minutes come from the domain. */
    none: (minutes: number) => `Sin racha todavía. Hoy cuentan ${minutes} minutos.`,
    /** The morning after a grace day bridged yesterday. Said once, never notified. */
    graceYesterday: (days: number) =>
      `Ayer usaste un día de gracia. Llevas ${days === 1 ? '1 día' : `${days} días`}.`,
  },
};
