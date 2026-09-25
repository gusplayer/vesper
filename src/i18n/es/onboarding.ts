/**
 * The onboarding, screen by screen, in the order of ADR-0016: welcome → goal →
 * screen-time (→ usage-access on Android) → health → apps → routine → routine-set →
 * notifications → tour. Buttons every screen shares (Continuar, Listo) come from
 * `common`; the routine's time words come from `routines.edit`, the same ones the
 * routine editor uses. Plain object, never `as const`.
 */
export const onboarding = {
  /** What VoiceOver reads for the dots of a step, and of the tour's pages. */
  progress: (step: number, total: number) => `Paso ${step} de ${total}`,
  welcome: {
    start: 'Empezar',
    legal: 'Al empezar aceptas:',
    /** The two legal pages live on the web and the app links out (ADR-0046). */
    terms: 'Términos',
    privacy: 'Privacidad',
    /** VoiceOver: the thing, then what a tap does. */
    openTerms: 'Términos de uso, abre el navegador',
    openPrivacy: 'Privacidad, abre el navegador',
    titleLine1: 'Tu tiempo es tuyo.',
    titleLine2: 'Vuelve a lo que importa.',
    /** Sin registro, no sin cuenta: desde el ADR-0048 hay una identidad anónima. */
    subtitle: 'Sin registro y sin conexión. Todo empieza en tu teléfono.',
  },
  goal: {
    title: '¿Para qué es tu primer modo?',
    subtitle: 'Un modo puede bloquear las apps que elijas. Puedes crear más cuando quieras.',
    pickOne: 'Elige una',
    /** The five answers, one per MODE_IDEAS entry; `goalOptions.ts` maps ids to these. */
    options: {
      work: 'Enfocarme en el trabajo',
      mindfulness: 'Estar presente',
      family: 'Tiempo en familia',
      sleep: 'Dormir mejor',
      noSocials: 'Menos redes',
    },
    /** The line under each answer: what the idea is for, and its depth ('Profundo'). */
    optionLine: (description: string, depth: string) => `${description} · ${depth}`,
    /** Under the list when the chosen answer makes a deep mode: the one with no way out. */
    deepNote: 'Profundo no tiene salida ni pausas: solo el tiempo termina la sesión, salvo una emergencia. Puedes cambiarlo en el modo.',
  },
  apps: {
    title: (modeName: string) => `Tu primer modo se llama ${modeName}`,
    /** The example catalogue, only where this phone has no real picker. */
    subtitle: 'Ahora elige las apps a bloquear cuando lo uses.',
    /** The real picker: Screen Time's own on iOS. */
    realSubtitle: 'Elige en Tiempo de uso qué bloquea este modo. Vesper guarda la selección sin ver qué hay adentro.',
    /** The real picker on Android: Vesper's list of the phone's apps. */
    androidSubtitle: 'Elige qué apps de tu teléfono cubre este modo mientras enfocas.',
    limit: (max: number) => `Bloquea hasta ${max} distracciones por modo. Puedes editarlo cuando quieras.`,
    search: 'Buscar apps',
    selected: 'Seleccionadas',
    pickApps: 'Elegir apps',
    /**
     * A mode with no apps is a choice, not a problem (ADR-0047 §1): said as a neutral
     * fact, under the real picker when nothing is chosen and on the routine preview.
     */
    blocksNone: 'No bloquea apps',
    /** Under the real picker: '3 apps · 1 categoría' from `selectionSummaryText`. */
    blocks: (summary: string) => `Bloquea ${summary}`,
    /** The access was skipped or refused: the phone could block, the mode blocks nothing for now. */
    notGrantedBody:
      'Sin el acceso a Tiempo de uso, este modo no bloquea apps por ahora. Si lo das después, sus apps se eligen desde el modo.',
    notGrantedBodyAndroid:
      'Sin el acceso a datos de uso, este modo no bloquea apps por ahora. Si lo das después, sus apps se eligen desde el modo.',
    /** Once, at the top of the example catalogue: the platform's reason, written to follow a colon. */
    exampleNote: (reason: string) => `Este teléfono no puede bloquear apps: ${reason}. Esta lista es de ejemplo.`,
  },
  screenTime: {
    title: 'Conecta Vesper a Tiempo de uso',
    use: {
      heading: 'Cómo lo vas a usar',
      body: 'Con el acceso eliges qué apps bloquear en tus modos. Tiempo de uso las pausa mientras enfocas.',
    },
    privacy: {
      heading: 'Cómo lo usamos',
      body: 'Nunca vemos qué apps bloqueas ni tu historial. Todo queda en tu teléfono.',
    },
    why: {
      heading: 'Por qué importa',
      body: 'Así Vesper te ayuda a crear tiempo con intención, sin borrar apps.',
    },
    /**
     * Android has no Screen Time, so naming it there would point at a feature the
     * phone does not have. Same three ideas, its own words (ADR-0046).
     */
    android: {
      title: 'Deja que Vesper bloquee apps',
      use: 'Eliges qué apps bloquear en tus modos, y Vesper las cubre mientras enfocas.',
      allow: 'Continuar',
      systemPrompt: 'Android te lleva a Ajustes dos veces: el acceso a datos de uso y mostrar sobre otras apps. Puedes quitarlos cuando quieras.',
      connectFailed: 'no se pudo activar el bloqueo',
      /** The primary where there is nothing to grant: the build cannot block. */
      continueWithoutLabel: 'Continuar sin bloqueo',
      /** Both toggles are already on. */
      granted: 'El bloqueo ya está activo en este teléfono.',
    },
    allow: 'Permitir acceso',
    asking: 'Pidiendo…',
    /** The step never demands the permission (ADR-0026): this is always there while it can be asked. */
    notNow: 'Ahora no',
    systemPrompt: 'iOS te va a pedir confirmar. Puedes cambiarlo después en Ajustes.',
    /** A `status().reason`, written to follow a colon. */
    continueWithout: (reason: string) => `Puedes seguir sin esto: ${reason}.`,
    connectFailed: 'no se pudo conectar Tiempo de uso',
    /** The primary where iOS will not ask: simulator, no entitlement, already refused. */
    continueWithoutLabel: 'Continuar sin Tiempo de uso',
    /** iOS already said yes. */
    granted: 'Tiempo de uso ya está conectado.',
  },
  health: {
    title: 'Conecta Salud',
    automatic: {
      heading: 'Hábitos que se marcan solos',
      body: 'Gym, pasos y sueño se confirman con Salud. No tienes que tocar nada.',
    },
    /** ADR-0042 §3: a steps challenge shares the days met, a datum derived from Health. */
    privacy: {
      heading: 'Tus lecturas se quedan aquí',
      /** ADR-0048 §7: los días cumplidos van en el respaldo, cifrados. */
      body: 'Tus pasos, entrenamientos y sueño se leen aquí y no salen. Los días que cumples solo salen cifrados en tu respaldo, o a tu círculo si te unes a un reto: qué días llegaste a la meta, nunca cuántos pasos.',
    },
    verified: {
      heading: 'Verificado, no declarado',
      body: 'Lo que Salud confirma vale distinto de lo que declaras. Nunca se suman.',
    },
    connect: 'Conectar Salud',
    connecting: 'Conectando…',
    notNow: 'Ahora no',
    continueWithout: 'Continuar sin Salud',
  },
  routine: {
    title: (modeName: string) => `¿Convertimos ${modeName} en una rutina?`,
    /** What stands in for the mode name when the draft has none yet. */
    yourMode: 'tu modo',
    subtitle: 'Una rutina enciende tu modo a su hora, sin que tengas que acordarte.',
    skip: 'Saltar',
    /** Why "Continuar" is off: a routine with no day never runs. */
    noDays: 'Elige al menos un día para que la rutina corra.',
  },
  routineSet: {
    save: 'Guardar rutina',
    edit: 'Editar rutina',
    modeLine: (modeName: string) => `Modo: ${modeName}`,
    /** The badge on the preview card: the routine will be on once saved. */
    activeLabel: 'Activa',
    title: 'Así queda tu rutina',
    subtitle: 'Puedes editarla cuando quieras en la pestaña Rutinas.',
  },
  notifications: {
    allow: 'Permitir notificaciones',
    asking: 'Pidiendo permiso…',
    notNow: 'Ahora no',
    title: 'Vesper puede avisarte',
    subtitle: 'Permite notificaciones para avisos a tiempo que te ayuden a cumplir.',
    /**
     * The sample on the page is a real one (`notifications.schedule` or
     * `notifications.noFocus`), drawn the way it would land on the lock screen.
     */
    preview: {
      when: 'ahora',
    },
    /** The daily budget of ADR-0027, said before the user decides. */
    budget: 'Como mucho dos avisos al día, nunca de 22:00 a 8:00 y nunca durante una sesión.',
    /** After a no: the system will not ask again, so the way is its Settings. */
    openSettings: 'Abrir Ajustes',
  },
  tour: {
    /** VoiceOver, on the arrow that goes one page back. */
    previous: 'Paso anterior',
    focus: {
      /** Under the object when there is no mode name to show. */
      caption: 'Tu modo',
      title: 'Toca para enfocar',
      /** A deep mode starts with a hold, not a tap. */
      deepTitle: 'Mantén para enfocar',
      body: 'Elige un modo y toca el botón para empezar. Si el modo bloquea apps, quedan en pausa hasta que termines. Para salir antes, respiras con el objeto.',
      deepBody: (modeName: string) =>
        `${modeName} es profundo: mantienes el botón para empezar y solo el tiempo termina la sesión. Puedes cambiarlo en el modo.`,
    },
    emergency: {
      rules: 'Mis reglas',
      unlocks: 'Desbloqueo de emergencia',
      title: 'Una emergencia tiene salida',
      body: (total: number) =>
        `Tienes ${total} desbloqueos de emergencia al mes. Se usan desde la sesión, con el salvavidas de arriba, tras diez segundos de espera.`,
    },
    local: {
      title: 'Todo empieza en tu teléfono',
      /** ADR-0048: una identidad anónima y un respaldo cifrado que el servidor no puede leer. */
      body: 'Sin registro. Lo que inviertes, lo que Salud confirma y lo que consumes se cuentan aparte y nunca se suman. Tu respaldo sale cifrado y el servidor no puede leerlo; lo apagas en Ajustes › Respaldo. A tu círculo solo llega lo que elijas compartir.',
      /** The preview: the three currencies, one row each. */
      invested: 'Invertido',
      investedValue: 'Tus sesiones',
      verified: 'Verificado',
      verifiedValue: 'Salud',
      consumed: 'Consumido',
      consumedValue: 'Estimado',
    },
  },
};
