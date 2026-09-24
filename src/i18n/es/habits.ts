/**
 * Habits: the weekly section in the activity tab, the new/edit screens, and what
 * Health says about them (the sync line, the week summary, why it is unavailable).
 */
export const habits = {
  section: {
    title: 'Hábitos esta semana',
    healthTip: 'Este hábito lo marca Salud',
    /** 'verificado por Salud · sincronizado 14:30'. */
    verifiedSynced: (synced: string) => `verificado por Salud · ${synced}`,
    /** A verified habit while Health is not connected: the mark is yours, and declared (ADR-0005). */
    verifiedNoHealth: 'Salud no conectada · marca manual',
    declared: 'declarado',
    today: 'hoy',
    todayMarked: 'hoy ✓',
    todayUnmarked: 'hoy –',
    markedByHealth: (name: string) => `${name}, lo marca Salud`,
    markToday: (name: string) => `Marcar ${name} hoy`,
    unmarkToday: (name: string) => `Desmarcar ${name} hoy`,
    edit: 'Editar hábitos',
    add: 'Agregar hábito',
    help: '“hoy” marca el día de hoy. El número es cuántos días llevas esta semana.',
    helpHealth:
      '“hoy” marca el día de hoy. El número es cuántos días llevas esta semana. Los verificados los marca Salud sola.',
    fiveIsMax: 'Cinco es el máximo, a propósito.',
  },
  form: {
    name: 'Nombre',
    namePlaceholder: 'gym, leer, dormir 7h',
    timesPerWeek: 'Veces por semana',
    howCounted: 'Cómo se cuenta',
    declared: 'Declarado',
    declaredDescription: 'Lo marcas tú',
    verified: 'Verificado',
    verifiedDescription: 'Salud lo confirma solo',
    verifiedUnavailable:
      'Solo para hábitos que Salud puede confirmar: entrenamiento, caminata, sueño',
    /**
     * Una sola línea bajo las dos casillas, siempre presente. El nombre primero: es lo
     * que el usuario está escribiendo y lo único que quita la opción (ADR-0041).
     */
    note: {
      name: 'Salud no reconoce este nombre, así que el hábito queda declarado y lo marcas tú.',
      connected: 'Salud está conectada: puede confirmar este hábito sola.',
      disconnected:
        'Salud no está conectada. Conéctala en Ajustes para que confirme este hábito sola.',
      /** Con `status().reason` de src/platform/health.ts: 'Salud solo existe en iPhone, …'. */
      unavailable: (reason: string) => `${reason}, así que este hábito lo marcas tú.`,
    },
  },
  new: {
    title: 'Nuevo hábito',
    fullTitle: 'Ya tienes cinco hábitos.',
    fullDescription:
      'Cinco es el máximo, a propósito: la atención no escala. Archiva uno para hacer lugar.',
    left: (count: number) => `Puedes tener ${count} más`,
  },
  edit: {
    title: 'Editar hábito',
    goneTitle: 'Ese hábito ya no está.',
    goneDescription: 'Vuelve a la actividad y elige otro.',
    archiveQuestion: '¿Archivar este hábito?',
    archiveMessage: 'Las marcas siguen ahí y el hábito deja de contar.',
    archive: 'Archivar',
    archiveHabit: 'Archivar hábito',
    archiveCaption: 'Archivar no borra nada: las marcas siguen ahí y el hábito deja de contar.',
  },
  sync: {
    never: 'sin sincronizar',
    /** 'sincronizado 14:30'. */
    at: (clock: string) => `sincronizado ${clock}`,
  },
  healthWeek: {
    title: 'esta semana',
    workouts: 'Entrenamientos',
    stepDays: 'Días con pasos',
    nights: 'Noches dormidas',
    noHabit: 'sin hábito',
    lastRead: 'Última lectura',
    notYet: 'todavía no',
    readNow: 'Leer Salud ahora',
  },
  /** Why Health is unavailable, as `status().reason` in src/platform/health.*.ts says it. */
  healthStatus: {
    unsupported: 'Salud no existe en este teléfono',
    installHealthConnect: 'Falta Health Connect o está desactualizado',
    notLinked: 'Esta versión de Vesper no puede leer Salud',
    notAvailable: 'Salud no está disponible en este dispositivo',
  },
};
