import type { CountryCode, Sex } from '../../domain/lifeExpectancy';
import type { Locale } from '../locale';

/** Life expectancy: the source line the domain builds, and the country names. */
export type LifeExpectancyStrings = {
  /** 'Sobre 77,6 años, un promedio de referencia.' `years` is already formatted. */
  sourceDefault: (years: string) => string;
  sourceCountry: (years: string, country: string) => string;
  sourceCountrySex: (years: string, country: string, sex: string) => string;
  /** 'mujeres' / 'hombres', as the source line says them. */
  sexWord: Record<Sex, string>;
  countries: Record<CountryCode, string>;
};

export type LanguageStrings = {
  title: string;
  /** The `auto` row: 'Automático' and the line under it. */
  auto: string;
  autoHint: string;
  /** Each language in its own words, in every dictionary: 'Español', 'English'. */
  names: Record<Locale, string>;
};

const language: LanguageStrings = {
  title: 'Idioma',
  auto: 'Automático',
  autoHint: 'Sigue el idioma del teléfono',
  names: { es: 'Español', en: 'English' },
};

const lifeExpectancy: LifeExpectancyStrings = {
  sourceDefault: (years) => `Sobre ${years} años, un promedio de referencia.`,
  sourceCountry: (years, country) => `Sobre ${years} años, esperanza de vida en ${country}.`,
  sourceCountrySex: (years, country, sex) => `Sobre ${years} años, esperanza de vida en ${country} para ${sex}.`,
  sexWord: { female: 'mujeres', male: 'hombres' },
  countries: {
    AR: 'Argentina',
    BO: 'Bolivia',
    BR: 'Brasil',
    CA: 'Canadá',
    CL: 'Chile',
    CO: 'Colombia',
    CR: 'Costa Rica',
    CU: 'Cuba',
    DE: 'Alemania',
    DO: 'República Dominicana',
    EC: 'Ecuador',
    ES: 'España',
    FR: 'Francia',
    GB: 'Reino Unido',
    GT: 'Guatemala',
    HN: 'Honduras',
    IT: 'Italia',
    JP: 'Japón',
    MX: 'México',
    NI: 'Nicaragua',
    PA: 'Panamá',
    PE: 'Perú',
    PT: 'Portugal',
    PY: 'Paraguay',
    SV: 'El Salvador',
    US: 'Estados Unidos',
    UY: 'Uruguay',
    VE: 'Venezuela',
  },
};

/** The Ajustes tab and every page under it, plus the Vida card of the Activity tab. */
export const settings = {
  tab: {
    title: 'Ajustes',
    thisPhone: 'Este teléfono',
    noAccount: 'Sin cuenta. Todo queda aquí.',
    rules: 'Mis reglas',
    emergency: 'Desbloqueo de emergencia',
    liveActivities: 'Live Activities',
    notifications: 'Notificaciones',
    health: 'Salud',
    life: 'Vida',
    help: 'Centro de ayuda',
    about: 'Acerca de Vesper',
    language: 'Idioma',
    /** 'Ninguna', '1 activa', '3 activas'. */
    activeRules: (count: number) => (count === 0 ? 'Ninguna' : count === 1 ? '1 activa' : `${count} activas`),
    /** 'Ninguno', '1 restante', '5 restantes'. */
    emergencyLeft: (left: number) => (left === 0 ? 'Ninguno' : left === 1 ? '1 restante' : `${left} restantes`),
    /** Live Activities and notifications, as a row value. */
    enabled: 'Activadas',
    disabled: 'Desactivadas',
    healthConnected: 'Conectada',
    healthNotConnected: 'Sin conectar',
    circle: 'Círculo',
    circleNoProfile: 'Sin perfil',
    /** 'Solo tú', '1 persona', '3 personas'. */
    circleValue: (members: number) =>
      members === 0 ? 'Solo tú' : members === 1 ? '1 persona' : `${members} personas`,
    noBirthDate: 'Sin fecha',
    reset: 'Borrar todo y reiniciar',
    resetCaption: 'Modos, rutinas, sesiones y hábitos se pierden.',
    resetConfirmTitle: '¿Borrar todo y reiniciar?',
    resetConfirmMessage: 'Modos, rutinas, sesiones y hábitos se pierden. No hay vuelta atrás.',
    resetConfirm: 'Borrar todo',
  },
  language,
  about: {
    title: 'Acerca de Vesper',
    /** 'Versión 2026.9.1'. The number lives in code. */
    version: (number: string) => `Versión ${number}`,
    body: 'Vesper mide el tiempo que inviertes, no el que consumes. Lo que haces con foco, lo que verifica Salud y lo que el teléfono estima viven en columnas distintas y nunca se suman. La idea es que veas tu tiempo como algo que se asigna, no como algo que se pierde.',
    prototypeNote: 'Prototipo con datos de ejemplo. Nada de lo que ves es real.',
  },
  emergency: {
    title: 'Desbloqueo de emergencia',
    cardTitle: 'Desbloqueo de emergencia',
    cardDescription: 'Termina una sesión sin esperar cuando de verdad lo necesitas',
    /** The badge: '5 restantes'. */
    left: (left: number) => (left === 1 ? '1 restante' : `${left} restantes`),
    perMonth: (total: number) => `Tienes ${total} por mes. Suficientes para una emergencia real, no para el scroll.`,
    /** The page only counts; the unlock itself lives in the session (ADR-0025). */
    fromSession: 'Se usa desde la sesión, con diez segundos de espera.',
  },
  health: {
    title: 'Salud',
    blocks: {
      how: { title: 'Cómo lo usas', text: 'Los hábitos verificados se marcan solos: gym, pasos, sueño. Tú no tocas nada.' },
      privacy: { title: 'Cómo lo usamos', text: 'Lo que Salud comparte nunca sale del teléfono. No hay cuenta ni servidor.' },
      why: {
        title: 'Por qué importa',
        text: 'Un hábito que se marca solo no se discute. Lo verificado y lo declarado nunca se suman.',
      },
    },
    denied: 'Salud no dio permiso. Puedes intentarlo de nuevo desde aquí.',
    connect: 'Conectar Salud',
    connecting: 'Conectando…',
    disconnect: 'Desconectar',
    syncNote: 'Salud se lee al abrir la app y cada 15 minutos. Nada sale del teléfono.',
  },
  help: {
    title: 'Centro de ayuda',
    faqTitle: 'preguntas frecuentes',
    faqs: [
      {
        question: '¿Qué es un modo?',
        answer:
          'Un conjunto de apps y sitios que se bloquean (o los únicos que se permiten) mientras enfocas. Cada sesión corre un modo.',
      },
      {
        question: '¿Qué pasa si cierro la app durante una sesión?',
        answer:
          'La sesión sigue. Al volver, el timer está donde lo dejaste. En modo firme o profundo, cerrar la app no la termina.',
      },
      {
        question: '¿Por qué no se suman las tres monedas?',
        answer:
          'Lo verificado (Salud), lo declarado (tú) y lo estimado (uso del teléfono) miden cosas distintas. Sumarlos daría un número que no significa nada.',
      },
      {
        question: '¿Cómo funciona el desbloqueo de emergencia?',
        answer: 'Espera diez segundos desde la sesión y la termina sin el ritual. Tienes cinco por mes.',
      },
      {
        question: '¿Vesper sube mis datos?',
        answer: 'No. No hay cuenta ni servidor. Todo vive en este teléfono.',
      },
    ],
    footer: '¿Otra cosa? En el prototipo no hay a quién escribirle todavía.',
  },
  life: {
    title: 'Vida',
    birth: 'Nacimiento',
    birthPlaceholder: 'aaaa-mm-dd',
    optional: 'Opcional',
    country: 'País',
    notChosen: 'Sin elegir',
    sex: { female: 'Mujer', male: 'Hombre', undisclosed: 'Prefiero no decirlo' },
    optionalHint:
      'Solo sirven para afinar la esperanza de vida de referencia. Sin ellos usamos un promedio. No pedimos peso ni altura: no los usamos.',
    expectancy: 'Esperanza de vida',
    years: 'Años',
    yearsPlaceholder: 'años',
    /** `years` is already formatted for the language. */
    manual: (years: string) => `Sobre ${years} años: lo pusiste tú. Cambiar el país o el sexo lo vuelve a calcular.`,
    weeksLeft: 'SEMANAS RESTANTES',
    noBirthDate: 'Escribe tu fecha de nacimiento para verlas.',
    /** Both numbers already formatted. */
    livedOfTotal: (lived: string, total: string) => `${lived} vividas de ${total} en total.`,
    localOnly: 'Se guarda solo en este teléfono.',
    countrySheet: 'País',
  },
  lifeExpectancy,
  /** The Vida card of the Activity tab. */
  lifeSection: {
    title: 'Vida',
    noBirthTitle: 'Pon tu fecha de nacimiento en Ajustes › Vida',
    noBirthBody: 'Sin eso no hay semanas que contar.',
    goToLife: 'Ir a Ajustes, Vida',
    /** `years` already formatted. */
    manualSource: (years: string) => `Sobre ${years} años, el número que pusiste tú.`,
    refineHint: 'Puedes afinarlo con tu país en Ajustes › Vida.',
    weeks: (count: number) => (count === 1 ? '1 semana' : `${count} semanas`),
    days: (count: number) => (count === 1 ? '1 día' : `${count} días`),
    /** 'Te quedan 2.340 semanas.' `left` is already '2.340 semanas'. */
    youHaveLeft: (left: string) => `Te quedan ${left}.`,
    makeThemCount: 'Haz que valgan la pena.',
    tapToSeeDays: 'Toca el número para verlo en días.',
    tapToSeeWeeks: 'Toca el número para verlo en semanas.',
    /** VoiceOver: what is left and what a tap does. */
    tapHint: (left: string, toDays: boolean) => `Te quedan ${left}. Toca para ver en ${toDays ? 'días' : 'semanas'}`,
    atYourPace: (consumed: string) => `A tu ritmo actual, ${consumed} de eso se irían en redes.`,
    estimateNote: 'Estimación con datos de ejemplo. El dato real llega con Tiempo de uso.',
  },
  liveActivities: {
    title: 'Live Activities',
    toggleTitle: 'Live Activities',
    toggleDescription: 'El timer en la pantalla bloqueada y en la Dynamic Island',
    /** The mode name the preview shows when no mode is active. */
    previewMode: 'Sin redes',
    /** 'Enfocado · quedan 24m'. */
    previewStatus: (remaining: string) => `Enfocado · quedan ${remaining}`,
    previewCaption: 'Así se ve mientras corre una sesión.',
  },
  notifications: {
    title: 'Notificaciones',
    tryNow: 'Probar ahora',
    allow: 'Permitir notificaciones',
    asking: 'Pidiendo permiso…',
    unavailableTitle: 'Aquí no hay notificaciones',
    deniedTitle: 'El permiso está apagado',
    deniedBody:
      'El sistema no lo vuelve a pedir. Actívalo en Ajustes del sistema › Vesper › Notificaciones y vuelve aquí.',
    pendingTitle: 'Vesper todavía no puede avisarte',
    pendingBody: 'Sin permiso no hay aviso al terminar una sesión ni cierre semanal. Se pide una sola vez.',
    generalGroup: 'General',
    systemGroup: 'Sistema',
    coaching: { label: 'Acompañamiento', description: 'Aviso cuando empieza una rutina' },
    sessionEnd: { label: 'Fin de sesión', description: 'Aviso cuando el timer termina' },
    weeklyClose: { label: 'Cierre semanal', description: 'El domingo a las 20:00, cómo cerró la semana' },
    updates: { label: 'Novedades importantes', description: 'Cambios que vale la pena saber' },
  },
  rules: {
    title: 'Mis reglas',
    strict: { title: 'Modo estricto', description: 'Impide terminar una sesión borrando la app' },
    installs: { title: 'Bloquear instalaciones', description: 'Evita instalar apps durante una sesión' },
    purchases: { title: 'Bloquear compras dentro de apps', description: 'Limita compras durante una sesión' },
    mature: {
      title: 'Bloquear contenido adulto',
      description: 'Limita contenido adulto en apps y sitios durante una sesión',
    },
    applied: 'Se aplican durante una sesión. Por ahora solo el filtro de contenido adulto llega al sistema.',
    notApplied: (reason: string) => `No se aplican: ${reason}.`,
  },
};
