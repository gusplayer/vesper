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
  /**
   * The line under the title while any seeded row is left (ADR-0047 §1), the same
   * words Focus uses. It opens Ajustes, where the sample data is removed.
   */
  demo: {
    line: 'Incluye datos de ejemplo. Quítalos en Ajustes.',
    hint: 'Abre Ajustes',
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
    /**
     * What VoiceOver reads for the month chart: 'Septiembre: 46h 20m en 18 días.
     * Tu mejor día: 5h 10m.' `days` arrives already spelled ('18 días').
     */
    month: (month: string, total: string, days: string, best: string) =>
      `${month}: ${total} en ${days}. Tu mejor día: ${best}.`,
    /** The month chart of a month with no focus at all. */
    monthEmpty: (month: string) => `${month}: sin foco.`,
    /** A month grid of the lifetime card: 'Sep 2026: 12 días con foco'. `days` is spelled. */
    monthGrid: (month: string, days: string) => `${month}: ${days} con foco`,
  },
  weekly: {
    /** Sentence case: the strip sets its own capitals (PeriodStrip). */
    lastWeek: 'Semana pasada',
    thisWeek: 'Esta semana',
    averagePerDay: 'Promedio por día',
    /** Only while the very first week of all is still empty. */
    firstWeek: 'Tu primera semana está en marcha. Vuelve por tu promedio.',
    /** This week, with history behind it, before its first session. */
    noFocusYet: 'Todavía no hay foco esta semana.',
    /** A past week that had none. */
    noFocusThatWeek: 'Sin foco esa semana.',
    today: 'Hoy',
  },
  monthly: {
    totalFocused: 'Tiempo enfocado total',
    /** A month still running can get days; a closed one cannot. */
    noFocusedDays: (current: boolean): string =>
      current ? 'Todavía no hay días enfocados este mes.' : 'No hubo días enfocados ese mes.',
    /**
     * Over the days that have happened, a day off counting as zero, like the week's
     * (ADR-0047 §4). A month still running "va en"; a closed one "fue".
     */
    dailyAverage: (current: boolean, duration: string) =>
      current ? `Tu promedio diario este mes va en ${duration}.` : `Tu promedio diario ese mes fue ${duration}.`,
    patterns: 'Patrones',
    rhythmTitle: 'Tu ritmo semanal',
    /** It folds the whole history, not the month above it. */
    rhythmDescription: 'Tu tiempo enfocado promedio por día de la semana, desde tu primera sesión.',
    rhythmEmpty: 'Aparece con tu primera semana de foco.',
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
    /** 'al menos 2h 10m': the social figure is a floor (ADR-0004, ADR-0029). */
    atLeast: (duration: string) => `al menos ${duration}`,
    unregistered: 'Sin registrar',
    /** Under 'Enfocado' when the declared day passed the 6 h cap (ADR-0010). */
    capped: 'tope de 6h declarables alcanzado',
    footer: 'Foco, redes y lo que confirma Salud se cuentan aparte. Nunca se suman.',
    /** The per-app breakdown under the social row (ADR-0029). */
    usage: {
      /** VoiceOver: 'Instagram, al menos 34 min'. */
      appLabel: (name: string, duration: string) => `${name}, al menos ${duration}`,
      /** The demo stands in for the total too, not only for the apps under it. */
      demo: 'La cifra de redes y su desglose son datos de ejemplo.',
      /** When the phone read the figures: 'Leído: 10:42.' ('a las' breaks at 1:05). */
      readAt: (time: string) => `Leído: ${time}.`,
      /** Why the phone gives nothing, one sentence each (rule 8). */
      ios: 'iOS solo muestra el uso por app dentro de Tiempo de uso.',
      noModule: 'Esta versión de Vesper no puede leer el uso por app.',
      noUsageAccess:
        'Falta el acceso a datos de uso. Actívalo en Ajustes del sistema › Apps › Acceso especial › Acceso a datos de uso.',
      /** A fact, not an order: a mode that blocks nothing is a valid choice (ADR-0047 §1). */
      noApps: 'Ningún modo bloquea apps de este teléfono, así que no hay uso que medir.',
      /** The read itself failed: never a zero passed off as measured (rule 8). */
      readFailed: 'El teléfono no pudo dar el uso de hoy.',
      /** The row under `noApps`: the modes, for whoever wants to add apps to one. */
      pickApps: 'Ver modos',
      /** The row that fixes `noUsageAccess`: it opens the disclosure Play requires first. */
      grantAccess: 'Dar el acceso a datos de uso',
    },
  },
  /** The Life card's last line (ADR-0029). `settings.lifeSection` holds the rest. */
  life: {
    /** Followed by the reason from `platform/usage`, as Hoy does. */
    demoNote: 'Estimación con datos de ejemplo.',
    /** What VoiceOver reads for the weeks-of-life grid. */
    gridA11y: (lived: number, total: number, tag: string) =>
      `${lived.toLocaleString(tag)} semanas vividas de ${total.toLocaleString(tag)}`,
  },
  weeklyGoal: {
    title: 'Meta semanal',
    /** The card's hint: what a tap does. */
    change: 'Cambia la meta semanal',
    /** The card to VoiceOver: '7h 20m de 15h, 3 días para el cierre'. */
    cardA11y: (progress: string, status: string) => `${progress}, ${status}`,
    noGoal: 'Sin meta. Toca para elegir una.',
    met: 'Meta cumplida',
    /** '3 días para el cierre'. */
    untilClose: (days: string) => `${days} para el cierre`,
    footer: 'Toca la tarjeta para cambiarla. Se reinicia cada lunes.',
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
    /** Grace bridges every day that falls short while the month has some (domain/streak). */
    footer: (minutes: number, perMonth: number) =>
      `Si un día no llega a ${minutes} minutos, un día de gracia lo cubre solo. Tienes ${perMonth} por mes.`,
  },
  ledger,
};
