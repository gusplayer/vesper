/**
 * The modes area: the list, the editor, the app and website pickers, the ideas, the
 * read-only sheet during a session, and the summary line every mode card carries.
 */
export const modes = {
  /**
   * The line under a mode name, counting what really blocks (data/modes.modeSummaryText):
   * 'Bloquea 3 apps', 'Permite solo 2 apps', 'No bloquea apps'.
   */
  summary: {
    apps: (count: number) => `${count} ${count === 1 ? 'app' : 'apps'}`,
    sites: (count: number) => `${count} ${count === 1 ? 'sitio' : 'sitios'}`,
    blocks: (apps: string) => `Bloquea ${apps}`,
    allowsOnly: (apps: string) => `Permite solo ${apps}`,
    /** A mode with nothing picked: a plain fact, a valid choice (ADR-0047 §1). */
    none: 'No bloquea apps',
    /** After a restore: the apps were picked on another phone and Screen Time keeps them there (ADR-0048 §9). */
    repick: 'Vuelve a elegir las apps',
    /** Where no real picker exists, the catalogue stands in and blocks nothing. */
    example: (list: string) => `${list} de ejemplo`,
    /** What the apps row is called for each behavior. */
    blockedApps: 'Apps bloqueadas',
    allowedApps: 'Apps permitidas',
  },
  list: {
    title: 'Modos',
    newModeA11y: 'Nuevo modo',
    readOnlyNotice: 'Estás en una sesión: los modos son de solo lectura hasta que termine.',
    empty: 'Todavía no hay modos. Crea uno con el más, o elige una idea.',
    /** Once, above the cards, where this phone cannot block (rule 8). */
    cannotBlock: (reason: string) => `Este teléfono no bloquea apps: ${reason}.`,
    ideasTitle: 'Explorar ideas',
    ideasSubtitle: 'Modos armados para enfocarte',
    ideasA11y: 'Explorar ideas',
    options: 'Opciones',
    duplicate: 'Duplicar',
    remove: 'Eliminar',
  },
  card: {
    active: 'activo',
    readOnly: 'solo lectura',
    tapToActivate: 'toca para activar',
    editA11y: (name: string) => `Editar ${name}`,
    optionsA11y: (name: string) => `Opciones de ${name}`,
  },
  /** The confirmation before a mode goes. Cancel comes from `common`. */
  deleteAlert: {
    title: (name: string) => `¿Eliminar “${name}”?`,
    /** The routines that use it, by name; they are switched off with it. */
    message: (routines: readonly string[]) =>
      routines.length === 0
        ? 'Ninguna rutina lo usa.'
        : routines.length === 1
          ? `Se apagará la rutina “${routines[0] ?? ''}”.`
          : `Se apagarán ${routines.length} rutinas: ${routines.map((name) => `“${name}”`).join(', ')}.`,
    confirm: 'Eliminar',
  },
  edit: {
    newTitle: 'Nuevo modo',
    editTitle: 'Editar modo',
    save: 'Guardar modo',
    remove: 'Eliminar modo',
    name: 'Nombre',
    namePlaceholder: 'Sin redes',
    behavior: 'Comportamiento',
    behaviorHint: 'Elige qué se limita mientras enfocas',
    behaviorBlock: 'Bloquear seleccionadas',
    behaviorAllow: 'Permitir solo seleccionadas',
    apps: 'Apps',
    /** Feminine in Spanish (apps); sites use `common.none`. */
    noApps: 'Ninguna',
    /** The apps row on Android while the access is missing: tapping it offers the way in. */
    realAppsNoAccess: 'Sin acceso',
    sites: 'Sitios',
    depth: 'Profundidad',
    activity: 'Actividad',
    activityHint: 'A qué se acredita el tiempo de este modo en el día',
    /** The routines that turn this mode on, so a change here is not a surprise there. */
    usedBy: (names: readonly string[]) => `Lo usan: ${names.map((name) => `“${name}”`).join(', ')}`,
    /** Leaving an edited draft without saving. Keep editing is `common.cancel`. */
    discardTitle: '¿Descartar los cambios?',
    discardMessage: 'Lo que cambiaste en este modo no se guarda.',
    discardConfirm: 'Descartar',
  },
  /** The picker shared by apps and websites. */
  picker: {
    results: 'Resultados',
    noResults: 'Nada con ese nombre.',
    nothingYet: 'Todavía no elegiste nada.',
    /** '3 / 50', how many are chosen against the cap. */
    count: (selected: number, max: number) => `${selected} / ${max}`,
    /** While the platform picker reads the installed apps. */
    loading: 'Cargando apps…',
  },
  apps: {
    search: 'Buscar apps',
    selected: 'Seleccionadas',
    all: 'Todas',
    unavailable: 'Tiempo de uso no está disponible',
    /** Android's own heading where the build cannot block at all. */
    unavailableAndroid: 'Este teléfono no puede bloquear apps',
    /** A `status().reason` shown on its own line: the reasons are written to follow a colon. */
    unavailableReason: (reason: string) => `No está disponible: ${reason}.`,
    realHint:
      'Elige en Tiempo de uso qué apps, categorías y sitios limita este modo. Vesper guarda la selección sin ver qué hay adentro.',
    /** Android: Vesper's own list of the phone's apps, not a system picker. */
    realHintAndroid: 'Elige qué apps de este teléfono cubre Vesper mientras enfocas. La lista solo sale cifrada, en tu respaldo.',
    selectedSummary: (summary: string) => `Seleccionadas: ${summary}`,
    /** On the catalogue, which only shows where no real picker exists, with `status().reason`. */
    notReal: (reason: string) => `Este teléfono no bloquea apps: ${reason}. Esta lista es de ejemplo.`,
    /** The tap that does nothing at the cap has to say why; Tooltip exists for that. */
    fullTip: 'Ya elegiste 50. Quita una para agregar otra.',
  },
  /** What src/platform/blocking reports: why blocking is off, and what a selection holds. */
  blocking: {
    iosOnly: 'solo iPhone',
    simulator: 'el simulador no tiene Tiempo de uso',
    noModule: 'esta versión de Vesper no usa Tiempo de uso',
    noEntitlement: 'Apple todavía no le dio a Vesper el permiso para bloquear apps',
    denied: 'el permiso de Tiempo de uso está denegado',
    androidNoModule: 'esta versión de Vesper no puede bloquear apps',
    androidNoUsageAccess: 'falta el acceso a datos de uso, en Ajustes del sistema › Apps › Acceso especial',
    androidNoOverlay: 'falta mostrar sobre otras apps',
    /** '3 apps · 1 categoría · 2 sitios', or 'Ninguna' when the selection holds nothing. */
    none: 'Ninguna',
    apps: (count: number) => `${count} ${count === 1 ? 'app' : 'apps'}`,
    categories: (count: number) => `${count} ${count === 1 ? 'categoría' : 'categorías'}`,
    sites: (count: number) => `${count} ${count === 1 ? 'sitio' : 'sitios'}`,
  },
  /**
   * The prominent disclosure Play requires before the system's usage-access page
   * (ADR-0046, docs/PLAY_DECLARATIONS.md). Android only; the route is `usage-access`.
   * The two purposes are said apart because the build has two. The overlay block is
   * the line PLAY_DECLARATIONS.md §b declares for the second Settings page.
   */
  usageAccess: {
    title: 'Vesper necesita el acceso a datos de uso',
    session: {
      heading: 'Durante una sesión',
      body: 'Vesper mira qué app está al frente para cubrirla con el recordatorio cuando abres una de las que elegiste. La compara con tu lista y la suelta.',
    },
    activity: {
      heading: 'En la pestaña Actividad',
      body: 'Con la app abierta y sin sesión corriendo, Vesper le pregunta al sistema cuánto estuvo al frente hoy y esta semana cada app que elegiste, y te muestra el desglose.',
    },
    privacy: {
      heading: 'Nada de esto sale de tu teléfono',
      body: 'Todo se procesa aquí y no va a ningún servidor. Vesper tampoco guarda historial de las apps que usas: se lo pregunta al sistema cada vez y muestra la respuesta.',
    },
    overlay: {
      heading: 'Mostrar sobre otras apps',
      /** The fourth block of the disclosure: the second Settings page, announced. */
      disclosure: 'Después Android te pide un segundo permiso. Así muestra Vesper el recordatorio a pantalla completa encima de una app que elegiste pausar durante una sesión. No se muestra en ningún otro momento.',
      /** On the real-app picker, when this is the only toggle missing. */
      body: 'Así muestra Vesper el recordatorio a pantalla completa encima de una app que elegiste pausar durante una sesión. No se muestra en ningún otro momento.',
      missing: 'Falta mostrar sobre otras apps',
      allow: 'Permitir mostrar sobre otras apps',
    },
    /** `continue` is a reserved word; the key says it is the label. */
    continueLabel: 'Continuar',
    opening: 'Abriendo Ajustes…',
    systemPrompt: 'Android te lleva a Ajustes dos veces. Puedes quitar los dos permisos cuando quieras y el resto de Vesper funciona igual.',
    /** What the answer was, when nothing was granted. The reason follows a colon. */
    failed: (reason: string) => `No se activó: ${reason}. Puedes intentarlo de nuevo o volver.`,
    failedUnknown: 'No se activó el acceso. Puedes intentarlo de nuevo o volver.',
    /** From the onboarding step: declining skips ahead, like the step's own "Ahora no". */
    notNow: 'Ahora no',
    /** On the real-app picker, where the access is what is missing. */
    grant: 'Dar el acceso a datos de uso',
  },
  websites: {
    blocked: 'Sitios bloqueados',
    allowed: 'Sitios permitidos',
    search: 'Buscar sitios',
    selected: 'Seleccionados',
    popular: 'Populares',
    /** The site list only shows where no real picker exists: an example, like the apps. */
    example: 'Esta lista es de ejemplo: este teléfono no bloquea sitios.',
    /** Masculine in Spanish (sitios). */
    fullTip: 'Ya elegiste 50. Quita uno para agregar otro.',
  },
  ideas: {
    title: 'Explorar ideas',
    addA11y: (name: string) => `Agregar ${name}`,
    /** An idea whose name is already one of your modes. */
    added: 'Ya está en tus modos',
    /** 'Profundo · 4 apps': what the plus will set. */
    meta: (depth: string, apps: string) => `${depth} · ${apps}`,
  },
  details: {
    readOnlyNotice: 'Durante la sesión el modo es de solo lectura.',
  },
};
