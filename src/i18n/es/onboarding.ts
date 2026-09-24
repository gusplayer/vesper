/**
 * The onboarding, screen by screen: welcome → goal → apps → screen-time → health →
 * routine → routine-set → notifications → tour. Buttons every screen shares (Continuar,
 * Listo) come from `common`. Plain object, never `as const`.
 */
export const onboarding = {
  welcome: {
    start: 'Empezar',
    legal: 'Al continuar aceptas:',
    /** The two legal pages live on the web and the app links out (ADR-0046). */
    terms: 'Términos',
    privacy: 'Privacidad',
    /** VoiceOver: the thing, then what a tap does. */
    openTerms: 'Términos de uso, abre el navegador',
    openPrivacy: 'Privacidad, abre el navegador',
    titleLine1: 'Tu tiempo es tuyo.',
    titleLine2: 'Vuelve a lo que importa.',
    subtitle: 'Funciona sin cuenta y sin conexión. Todo empieza en tu teléfono.',
  },
  goal: {
    title: '¿Para qué es tu primer modo?',
    subtitle: 'Cada modo bloquea las apps que elijas. Puedes sumar más cuando quieras.',
    pickOne: 'Elige una',
    /** The five answers, one per MODE_IDEAS entry; `goalOptions.ts` maps ids to these. */
    options: {
      work: 'Enfocarme en el trabajo',
      mindfulness: 'Estar presente',
      family: 'Tiempo en familia',
      sleep: 'Dormir mejor',
      noSocials: 'Menos redes',
    },
  },
  apps: {
    title: (modeName: string) => `Bien, tu primer modo se llama ${modeName}`,
    subtitle: 'Ahora elige las apps a bloquear cuando lo uses.',
    limit: (max: number) => `Bloquea hasta ${max} distracciones por modo. Puedes editarlo cuando quieras.`,
    search: 'Buscar apps',
    selected: 'Seleccionadas',
    pickApps: 'Elegir apps',
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
      systemPrompt: 'Android te va a llevar a Ajustes. Puedes quitarlo cuando quieras.',
      connectFailed: 'No se pudo activar el bloqueo',
    },
    allow: 'Permitir acceso',
    asking: 'Pidiendo…',
    /** Android only: there the button leads to the disclosure, so the step needs its own way out (ADR-0026). */
    notNow: 'Ahora no',
    systemPrompt: 'iOS te va a pedir confirmar. Puedes cambiarlo después en Ajustes.',
    continueWithout: (reason: string) => `Puedes seguir sin esto: ${reason}.`,
    connectFailed: 'No se pudo conectar Tiempo de uso',
  },
  health: {
    title: 'Conecta Salud',
    automatic: {
      heading: 'Hábitos que se marcan solos',
      body: 'Gym, pasos y sueño se confirman con Salud. No tienes que tocar nada.',
    },
    privacy: {
      heading: 'Nunca sale del teléfono',
      body: 'Lo que Salud comparte se lee aquí y no va a ningún servidor.',
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
    title: (modeName: string) => `¿Hacemos ${modeName} una rutina?`,
    /** What stands in for the mode name when the draft has none yet. */
    yourMode: 'tu modo',
    subtitle: 'Una rutina enciende tu modo a su hora, sin que tengas que acordarte.',
    skip: 'Saltar',
    starts: 'Empieza',
    ends: 'Termina',
    /** An end with no time: the routine runs until the user ends the session. */
    openEnd: 'Hasta que lo termines',
    repeat: 'Repetir',
    pickTime: 'Elige la hora',
    hour: 'Hora',
    minutes: 'Minutos',
  },
  routineSet: {
    save: 'Guardar rutina',
    edit: 'Editar rutina',
    cardTitle: (modeName: string) => `${modeName} · rutina`,
    modeLine: (modeName: string) => `Modo: ${modeName}`,
    activeLabel: 'rutina activa',
    title: 'Tu rutina está lista',
    subtitle: 'Puedes editarla cuando quieras en la pestaña Rutinas.',
  },
  notifications: {
    allow: 'Permitir notificaciones',
    asking: 'Pidiendo permiso…',
    notNow: 'Ahora no',
    kicker: 'Sigue en camino',
    title: 'Vesper puede avisarte',
    subtitle: 'Permite notificaciones para avisos a tiempo que te ayuden a cumplir.',
    /** The fake notification, the way one would land on the lock screen. */
    preview: {
      title: 'El tiempo se escapa',
      body: 'Vesper lo recupera. Empieza una sesión.',
      when: 'ahora',
    },
  },
  tour: {
    previous: 'anterior',
    focus: {
      caption: 'Toca para enfocar',
      title: 'Toca para enfocar. Toca de nuevo para volver.',
      body: 'Elige un modo, toca el botón y las apps que elegiste quedan en pausa hasta que termines.',
    },
    emergency: {
      rules: 'Mis reglas',
      unlocks: 'Desbloqueo de emergencia',
      title: 'Una emergencia tiene salida',
      body: 'Tienes 5 desbloqueos de emergencia. Suficientes para cuando de verdad los necesitas. Los encuentras en Ajustes.',
    },
    local: {
      caption: 'Todo en tu teléfono',
      title: 'Nada sale de tu teléfono',
      body: 'Sin cuenta ni nube. Lo que inviertes, lo que Salud confirma y lo que consumes se cuentan aparte y nunca se suman.',
    },
  },
};
