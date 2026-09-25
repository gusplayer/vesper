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
  /** The `auto` row: 'Automático' and the line under it, naming what it resolves to. */
  auto: string;
  autoHint: (language: string) => string;
  /** Each language in its own words, in every dictionary: 'Español', 'English'. */
  names: Record<Locale, string>;
};

const language: LanguageStrings = {
  title: 'Idioma',
  auto: 'Automático',
  autoHint: (language) => `Sigue el idioma del teléfono: ${language}`,
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
    /**
     * No correo, no contraseña (ADR-0048 §1). What leaves without the circle is the
     * encrypted backup, on by default, and the line says so.
     */
    noAccount: 'Sin correo ni contraseña. Tus datos viven aquí; con el respaldo encendido sale una copia cifrada que solo tu clave abre.',
    /** Once the circle has an account on the server (ADR-0044 §2), "sin cuenta" is no longer true. */
    withAccount:
      'Tu círculo se sincroniza con el servidor de Vesper. Lo demás vive aquí; con el respaldo encendido sale una copia cifrada que solo tu clave abre.',
    rules: 'Mis reglas',
    emergency: 'Desbloqueo de emergencia',
    /** Apple's own Spanish name for Live Activities. */
    liveActivities: 'Actividades en tiempo real',
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
    /** A row whose capability does not exist on this phone (Live Activities on Android). */
    unavailable: 'No disponible',
    healthConnected: 'Conectada',
    healthNotConnected: 'Sin conectar',
    circle: 'Círculo',
    circleNoProfile: 'Sin perfil',
    /** Ajustes › Respaldo (ADR-0048 §7) and its switch, as a row value. */
    backup: 'Respaldo',
    backupOn: 'Activado',
    backupOff: 'Desactivado',
    /** 'Solo tú', '1 persona', '3 personas'. */
    circleValue: (members: number) =>
      members === 0 ? 'Solo tú' : members === 1 ? '1 persona' : `${members} personas`,
    noBirthDate: 'Sin fecha',
    reset: 'Borrar todo y reiniciar',
    resetCaption: 'Borra todo y empieza de cero, sin datos de ejemplo.',
    resetConfirmTitle: '¿Borrar todo y reiniciar?',
    resetConfirmMessage:
      'Se borra todo lo de este teléfono: modos, rutinas, sesiones, hábitos, Vida, tus ajustes y tu perfil del círculo, y en el servidor tu cuenta y tu respaldo. Vesper vuelve a la bienvenida y empieza vacío, sin datos de ejemplo. No hay vuelta atrás.',
    resetConfirm: 'Borrar todo',
    /**
     * "Quitar los datos de ejemplo" (ADR-0047 §1): shown only while something seeded is
     * left. It takes the examples and nothing the user made.
     */
    removeDemo: 'Quitar los datos de ejemplo',
    removeDemoCaption: 'Deja solo lo que creaste tú.',
    removeDemoConfirmTitle: '¿Quitar los datos de ejemplo?',
    removeDemoConfirmMessage:
      'Se borran las sesiones, los modos, las rutinas y los hábitos de ejemplo, con sus marcas, y el círculo de ejemplo. Lo que creaste tú se queda. Un ejemplo que editaste también se va.',
    removeDemoConfirm: 'Quitar',
    /** The row while the reset runs: deleting the circle account can take a few seconds. */
    resetting: 'Borrando…',
  },
  language,
  about: {
    title: 'Acerca de Vesper',
    /** 'Versión 2026.9.1'. The number lives in code. */
    version: (number: string) => `Versión ${number}`,
    body: 'Vesper mide el tiempo que inviertes, no el que consumes. Lo que haces con foco, lo que verifica Salud y lo que el teléfono estima viven en columnas distintas y nunca se suman. La idea es que veas tu tiempo como algo que se asigna, no como algo que se pierde.',
    /** The two texts live on the web, not in the app (ADR-0046). These rows open it. */
    terms: 'Términos de uso',
    privacy: 'Privacidad',
    legalNote: 'Se abren en el navegador.',
    linkFailed: 'No se pudo abrir el navegador.',
    /** Honest until the demo data policy is decided: the reset brings the sample data back. */
    /** Only while the sample data is still there. */
    demoNote:
      'Vesper arranca con datos de ejemplo para que no la veas vacía. Quítalos cuando quieras en Ajustes › Quitar los datos de ejemplo.',
    circleNote: 'El círculo se sincroniza solo cuando invitas a alguien o usas un código.',
  },
  emergency: {
    title: 'Desbloqueo de emergencia',
    cardTitle: 'Desbloqueos este mes',
    cardDescription: 'Terminan una sesión sin el ritual de salida, cuando de verdad lo necesitas',
    /** The badge: '5 restantes', 'Ninguno' at zero like the Ajustes row. */
    left: (left: number) => (left === 0 ? 'Ninguno' : left === 1 ? '1 restante' : `${left} restantes`),
    perMonth: (total: number) => `Tienes ${total} por mes. Suficientes para una emergencia real, no para el scroll.`,
    /** `date` is already '1 de octubre'. The count fills again on the first of each month. */
    refills: (date: string) => `Se renuevan el ${date}.`,
    /** The page only counts; the unlock itself lives in the session (ADR-0025). */
    fromSession: 'Se usa desde la sesión, tras diez segundos de espera.',
  },
  health: {
    title: 'Salud',
    blocks: {
      how: { title: 'Hábitos que se marcan solos', text: 'Gym, pasos y sueño se confirman con Salud. No tienes que tocar nada.' },
      /** ADR-0042 §3: a step challenge shares the days met, a datum derived from Health. */
      privacy: {
        title: 'Tus lecturas se quedan aquí',
        /** ADR-0048 §7: the days a habit was met travel, encrypted, in the backup. */
        text: 'Tus pasos, entrenamientos y sueño no salen del teléfono. Los días que un hábito se cumplió van cifrados en tu respaldo, y si te unes a un reto de pasos tu círculo ve qué días llegaste a la meta, nunca cuántos pasos. Vesper solo lee; nunca escribe en Salud.',
      },
      why: {
        title: 'Verificado, no declarado',
        text: 'Un hábito que se marca solo no se discute. Lo verificado y lo declarado nunca se suman.',
      },
    },
    denied: 'Salud no dio permiso. Puedes intentarlo de nuevo desde aquí.',
    connect: 'Conectar Salud',
    connecting: 'Conectando…',
    disconnect: 'Desconectar',
    disconnectTitle: '¿Desconectar Salud?',
    disconnectMessage:
      'Los hábitos verificados dejan de marcarse solos y se quitan las marcas que vinieron de Salud. El permiso sigue en Salud: quítalo ahí si quieres.',
    /** There is no timer: Health is read on open and on every return, throttled (useHealthSync). */
    syncNote:
      'Salud se lee cuando abres Vesper, como mucho una vez cada 15 minutos. Tus pasos, entrenamientos y sueño no salen del teléfono; los días cumplidos van cifrados en tu respaldo, y en un reto de pasos tu círculo solo ve qué días llegaste a la meta.',
    /** iOS never says whether reading was allowed: an empty week is what a refusal looks like. */
    iosEmptyHint: 'Si no ves nada, revisa en Ajustes del sistema › Privacidad y seguridad › Salud › Vesper.',
    /** Android: Health Connect, not the app, holds what is read (ADR-0043). */
    install: 'Instalar Health Connect',
    installFailed: 'No se pudo abrir la tienda.',
    healthConnectNote:
      'En Android, Salud se lee de Health Connect. Si no ves tus pasos, abre Health Connect y conecta Samsung Health, Google Fit o tu reloj.',
    openHealthConnect: 'Abrir Health Connect',
  },
  help: {
    title: 'Centro de ayuda',
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      {
        question: '¿Qué es un modo?',
        answer:
          'Un conjunto de apps y sitios que se bloquean (o los únicos que se permiten) mientras enfocas. Cada sesión corre un modo.',
      },
      {
        question: '¿Qué pasa si cierro la app durante una sesión?',
        answer: 'La sesión sigue, y el bloqueo también. Al volver, el reloj está donde lo dejaste. Si termina con la app cerrada, ves su cierre la próxima vez que la abras.',
      },
      {
        question: '¿Por qué Vesper no suma todo el tiempo?',
        answer:
          'Lo que confirma Salud, lo que declaras tú y lo que estima el teléfono miden cosas distintas. Sumarlos daría un número que no significa nada.',
      },
      {
        question: '¿Cómo funciona el desbloqueo de emergencia?',
        answer:
          'En la sesión, toca el salvavidas de arriba a la derecha, espera diez segundos y la sesión termina sin el ritual de salida. Tienes cinco al mes; se renuevan el día 1.',
      },
      {
        question: '¿Vesper sube mis datos?',
        answer:
          'Solo cifrados. Tus sesiones, modos, hábitos y lo que viene de Salud viven en este teléfono, y el respaldo sube una copia que se cifra aquí: el servidor la guarda, pero no puede leerla. Lo único que sale sin cifrar es lo que compartes con tu círculo, si lo usas, y un identificador sin nombre con el sistema, la versión de la app y cuándo la abriste por última vez. El respaldo se apaga en Ajustes › Respaldo.',
      },
    ],
    /** ADR-0047 §13: the contact the owner chose. The address itself lives in the screen. */
    contactTitle: '¿Otra cosa?',
    contact: 'Escríbenos',
    /** When no mail app can open the address: say it so it can be copied by hand. */
    contactFailed: (address: string) => `No hay una app de correo para abrirlo. Escribe a ${address}.`,
  },
  life: {
    title: 'Vida',
    birth: 'Nacimiento',
    birthPlaceholder: 'aaaa-mm-dd',
    /** Vida is opt-in (docs/PRD.md §3): an empty date is a valid answer. */
    birthHint: 'Déjala vacía si no quieres contar semanas.',
    optional: 'Opcional',
    country: 'País',
    notChosen: 'Sin elegir',
    sexLabel: 'Sexo',
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
    /** The birth date travels only inside the encrypted backup (ADR-0048 §7). */
    localOnly: 'Se guarda en este teléfono y solo sale cifrado, en tu respaldo.',
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
    weeks: (count: number, tag: string) => (count === 1 ? '1 semana' : `${count.toLocaleString(tag)} semanas`),
    days: (count: number, tag: string) => (count === 1 ? '1 día' : `${count.toLocaleString(tag)} días`),
    /** 'Te quedan 2.340 semanas.' `left` is already '2.340 semanas'. */
    youHaveLeft: (left: string) => `Te quedan ${left}.`,
    makeThemCount: 'Haz que valgan la pena.',
    tapToSeeDays: 'Toca el número para verlo en días.',
    tapToSeeWeeks: 'Toca el número para verlo en semanas.',
    /** VoiceOver: what is left and what a tap does. */
    tapHint: (left: string, toDays: boolean) => `Te quedan ${left}. Toca para ver en ${toDays ? 'días' : 'semanas'}`,
    atYourPace: (consumed: string) => `A tu ritmo actual, ${consumed} de eso se irían en redes.`,
    /** The projection runs on this week's real floor (Android, ADR-0029). */
    deviceNote: 'Estimación con el uso real de esta semana, siempre como piso.',
  },
  liveActivities: {
    title: 'Actividades en tiempo real',
    toggleTitle: 'Actividades en tiempo real',
    toggleDescription: 'El reloj de la sesión en la pantalla bloqueada y, si tu iPhone la tiene, en la Dynamic Island',
    /** The mode name the preview shows when no mode is active. */
    previewMode: 'Sin redes',
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
      'El sistema ya no lo pregunta. Actívalo en Ajustes del sistema › Vesper › Notificaciones; al volver, Vesper lo nota solo.',
    /** The primary once the system will not ask again: opens the app's page in the system settings. */
    openSettings: 'Abrir Ajustes del sistema',
    pendingTitle: 'Vesper todavía no puede avisarte',
    pendingBody: 'Sin permiso no hay aviso al terminar una sesión ni cierre semanal. Se pide una sola vez.',
    generalGroup: 'General',
    dailyGroup: 'Cada día',
    circleGroup: 'Círculo',
    coaching: { label: 'Acompañamiento', description: 'Aviso cuando empieza una rutina' },
    sessionEnd: { label: 'Fin de sesión', description: 'Aviso cuando el reloj de la sesión llega a cero' },
    weeklyClose: { label: 'Cierre semanal', description: 'El domingo a las 20:00, cómo cerró la semana' },
    streak: { label: 'Racha en riesgo', description: 'Si a la hora del aviso todavía no llevas 10 minutos hoy' },
    noFocus: { label: 'Día sin foco', description: 'Si a la hora del aviso no has enfocado' },
    reactivation: { label: 'Volver', description: 'A los 3 y a los 7 días sin abrir Vesper' },
    challenges: {
      label: 'Retos',
      description: 'Cuando un reto ya no admite fallar otro día, y cuando termina',
    },
    /** The row and the sheet share the name. */
    reminderTime: { label: 'Hora del aviso', sheet: 'Hora del aviso' },
    /** The stagger of ADR-0040: the daily notices start at the chosen hour, minutes apart. */
    dailyCaption:
      'Máximo dos avisos al día fuera de la sesión y la rutina, desde esa hora y con unos minutos entre uno y otro. Nada entre 22:00 y 8:00, y nunca durante una sesión.',
    nudges: {
      label: 'Avisos del círculo',
      description: 'Cuando alguien te empuja en un reto, pide entrar a tu círculo o te acepta en el suyo. Nunca durante una sesión.',
    },
  },
  rules: {
    title: 'Mis reglas',
    installs: { title: 'Bloquear instalaciones', description: 'Evita instalar apps durante una sesión' },
    purchases: { title: 'Bloquear compras dentro de apps', description: 'Limita compras durante una sesión' },
    mature: {
      title: 'Bloquear contenido adulto',
      description: 'Limita contenido adulto en apps y sitios durante una sesión',
    },
    applied: 'Se aplican durante una sesión.',
    /** Every rule is on, and this phone applies none of them (Android today). */
    noneApplied: 'En este teléfono ninguna llega al sistema todavía. Se guardan para cuando Vesper pueda aplicarlas.',
    notApplied: (reason: string) => `No se aplican: ${reason}.`,
    /** Under a rule this phone keeps but cannot apply: no flag passes for a capability. */
    notYet: 'Todavía no llega al sistema en este teléfono.',
  },
};
