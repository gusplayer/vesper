/**
 * Habits: the weekly section in the activity tab, the new/edit screens, and what
 * Health says about them (the sync line, the week summary, why it is unavailable).
 */
export const habits = {
  section: {
    title: 'Hábitos esta semana',
    /** The bubble a tap on a Health-marked habit raises: why nothing happened, and the way out. */
    healthTip: 'Lo marca Salud. Para marcarlo tú, cámbialo a declarado.',
    /** 'verificado por Salud · sincronizado 14:30'. */
    verifiedSynced: (synced: string) => `verificado por Salud · ${synced}`,
    /** A verified habit while Health is not connected: the mark is yours, and declared (ADR-0005). */
    verifiedNoHealth: 'Salud no conectada · marca manual',
    /** Where Health cannot exist, the row says why with `status().reason` (rule 8). */
    verifiedManual: (reason: string) => `${reason} · marca manual`,
    declared: 'declarado',
    /** A habit that is also a challenge: 'Reto con Ana y Luis · declarado' (ADR-0031). */
    joined: (first: string, second: string) => `${first} · ${second}`,
    edit: 'Editar hábitos',
    add: 'Agregar hábito',
    help: 'Toca un hábito para marcar hoy y mantenlo para editarlo. El número es cuántos días llevas esta semana.',
    helpHealth:
      'Toca un hábito para marcar hoy y mantenlo para editarlo. El número es cuántos días llevas esta semana. Los verificados los marca Salud sola.',
    /** A habit row to VoiceOver: 'Leer, 3 de 6, declarado'. What a tap does goes in the hint. */
    rowA11y: (name: string, progress: string, how: string) => `${name}, ${progress}, ${how}`,
    hintMark: 'Marca el día de hoy',
    hintUnmark: 'Quita la marca de hoy',
    hintHealth: 'Lo marca Salud; no se marca a mano',
    /** With no habits yet there are no rows to explain: say what a habit is here. */
    empty: 'Hasta cinco hábitos, contados en días, no en horas.',
    /** At five the add row goes, and this says why and how to make room. */
    fiveIsMax: 'Cinco es el máximo, a propósito: la atención no escala. Archiva uno para hacer lugar.',
  },
  /**
   * What De por vida keeps of the habits once they live in Semanal (ADR-0047 §7): one
   * row with how many met their target this week, which opens the weekly view.
   */
  summary: {
    title: 'Hábitos',
    label: 'Esta semana',
    value: (met: number, total: number) =>
      total === 0 ? 'Sin hábitos' : total === 1 ? `${met} de 1 cumplido` : `${met} de ${total} cumplidos`,
    hint: 'Abre la vista semanal, donde se marcan',
  },
  form: {
    name: 'Nombre',
    namePlaceholder: 'gym, bici, leer, dormir 7h',
    timesPerWeek: 'Veces por semana',
    howCounted: 'Cómo se cuenta',
    declared: 'Declarado',
    declaredDescription: 'Lo marcas tú',
    verified: 'Verificado',
    verifiedDescription: 'Salud lo confirma solo',
    /** A workout only reaches Health when something records it (ADR-0055): the card says so. */
    verifiedWorkout: 'Salud lo confirma si registras con un reloj o una app',
    /** Health exists here but is not connected yet: saving asks (ADR-0005). */
    verifiedPending: 'Salud lo confirmará cuando la conectes',
    /** Health cannot exist on this phone: the habit still works, by hand. */
    verifiedManual: 'Salud lo confirmaría; aquí lo marcas tú',
    /** La meta leída del nombre (ADR-0042): 'Caminar 10.000 pasos' cuenta desde 10.000. */
    stepGoal: (steps: number, tag: string) => `Cuenta los días con ${steps.toLocaleString(tag)} pasos o más`,
    /**
     * Which workouts count, read from the name (ADR-0055): 'Montar en bici' only takes
     * rides. Days, never distance or pace. `minutes` is the floor in domain/healthMarks.
     */
    workoutKind: {
      any: (minutes: number) => `Cuenta los días con un entrenamiento de ${minutes} minutos o más, del tipo que sea.`,
      cycling: (minutes: number) =>
        `Cuenta los días con una salida en bici de ${minutes} minutos o más, al aire libre o en interior.`,
      running: (minutes: number) => `Cuenta los días que corres ${minutes} minutos o más, al aire libre o en cinta.`,
      swimming: (minutes: number) => `Cuenta los días que nadas ${minutes} minutos o más.`,
    },
    /** The row under a verified workout habit that opens the "Que llegue a Salud" sheet. */
    fromApps: '¿Registras en Strava o Garmin?',
    verifiedUnavailable:
      'Solo para hábitos que Salud puede confirmar: entrenamiento, caminata, sueño',
    /**
     * Una sola línea bajo las dos casillas, siempre presente. El nombre primero: es lo
     * que el usuario está escribiendo y lo único que quita la opción (ADR-0041).
     */
    note: {
      name: 'Salud no reconoce este nombre, así que el hábito queda declarado y lo marcas tú.',
      connected: 'Salud está conectada: puede confirmar este hábito sola.',
      /** Declared chosen, Health not connected: what picking verified would do. */
      disconnected: 'Salud no está conectada. Si eliges verificado, Vesper te pide permiso al guardar.',
      /** Verified chosen, Health not connected: the permission is asked right here (ADR-0005). */
      askOnSave: 'Al guardar, Vesper te pide permiso para que Salud lo confirme sola.',
      /** Con `status().reason` de src/platform/health.ts: 'Salud solo existe en iPhone, …'. */
      unavailable: (reason: string) => `${reason}, así que este hábito lo marcas tú.`,
    },
    /** The save button while the Health sheet is up. */
    asking: 'Pidiendo permiso a Salud…',
    /** What VoiceOver reads for a target chip, and the locked target of a challenge habit. */
    times: (count: number) => (count === 1 ? '1 vez por semana' : `${count} veces por semana`),
    /** Under the target of a habit a challenge owns: the two never drift apart (ADR-0031). */
    challengeTarget: 'La meta la pone el reto.',
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
    goneDescription: 'Vuelve a Actividad y elige otro.',
    archiveQuestion: '¿Archivar este hábito?',
    /** No screen lists archived habits yet, so nothing promises they come back. */
    archiveMessage: 'Por ahora no se puede recuperar.',
    /** The same question for a habit a challenge owns: the challenge is not archived with it. */
    archiveChallengeMessage: (name: string) =>
      `Es el hábito de tu reto “${name}”. El reto sigue en tu círculo, pero este hábito deja de contar aquí y por ahora no se puede recuperar.`,
    archive: 'Archivar',
    archiveHabit: 'Archivar hábito',
    archiveCaption: 'Archivar lo saca de la lista y libera un lugar.',
  },
  sync: {
    never: 'sin sincronizar',
    /** 'sincronizado 14:30'. */
    at: (clock: string) => `sincronizado ${clock}`,
  },
  healthWeek: {
    title: 'Esta semana',
    workouts: 'Entrenamientos',
    stepDays: 'Días con pasos',
    nights: 'Noches dormidas',
    noHabit: 'Sin hábito',
    lastRead: 'Última lectura',
    notYet: 'Todavía no',
    /** A read from an earlier day: '22 sept · 14:30'. Both parts already formatted. */
    lastReadOn: (day: string, time: string) => `${day} · ${time}`,
    readNow: 'Leer Salud ahora',
    /** The row while the read is running. */
    reading: 'Leyendo…',
  },
  /**
   * "Que llegue a Salud" (ADR-0055 §7): how Strava or Garmin get their workouts to
   * where Vesper reads them. Vesper never connects to those apps, so the sheet gives
   * paths, not a button. The Spanish paths inside Strava and Garmin are a translation
   * until they are copied from the apps on a phone.
   */
  intoHealth: {
    title: 'Que llegue a Salud',
    ios: {
      intro: 'Vesper no se conecta a tus apps: lee los entrenamientos que dejan en Salud. Nunca la ruta.',
      sources: [
        { name: 'Apple Watch', path: 'Nada que hacer: lo que registras en el reloj ya está en Salud.' },
        { name: 'Strava', path: 'Tú › Ajustes › Administrar aplicaciones y dispositivos › Salud › Enviar a Salud.' },
        { name: 'Garmin Connect', path: 'Más › Configuración › Aplicaciones conectadas › Apple Health.' },
      ],
      footer: (minutes: number) =>
        `¿No aparece? Mira si está en Salud. Si está y no cuenta, duró menos de ${minutes} minutos o es de otro tipo.`,
    },
    /** Health Connect instead of Health, and Strava only passes what had GPS. */
    android: {
      intro: 'Vesper no se conecta a tus apps: lee los entrenamientos que dejan en Health Connect. Nunca la ruta.',
      sources: [
        { name: 'Tu reloj', path: 'Abre Health Connect y conecta Samsung Health, Fitbit o la app de tu reloj.' },
        {
          name: 'Strava',
          path: 'Tú › Ajustes › Administrar aplicaciones y dispositivos › Health Connect. Solo pasan las actividades con GPS.',
        },
        { name: 'Garmin Connect', path: 'En Garmin Connect, activa Health Connect entre las apps conectadas.' },
      ],
      footer: (minutes: number) =>
        `¿No aparece? Mira si está en Health Connect. Si está y no cuenta, duró menos de ${minutes} minutos o es de otro tipo.`,
    },
  },
  /** Why Health is unavailable, as `status().reason` in src/platform/health.*.ts says it. */
  healthStatus: {
    unsupported: 'Salud no existe en este teléfono',
    installHealthConnect: 'Falta Health Connect o está desactualizado',
    notLinked: 'Esta versión de Vesper no puede leer Salud',
    notAvailable: 'Salud no está disponible en este dispositivo',
  },
};
