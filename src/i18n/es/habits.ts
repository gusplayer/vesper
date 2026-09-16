/**
 * Habits: the weekly section in the activity tab, the new/edit screens, and what
 * Health says about them (the sync line, the week summary, why it is unavailable).
 */
export const habits = {
  section: {
    title: 'Hábitos esta semana',
    healthTip: 'Este hábito lo marca Salud',
    verified: 'verificado por Salud',
    /** 'verificado por Salud · sincronizado 14:30'. */
    verifiedSynced: (synced: string) => `verificado por Salud · ${synced}`,
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
    prototypeNote: 'En el prototipo Salud no confirma nada de verdad.',
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
  /** Why Health is unavailable, as `status().reason` in src/platform/health.ts says it. */
  healthStatus: {
    notIos: 'Salud solo existe en iPhone',
    notLinked: 'Este build no incluye Salud',
    notAvailable: 'Salud no está disponible en este dispositivo',
  },
};
