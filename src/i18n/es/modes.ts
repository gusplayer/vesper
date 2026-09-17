/**
 * The modes area: the list, the editor, the app and website pickers, the ideas, the
 * read-only sheet during a session, and the summary line every mode card carries.
 */
export const modes = {
  /** The line under a mode name: 'Bloquea 4 apps · 3 sitios', 'Permite solo 3 apps'. */
  summary: {
    apps: (count: number) => `${count} ${count === 1 ? 'app' : 'apps'}`,
    sites: (count: number) => `${count} ${count === 1 ? 'sitio' : 'sitios'}`,
    blocks: (apps: string) => `Bloquea ${apps}`,
    allowsOnly: (apps: string) => `Permite solo ${apps}`,
    /** During a session. */
    blocking: (apps: string) => `Bloqueando ${apps}`,
    allowingOnly: (apps: string) => `Permitiendo solo ${apps}`,
    /** What the apps row is called for each behavior. */
    blockedApps: 'Apps bloqueadas',
    allowedApps: 'Apps permitidas',
  },
  list: {
    title: 'Modos',
    newModeA11y: 'nuevo modo',
    readOnlyNotice: 'Estás en una sesión: los modos son de solo lectura hasta que termine.',
    empty: 'Todavía no hay modos. Crea uno con el más, o elige una idea.',
    ideasTitle: 'Explorar ideas',
    ideasSubtitle: 'Modos armados para enfocarte',
    ideasA11y: 'explorar ideas',
    options: 'Opciones',
    duplicate: 'Duplicar',
    remove: 'Eliminar',
  },
  card: {
    active: 'activo',
    readOnly: 'solo lectura',
    tapToActivate: 'toca para activar',
    editA11y: (name: string) => `editar ${name}`,
    optionsA11y: (name: string) => `opciones de ${name}`,
  },
  /** The confirmation before a mode goes. Cancel comes from `common`. */
  deleteAlert: {
    title: (name: string) => `¿Eliminar "${name}"?`,
    message: 'Las rutinas que usen este modo se apagarán.',
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
    behaviorHint: 'Elige qué se limita mientras estás enfocado',
    behaviorBlock: 'Bloquear seleccionadas',
    behaviorAllow: 'Permitir solo seleccionadas',
    apps: 'Apps',
    /** Feminine in Spanish (apps); sites use `common.none`. */
    noApps: 'Ninguna',
    realApps: 'Apps reales (Tiempo de uso)',
    sites: 'Sitios',
    depth: 'Profundidad',
    activity: 'Actividad',
    activityHint: 'A qué se acredita el tiempo de este modo en el día',
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
    realTitle: 'Apps reales',
    unavailable: 'Tiempo de uso no está disponible',
    realHint:
      'Elige en Tiempo de uso qué apps, categorías y sitios limita este modo. Vesper guarda la selección sin ver qué hay adentro.',
    selectedSummary: (summary: string) => `Seleccionadas: ${summary}`,
    /** On the catalogue picker and under the apps row where real blocking is off, with `status().reason`. */
    notReal: (reason: string) => `Este teléfono no bloquea apps de verdad: ${reason}. La lista se guarda en el modo.`,
  },
  /** What src/platform/blocking reports: why blocking is off, and what a selection holds. */
  blocking: {
    iosOnly: 'solo iPhone',
    simulator: 'el simulador no tiene Tiempo de uso',
    noModule: 'este build no trae Tiempo de uso',
    noEntitlement: 'falta el entitlement de Family Controls de Apple',
    denied: 'el permiso de Tiempo de uso está denegado',
    androidNoModule: 'este build no trae el módulo de bloqueo',
    androidNoUsageAccess: 'falta el acceso de uso',
    androidNoOverlay: 'falta mostrar sobre otras apps',
    /** '3 apps · 1 categoría · 2 sitios', or 'Ninguna' when the selection holds nothing. */
    none: 'Ninguna',
    apps: (count: number) => `${count} ${count === 1 ? 'app' : 'apps'}`,
    categories: (count: number) => `${count} ${count === 1 ? 'categoría' : 'categorías'}`,
    sites: (count: number) => `${count} ${count === 1 ? 'sitio' : 'sitios'}`,
  },
  websites: {
    blocked: 'Sitios bloqueados',
    allowed: 'Sitios permitidos',
    search: 'Buscar sitios',
    selected: 'Seleccionados',
    popular: 'Populares',
  },
  ideas: {
    title: 'Explorar ideas',
    addA11y: (name: string) => `agregar ${name}`,
  },
  details: {
    readOnlyNotice: 'Durante la sesión el modo es de solo lectura.',
  },
};
