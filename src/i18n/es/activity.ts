import type { HealthSample } from '../../domain/types';

/**
 * The labels of the day ledger (domain/ledger.ts). Keyed by health type so a new
 * sample type fails here, in both languages, before it reaches a screen.
 */
export type LedgerStrings = {
  /** The part of the day no interval covers (ADR-0010). */
  unknown: string;
  /** The social apps estimate (ADR-0004). */
  usage: string;
  health: Record<HealthSample['type'], string>;
};

const ledger: LedgerStrings = {
  unknown: 'sin registrar',
  usage: 'redes',
  health: {
    workout: 'entrenamiento',
    steps: 'caminata',
    sleep: 'sueño',
    exercise_time: 'ejercicio',
  },
};

/** The activity tab: weekly, monthly and lifetime views, today's ledger, the weekly goal. */
export const activity = {
  header: {
    title: {
      week: 'Actividad semanal',
      month: 'Actividad mensual',
      lifetime: 'Actividad de por vida',
    },
    option: {
      week: 'Semanal',
      month: 'Mensual',
      lifetime: 'De por vida',
    },
    chooseView: 'Elegir qué actividad ver',
    sheetTitle: 'Ver',
  },
  dates: {
    /**
     * Short month names, January first, for the period strip and the month captions.
     * Hand-written because Intl varies by region ('sept.', 'sept') and the strip needs
     * a fixed width. Weekday and long month names come from Intl.
     */
    monthShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    /** 'domingo 13 de septiembre', the spoken form of a day. */
    dayLong: (weekday: string, day: number, month: string) => `${weekday} ${day} de ${month}`,
    /** 'mié, 24 sep', the caption of a day card. */
    dayShort: (weekday: string, day: number, month: string) => `${weekday}, ${day} ${month}`,
  },
  units: {
    sessions: (count: number) =>
      count === 0 ? 'Sin sesiones' : count === 1 ? '1 sesión' : `${count} sesiones`,
    hours: (count: number, tag: string) =>
      count === 1 ? '1 hora' : `${count.toLocaleString(tag)} horas`,
    days: (count: number, tag: string) =>
      count === 1 ? '1 día' : `${count.toLocaleString(tag)} días`,
    weeks: (count: number, tag: string) =>
      count === 1 ? '1 semana' : `${count.toLocaleString(tag)} semanas`,
  },
  spoken: {
    /** '30 % más que la semana anterior'. The words carry the direction. */
    delta: (percent: string, direction: 'up' | 'down') =>
      `${percent} % ${direction === 'up' ? 'más' : 'menos'} que la semana anterior`,
    deltaFlat: 'Igual que la semana anterior',
    /** A bar with nothing in it, as VoiceOver reads it. */
    noFocus: 'sin foco',
    today: 'Hoy',
  },
  weekly: {
    lastWeek: 'SEMANA PASADA',
    thisWeek: 'ESTA SEMANA',
    averagePerDay: 'Promedio por día',
    firstWeek: 'Tu primera semana está en marcha. Vuelve por tu promedio.',
    today: 'HOY',
  },
  monthly: {
    totalFocused: 'Tiempo enfocado total',
    noFocusedDays: (current: boolean) =>
      `Todavía no hay días enfocados ${current ? 'este mes' : 'ese mes'}.`,
    dailyAverage: (current: boolean, duration: string) =>
      `Tu promedio diario ${current ? 'este mes' : 'ese mes'} fue ${duration}`,
    patterns: 'PATRONES',
    rhythmTitle: 'Tu ritmo semanal',
    rhythmDescription: 'Así se ve tu tiempo enfocado promedio por día de la semana.',
  },
  lifetime: {
    totalFocused: 'ENFOCADO EN TOTAL',
    bestDay: (duration: string) => `Tu mejor día: ${duration}.`,
    noSessionYet: 'Tu primera sesión todavía no llegó.',
    daysWithFocus: 'DÍAS CON FOCO',
    noDayYet: 'Todavía ninguno.',
    since: (month: string) => `Desde ${month}.`,
  },
  /** The vertical bar charts: the pill on the average line. */
  chart: {
    average: 'PROM',
  },
  today: {
    title: 'Hoy',
    focused: 'Enfocado',
    social: 'Redes (estimado)',
    socialDescription: 'siempre un piso, nunca exacto',
    /** '≥ 2h 10m': the social figure is a floor (ADR-0004). */
    atLeast: (duration: string) => `≥ ${duration}`,
    unregistered: 'Sin registrar',
    footer: 'Tres monedas separadas. Nunca se suman.',
    /** The per-app breakdown under the social row (ADR-0029). */
    usage: {
      /** VoiceOver: 'Instagram, al menos 34 min'. */
      appLabel: (name: string, duration: string) => `${name}, al menos ${duration}`,
      demo: 'Desglose con datos de ejemplo.',
      /** When the phone read the figures: 'Leído a las 10:42.' */
      readAt: (time: string) => `Leído a las ${time}.`,
      /** Why the phone gives nothing, one sentence each (rule 8). */
      ios: 'iOS solo muestra el uso por app dentro de Tiempo de uso.',
      noModule: 'Este build no trae el módulo de uso.',
      noUsageAccess: 'Falta el acceso de uso en Ajustes.',
      noApps: 'Elige apps reales en un modo para medir su uso.',
    },
  },
  weeklyGoal: {
    title: 'Meta semanal',
    change: 'Cambiar la meta semanal',
    noGoal: 'Sin meta. Toca para elegir una.',
    met: 'Meta cumplida',
    /** '3 días para el cierre'. */
    untilClose: (days: string) => `${days} para el cierre`,
    footer: 'Se reinicia el lunes. Una meta por semana.',
    sheetTitle: 'Horas por semana',
    /** Feminine, for "meta": not `common.none`. */
    none: 'Ninguna',
  },
  streak: {
    title: 'Racha',
    /** '12 días seguidos', the card's heading (ADR-0027). */
    days: (count: number, tag: string) =>
      count === 1 ? '1 día seguido' : `${count.toLocaleString(tag)} días seguidos`,
    none: 'Sin racha todavía',
    /** What a day needs and the grace left this month. The minutes come from the domain. */
    explain: (minutes: number, graceLeft: number) =>
      `Un día cuenta con ${minutes} minutos de foco. ${
        graceLeft === 0
          ? 'No te quedan días de gracia este mes.'
          : graceLeft === 1
            ? 'Te queda 1 día de gracia este mes.'
            : `Te quedan ${graceLeft} días de gracia este mes.`
      }`,
    footer: 'Los días de gracia se aplican solos al primer día que falla. Tres por mes.',
  },
  ledger,
};
