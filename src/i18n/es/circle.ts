/**
 * Círculo (ADR-0021): the weekly section in Actividad, the circle screen, invitations,
 * challenges and Ajustes › Círculo. Names are data (they come from the members), hours
 * arrive already formatted ('3h 20m'); only the words live here.
 */

/** 'Ana', 'Ana y Luis', 'Ana, Luis y Sofía'. */
function joinNames(names: readonly string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** Why nothing here is real yet, as `status().reason` in src/platform/circle.ts says it. */
const unavailable = 'Todavía no hay conexión con otros teléfonos. Lo que ves son datos de ejemplo.';

export const circle = {
  sync: {
    unavailable,
    /** Hay cuenta, pero el servidor todavía no ha contestado ni una vez. */
    pending: 'Tu círculo se sincroniza cuando haya conexión.',
    /** 'Sincronizado el 24/09/26, 3:20 p. m.' */
    synced: (when: string) => `Sincronizado el ${when}.`,
    /** No se pudo, y nunca se había podido. */
    failedNever: 'No se pudo sincronizar. Lo que ves es lo de este teléfono.',
    /** No se pudo, y la última vez que sí fue esta. */
    failed: (when: string) => `No se pudo sincronizar. La última vez fue el ${when}.`,
  },
  /** The section at the end of Actividad › Semanal. */
  section: {
    title: 'Tu círculo',
    noProfileTitle: 'Un círculo es la gente a la que le contarías que hoy no tocaste el teléfono.',
    noProfileBody: 'Crea tu perfil para invitar o aceptar una invitación. Sin feed, sin ranking, sin avisos.',
    createProfileA11y: 'Crear tu perfil de círculo',
    emptyTitle: 'Tu círculo está vacío.',
    emptyBody: 'Invita a alguien con tu código.',
    inviteA11y: 'Invitar a tu círculo',
    seeCircle: 'Ver círculo',
  },
  /** One person's row in the week list. */
  member: {
    me: 'Tú',
    /** '@ana', how a handle is written wherever it appears. */
    handle: (handle: string) => `@${handle}`,
    /** '3h 20m de foco'. */
    focus: (hours: string) => `${hours} de foco`,
    /** 'redes · 2h (estimado)'. An estimated floor on its own line, never summed (ADR-0005). */
    social: (hours: string) => `redes · ${hours} (estimado)`,
    noData: 'sin datos esta semana',
    /** Null is "not shared", never zero: zero diría que no hizo nada (ADR-0033). */
    notShared: 'no comparte esta cifra',
    kudos: 'Dar ánimo',
    kudosSent: 'Enviado',
  },
  kudos: {
    /** 'Ana y Luis te dieron ánimo esta semana.' */
    received: (names: readonly string[]) =>
      names.length === 1 ? `${names[0]} te dio ánimo esta semana.` : `${joinNames(names)} te dieron ánimo esta semana.`,
  },
  /** circle/index. */
  list: {
    title: 'Tu círculo',
    inviteA11y: 'Invitar a alguien',
    thisWeek: 'Esta semana',
    noMembers: 'Todavía no hay nadie. Invita con tu código.',
    challenges: 'Retos',
    noChallenges: 'Sin retos por ahora. Un reto es un hábito con testigos.',
    newChallenge: 'Nuevo reto',
    noProfileTitle: 'Un círculo, no una red.',
    noProfileBody:
      'Hasta doce personas que eliges. Se comparan las horas de foco de la semana, se dan ánimo y hacen retos juntos. Sin feed, sin seguidores, sin ranking, sin avisos.',
    noProfileShare: 'Tú decides qué se ve, métrica por métrica. Lo que no compartes no sale del teléfono.',
    createProfile: 'Crear tu perfil',
  },
  /** A challenge, in the card and in its screen. */
  challenge: {
    /** '2 semanas', '21 días', 'sin límite' (ADR-0027). Whole weeks read as weeks, except 21. */
    duration: (days: number | null) =>
      days === null
        ? 'sin límite'
        : days === 7
          ? '1 semana'
          : days % 7 === 0 && days !== 21
            ? `${days / 7} semanas`
            : `${days} días`,
    /** '4 veces por semana · 21 días'. */
    summary: (target: number, duration: string) => `${target} veces por semana · ${duration}`,
    /** 'con Ana y Luis'. */
    withNames: (names: readonly string[]) => `con ${joinNames(names)}`,
    alone: 'solo tú',
    nobody: 'sin participantes',
    status: {
      upcoming: 'Empieza el lunes',
      /** 'Último día', 'Quedan 12 días', 'Sin límite'. */
      active: (daysLeft: number | null) =>
        daysLeft === null ? 'Sin límite' : daysLeft <= 1 ? 'Último día' : `Quedan ${daysLeft} días`,
      ended: 'Terminó',
    },
    /** '3 de 4'. */
    progress: (done: number, target: number) => `${done} de ${target}`,
    /**
     * How the week is going for the user, from `challengeOutlook` (ADR-0031). One
     * line, always the same place: what is missing and how much room is left.
     */
    outlook: {
      met: 'Cumpliste esta semana',
      /** 'Te faltan 2 · quedan 3 días'. */
      left: (needed: number, daysLeft: number) =>
        `Te ${needed === 1 ? 'falta' : 'faltan'} ${needed} · ${daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`}`,
      /** When only marking every remaining day still meets the week. */
      atRisk: (daysLeft: number) =>
        daysLeft === 1 ? 'Solo sale marcando hoy' : `Solo sale marcando los ${daysLeft} días que quedan`,
      missed: 'Esta semana ya no sale',
      notStarted: 'Todavía no empieza',
    },
    /** The other participants' line: 'Ana va 3 de 4', 'Ana cumplió'. */
    otherLine: (name: string, progress: string, met: boolean) =>
      met ? `${name} cumplió` : `${name} va ${progress}`,
    /** The card a finished challenge leaves: how the whole thing went. */
    ended: {
      title: 'Así terminó',
      /** Under the week a finished challenge draws: it is its last one, not this one. */
      lastWeek: 'Su última semana',
      /** 'Cumpliste 3 de 3 semanas.' */
      weeks: (met: number, total: number) =>
        met === total
          ? `Cumpliste ${total === 1 ? 'la semana' : `las ${total} semanas`}.`
          : `Cumpliste ${met} de ${total} ${total === 1 ? 'semana' : 'semanas'}.`,
      /** 'Repetir 21 días'. */
      repeat: (duration: string) => `Repetir ${duration}`,
      archive: 'Archivar el reto',
      archiveQuestion: '¿Archivar el reto?',
      archiveMessage: 'Sale de tu lista. Tu hábito y tus marcas se quedan.',
      archiveConfirm: 'Archivar',
    },
    /** Under the habit a challenge is linked to, in Hábitos. */
    habitLine: (names: readonly string[]) =>
      names.length === 0 ? 'Reto' : `Reto con ${joinNames(names)}`,
    /** 'Ana · 3 de 4 ✓'. */
    standingLine: (name: string, progress: string, met: boolean) => `${name} · ${progress}${met ? ' ✓' : ''}`,
    /** VoiceOver for a week row: 'Ana, 3 de 4, cumplido'. */
    standingA11y: (name: string, progress: string, met: boolean) =>
      `${name}, ${progress}${met ? ', cumplido' : ''}`,
    openA11y: (name: string) => `Abrir el reto ${name}`,
    goneTitle: 'Ese reto ya no está.',
    goneDescription: 'Vuelve al círculo y elige otro.',
    thisWeek: 'Esta semana',
    markToday: 'Marcar hoy',
    unmarkToday: 'Desmarcar hoy',
    join: 'Unirme',
    leave: 'Salir del reto',
    leaveQuestion: '¿Salir del reto?',
    leaveMessage: 'Tu hábito sigue ahí y sigue contando. Solo dejas de aparecer en el reto.',
    leaveConfirm: 'Salir',
    habitsFull: 'Ya tienes 5 hábitos. Archiva uno para unirte.',
    countsAsHabit: 'Tus marcas son las de tu hábito con este nombre. Las de los demás llegan como marcas del reto.',
    notJoined: 'Todavía no estás en este reto.',
    /**
     * Encima de "Unirme" en un reto que Salud puede confirmar (ADR-0042 §5): unirse es
     * el consentimiento, así que se dice antes.
     */
    consentSteps: (steps: number, tag: string) =>
      `Tu círculo verá qué días llegaste a ${steps.toLocaleString(tag)} pasos. No verá cuántos.`,
    consentHealth: 'Tu círculo verá qué días cumpliste. No verá tus datos de Salud.',
    /** En lugar de "Marcar hoy" cuando Salud marca el hábito del reto (ADR-0005). */
    markedByHealth: 'Salud marca este reto sola. Tú no tocas nada.',
    /** Cómo se contó la semana de cada persona, junto a su nombre. Nunca se suma. */
    source: {
      health: 'con Salud',
      session: 'con sesiones de foco',
      manual: 'marcado a mano',
    },
    /** The chip next to someone who has not marked today (ADR-0027). */
    nudge: 'Empujar',
    nudged: 'Enviado',
    nudgeA11y: (name: string) => `Empujar a ${name}`,
    nudgeHint: 'Un empujón al día por persona. Le llega cuando tu círculo se sincroniza, nunca en medio de una sesión.',
    /** 'Ana te empujó hoy.', 'Ana y Luis te empujaron hoy.' */
    nudgedYou: (names: readonly string[]) =>
      names.length === 1 ? `${names[0]} te empujó hoy.` : `${joinNames(names)} te empujaron hoy.`,
  },
  /** What Focus says about the circle, when there is something true to say today. */
  home: {
    /** 'Leer · te faltan 2 · quedan 2 días'. The outlook line, lowercased after the name. */
    challenge: (name: string, outlook: string) => `${name} · ${outlook.charAt(0).toLowerCase()}${outlook.slice(1)}`,
    challengeA11y: (name: string, outlook: string) => `${name}, ${outlook}. Abrir el reto`,
  },
  /** circle/challenge-new. */
  challengeNew: {
    title: 'Nuevo reto',
    name: 'Nombre',
    namePlaceholder: 'leer, caminar, dormir 7h',
    ideas: 'Retos sugeridos',
    ideasHint: 'Toca uno para empezar por ahí. Puedes cambiar el nombre y las veces.',
    /** The curated few (ADR-0031). Names only: the numbers live in data/challenges.ts. */
    ideaName: {
      read: 'Leer',
      walk: 'Caminar 8.000 pasos',
      table: 'Sin teléfono en la mesa',
      sleep: 'Dormir sin pantalla',
      move: 'Moverte',
    },
    fromHabit: 'Desde un hábito',
    fromHabitHint: 'Toca uno para usar su nombre y su meta.',
    timesPerWeek: 'Veces por semana',
    duration: 'Cuánto dura',
    /** '1 semana', '2 semanas', '21 días', '4 semanas', 'Sin límite' (CHALLENGE_DURATION_OPTIONS). */
    durationOption: (days: number | null) =>
      days === null ? 'Sin límite' : days === 7 ? '1 semana' : days % 7 === 0 && days !== 21 ? `${days / 7} semanas` : `${days} días`,
    withWhom: 'Con quién',
    noMembers: 'Invita a alguien primero. Un reto sin testigos es un hábito.',
    meToo: 'Yo también',
    meTooHint: 'Al unirte, el reto usa un hábito tuyo con ese nombre y cuenta contra el máximo de cinco.',
    create: 'Crear reto',
    habitsFull: 'Ya tienes 5 hábitos. Archiva uno para unirte.',
  },
  /** circle/invite. */
  invite: {
    title: 'Invitar',
    yourCode: 'TU CÓDIGO',
    yourCodeHint: 'Quien lo use te pide entrar a tu círculo. Tú decides si aceptas.',
    qrHint: 'Con la cámara del teléfono, apuntando a este código, se abre Vesper.',
    qrA11y: (code: string) => `Código QR de tu invitación, ${code}`,
    share: 'Compartir invitación',
    /** What the share sheet sends: the code for typing, the link for tapping. */
    shareMessage: (code: string, link: string) =>
      `Únete a mi círculo en Vesper. Toca ${link} o escribe el código ${code}.`,
    newCode: 'Generar código nuevo',
    newCodeQuestion: '¿Generar un código nuevo?',
    newCodeMessage: 'El anterior deja de funcionar. Quien ya está en tu círculo se queda.',
    newCodeConfirm: 'Generar',
    enterTitle: '¿Te dieron un código?',
    enterHint: 'Escríbelo aquí, o toca el link que te enviaron.',
    codeField: 'Código',
    codePlaceholder: 'seis letras o números',
    send: 'Pedir entrar a su círculo',
    /**
     * Lo que contesta pedir entrar (ADR-0044). Las tres primeras se saben en el
     * teléfono; las demás las contesta el servidor. Ninguna abre un modal: son una
     * línea debajo del campo (ADR-0044 §5).
     */
    result: {
      /** Not shaped like a code. Says what one looks like, never that it "does not exist". */
      invalid: 'Un código son seis letras o números.',
      self: 'Ese es tu propio código.',
      full: 'Tu círculo está lleno. Quita a alguien para pedir entrar a otro.',
      noProfile: 'Primero crea tu perfil en Ajustes › Círculo.',
      /** Salió. La otra persona todavía tiene que aceptar. */
      sent: 'Listo. La otra persona decide si te acepta.',
      /** Ya se habían invitado en el otro sentido: el vínculo ya estaba. */
      alreadyMember: 'Ya están en el mismo círculo.',
      unknownCode: 'Ese código no existe o ya no funciona.',
      /** El servidor confirma lo que el teléfono no pudo: el código es del que pregunta. */
      ownCode: 'Ese es tu propio código.',
      /** 429: el servidor solo deja unos pocos intentos por hora. */
      tooMany: 'Demasiados intentos. Espera un rato y vuelve a probar.',
      /** El llavero del teléfono no guarda la clave: no es falta de conexión (regla 8). */
      noKeychain: 'Este teléfono no puede guardar la clave de tu cuenta, así que no se creó ninguna.',
      handleTaken: 'Tu alias ya es de otra persona. Elige otro para poder pedir entrar.',
      offline: 'Sin conexión. Vuelve a intentar cuando la tengas.',
    },
    /** Mientras el servidor reserva tu código. */
    preparing: 'Preparando tu invitación…',
    /**
     * Por qué tu código todavía no sirve (ADR-0044 §2). Aparece en lugar del QR:
     * un código que nadie puede usar no se muestra como si funcionara.
     */
    problem: {
      offline: 'Sin conexión. Tu código todavía no funciona para nadie más.',
      busy: 'Demasiados intentos. Espera un rato y vuelve a abrir esta pantalla.',
      handleTaken: 'Tu alias ya es de otra persona. Elige otro y tu código empieza a funcionar.',
      noKeychain: 'Este teléfono no puede guardar la clave de tu cuenta, así que no se creó ninguna.',
      lostKey: 'Ya hay una cuenta con este perfil y este teléfono no tiene su clave de respaldo. Sin ella no se puede usar.',
      codeTaken: 'Tu código ya es de otra persona. Genera uno nuevo y vuelve a intentar.',
      server: 'El servidor no pudo crear tu cuenta. Inténtalo más tarde.',
      noProfile: 'Primero crea tu perfil en Ajustes › Círculo.',
    },
    changeHandle: 'Cambiar tu alias',
    /** El botón de compartir, mientras la cuenta nace. */
    sharing: 'Preparando…',
    pending: 'Quieren entrar a tu círculo',
    /** Under the name of someone who used the user's code. */
    invitedYou: 'usó tu código',
    accept: 'Aceptar',
    decline: 'Rechazar',
    acceptFull: 'Tu círculo está lleno. Quita a alguien para aceptar.',
    members: 'En tu círculo',
    /** '3 de 12'. */
    count: (members: number, max: number) => `${members} de ${max}`,
    waiting: 'esperando que acepte',
    remove: 'Quitar',
    removeQuestion: (name: string) => `¿Quitar a ${name} de tu círculo?`,
    removeMessage: 'Deja de ver tus números y tú los suyos. Sus marcas en los retos se borran.',
    removeConfirm: 'Quitar',
    /**
     * Ya no es un prototipo: la solicitud sale de verdad (ADR-0044). Lo que todavía
     * no existe es el aviso, que es la otra mitad de ADR-0037.
     */
    prototypeNote: 'La solicitud llega al otro teléfono cuando se sincroniza. Todavía no le suena un aviso.',
  },
  /** circle/join: where an invite link lands. */
  join: {
    title: 'Entrar a un círculo',
    /** 'Te invitaron con el código 3C5STM.' */
    body: (code: string) => `Te invitaron con el código ${code}.`,
    explain: 'Al pedir entrar, la otra persona ve tu nombre y decide. No compartes nada hasta que acepte.',
    request: 'Pedir entrar',
    noCode: 'Este link no trae un código válido.',
    noProfileTitle: 'Primero crea tu perfil.',
    noProfileBody: 'Un nombre y un alias, en este teléfono. Luego vuelve a tocar el link.',
    createProfile: 'Crear tu perfil',
  },
  /**
   * La frase que arma el teléfono cuando llega un push del círculo (ADR-0037). Del
   * servidor viajan quién, qué y cuándo; ninguna palabra. El nombre es el que el
   * círculo ya sincronizó, y '@alias' cuando todavía no conoce a esa persona —que es
   * justo el caso de una invitación—. El nombre del reto no viaja: quien recibe el
   * empujón ya está en él.
   */
  push: {
    nudge: {
      /** 'Ana te empuja', '@ana te empuja'. */
      title: (name: string) => `${name} te empuja`,
      body: 'Hoy no has marcado el reto.',
    },
    invite: {
      title: (name: string) => `${name} quiere entrar a tu círculo`,
      body: 'Puedes aceptar o no. Nada se comparte hasta que aceptes.',
    },
    accepted: {
      title: (name: string) => `${name} entró a tu círculo`,
      body: 'Ya se ven la semana.',
    },
  },
  /** Ajustes › Círculo. */
  settings: {
    title: 'Círculo',
    profile: 'Perfil',
    name: 'Nombre',
    namePlaceholder: 'como te llaman',
    handle: 'Alias',
    handlePlaceholder: 'corto, sin espacios',
    createProfile: 'Crear tu perfil',
    profileHint: 'Nombre y alias viven en este teléfono. No hay correo ni contraseña.',
    share: 'Qué compartes',
    shareFocus: { label: 'Horas de foco', description: 'Tu tiempo enfocado de la semana' },
    shareHabits: { label: 'Hábitos y retos', description: 'Cuántas veces cumpliste' },
    shareSocial: { label: 'Uso de redes', description: 'El piso estimado del teléfono' },
    shareHint:
      'El uso de redes es una estimación y se muestra como tal, en su propia línea. Lo que no compartes no sale del teléfono.',
    seeCircle: 'Ver círculo',
    leaveCircle: 'Salir del círculo',
    leaveQuestion: '¿Salir del círculo?',
    leaveMessage: 'Se borran las personas, sus números, los ánimos y los retos. Tu perfil y tus hábitos se quedan.',
    leaveConfirm: 'Salir',
    /** La clave de respaldo (ADR-0044 §3). Solo aparece cuando hay cuenta. */
    backup: 'Clave de respaldo',
    backupHint:
      'Guárdala en tu gestor de contraseñas. Sin ella, reinstalar pierde tu círculo: no hay correo con el que recuperarlo.',
    backupCopy: 'Copiar',
    backupCopied: 'Copiada',
    backupNone: 'Todavía no tienes cuenta. Aparece cuando invites a alguien o uses un código.',
    deleteAccount: 'Borrar la cuenta',
    deleteQuestion: '¿Borrar tu cuenta del círculo?',
    deleteMessage:
      'Se borran tus datos del servidor y tu clave de este teléfono. La app sigue funcionando entera, sin círculo.',
    deleteConfirm: 'Borrar',
    deleteFailed: 'No se pudo borrar la cuenta. Inténtalo cuando haya conexión.',
    /**
     * "Borrar todo y reiniciar" sin red: la base se vacía igual y la clave sale del
     * llavero, pero la cuenta sigue en el servidor y ya no hay con qué borrarla.
     * Se dice en voz alta, no en una nota al pie (ADR-0044 §7).
     */
    resetLeftAccountTitle: 'Tu cuenta del círculo sigue en el servidor',
    resetLeftAccount:
      'No había conexión para borrarla. Este teléfono ya no tiene su clave, así que nadie volverá a entrar con ella.',
  },
};
