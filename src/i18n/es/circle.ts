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

/**
 * What `status().reason` in src/platform/circle.ts says before there is an account:
 * the circle is local until the user invites someone or uses a code (ADR-0044 §2).
 */
const unavailable = 'Tu círculo se conecta cuando invitas a alguien o usas un código.';

export const circle = {
  sync: {
    unavailable,
    /** Lo mismo, cuando lo que se ve es el círculo de ejemplo de la siembra. */
    demo: 'Estas personas son de ejemplo. Tu círculo se conecta cuando invitas a alguien o usas un código.',
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
    noProfileBody:
      'Crea tu perfil para invitar o aceptar una invitación. Sin feed, sin ranking. Solo te avisa lo que alguien hace por ti, y lo puedes apagar.',
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
    /** Lo mismo en tu propia fila: 'Tú' no es una tercera persona. */
    notSharedMe: 'no la compartes',
    kudos: 'Dar ánimo',
    kudosSent: 'Enviado',
    kudosA11y: (name: string) => `Dar ánimo a ${name}`,
    kudosSentA11y: (name: string) => `Ya le diste ánimo a ${name} hoy`,
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
    invite: 'Invitar a alguien',
    challenges: 'Retos',
    noChallenges: 'Sin retos por ahora. Un reto es un hábito con testigos.',
    newChallenge: 'Nuevo reto',
    noProfileTitle: 'Un círculo, no una red.',
    noProfileBody:
      'Hasta doce personas que eliges. Se comparan las horas de foco de la semana, se dan ánimo y hacen retos juntos. Sin feed, sin seguidores, sin ranking. Solo te avisa lo que alguien hace por ti, y lo puedes apagar.',
    /** Lo que ve el círculo; el respaldo cifrado es otra cosa y nadie más lo lee (ADR-0048). */
    noProfileShare: 'Tú decides qué ve tu círculo, métrica por métrica. Lo que no compartes, tu círculo no lo ve.',
    createProfile: 'Crear tu perfil',
    /**
     * El círculo de ejemplo, dicho arriba y antes de invitar: al nacer la cuenta esas
     * personas se van (ADR-0044), y nadie debería desaparecer sin una palabra.
     */
    demoTitle: 'Este es un círculo de ejemplo.',
    demoBody:
      'Las personas de esta lista no existen. Cuando invites a alguien o uses un código, se van, y tu nombre, tu alias y lo que compartes empiezan a llegarle a tu círculo.',
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
    /** VoiceOver for a week row: 'Ana, 3 de 4, cumplido'. */
    standingA11y: (name: string, progress: string, met: boolean) =>
      `${name}, ${progress}${met ? ', cumplido' : ''}`,
    openA11y: (name: string) => `Abrir el reto ${name}`,
    /** VoiceOver para la tarjeta entera: lo que la tarjeta dice, en orden. */
    cardA11y: (parts: readonly string[]) => `${parts.join('. ')}. Abrir el reto`,
    goneTitle: 'Ese reto ya no está.',
    goneDescription: 'Vuelve al círculo y elige otro.',
    thisWeek: 'Esta semana',
    markToday: 'Marcar hoy',
    unmarkToday: 'Desmarcar hoy',
    join: 'Unirme',
    leave: 'Salir del reto',
    leaveQuestion: '¿Salir del reto?',
    leaveMessage: 'Tu hábito sigue ahí y sigue contando. Solo dejas de aparecer en el reto.',
    /** Lo mismo, dicho después de salir cuando el servidor no lo supo. */
    leaveUnsupported: 'Saliste en este teléfono. Por ahora los demás te siguen viendo en el reto, sin marcas.',
    /**
     * El reto es de otra persona, hay cuenta y el servidor desplegado todavía no tiene la
     * llamada para salir (ADR-0049): se dice lo que de verdad pasa antes de confirmar.
     */
    leaveMessageTheirs:
      'Tu hábito sigue ahí, pero tus marcas dejan de llegar al reto. Por ahora los demás te siguen viendo en él, sin marcas.',
    leaveConfirm: 'Salir',
    habitsFull: 'Ya tienes 5 hábitos. Archiva uno para unirte.',
    seeHabits: 'Ver tus hábitos',
    countsAsHabit: 'Tus marcas son las de tu hábito con este nombre. Las de los demás llegan como marcas del reto.',
    notJoined: 'Todavía no estás en este reto.',
    /**
     * Alguien de tu círculo te sumó al crearlo: para el servidor ya estás dentro, pero
     * sin un hábito tuyo nada se marca. Unirse es lo que lo vincula.
     */
    invited: (name: string) =>
      `${name} te sumó a este reto. Al unirte usa un hábito tuyo y ocupa uno de tus cinco.`,
    /** Lo mismo cuando quien lo creó no está en tu círculo. */
    invitedAnon: 'Te sumaron a este reto. Al unirte usa un hábito tuyo y ocupa uno de tus cinco.',
    /** El hábito que el reto usaba está archivado: sin él, el reto no se marca. */
    relink: 'El hábito de este reto está archivado. Únete otra vez para seguir marcándolo.',
    /** La línea de estado de la tarjeta de un reto al que te sumaron. */
    invitedCard: 'Te sumaron · toca para unirte',
    /**
     * Encima de "Unirme" en un reto que Salud puede confirmar (ADR-0042 §5): unirse es
     * el consentimiento, así que se dice antes.
     */
    consentSteps: (steps: number, tag: string) =>
      `Tu círculo verá qué días llegaste a ${steps.toLocaleString(tag)} pasos. No verá cuántos.`,
    consentHealth: 'Tu círculo verá qué días cumpliste. No verá tus datos de Salud.',
    /**
     * Un reto que Salud podría confirmar, en un teléfono sin Salud (regla 8): el hábito
     * nace declarado y hay que decirlo. `reason` es `health.status().reason`.
     */
    consentNoHealth: (reason: string) =>
      `${reason}: el reto lo marcas tú, y tu círculo verá qué días marcaste.`,
    /** En lugar de "Marcar hoy" cuando Salud marca el hábito del reto (ADR-0005). */
    markedByHealth: 'Salud marca este reto sola. No tienes que tocar nada.',
    /** Cómo se contó la semana de cada persona, junto a su nombre. Nunca se suma. */
    source: {
      health: 'con Salud',
      session: 'con sesiones de foco',
      manual: 'marcado a mano',
    },
    /** The chip next to someone who has not marked today (ADR-0027). */
    nudge: 'Empujar',
    nudged: 'Empujado',
    nudgeA11y: (name: string) => `Empujar a ${name}`,
    nudgedA11y: (name: string) => `Ya empujaste hoy a ${name}`,
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
    withWhomHint: 'Cada persona recibe el reto y decide si se une. Sus marcas cuentan desde que se une.',
    noMembers: 'Invita a alguien primero. Un reto sin testigos es un hábito.',
    meToo: 'Yo también',
    meTooHint: 'Al unirte, el reto usa un hábito tuyo con ese nombre y cuenta contra el máximo de cinco.',
    create: 'Crear reto',
    habitsFull: 'Ya tienes 5 hábitos. Archiva uno para unirte.',
    /** Bajo las veces por semana, cuando el nombre es el de un hábito tuyo. */
    targetFromHabit: 'Usa la meta de tu hábito.',
  },
  /** circle/invite. */
  invite: {
    title: 'Invitar',
    yourCode: 'Tu código',
    yourCodeHint: 'Quien lo use te pide entrar a tu círculo. Tú decides si aceptas.',
    /** El QR lleva a la página de la invitación (ADR-0034), que abre Vesper si está. */
    qrHint: 'Con la cámara de otro teléfono, este código abre tu invitación, tenga o no Vesper.',
    qrA11y: (code: string) => `Código QR de tu invitación, ${code}`,
    share: 'Compartir invitación',
    /** What the share sheet sends: the code for typing, the link for tapping. */
    shareMessage: (code: string, link: string) => `Únete a mi círculo en Vesper: ${link} · Código ${code}`,
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
      /** El alias no cumple la regla del servidor: se sabe aquí, sin gastar un intento. */
      handleInvalid: 'Tu alias no sirve: de 3 a 20 letras sin tilde, números o _.',
      offline: 'Sin conexión. Vuelve a intentar cuando la tengas.',
      /** Hay cuenta en el servidor y este teléfono no tiene su clave. No es la red. */
      lostKey: 'Este teléfono no tiene la clave de tu cuenta, así que no puede pedir entrar.',
      server: 'El servidor no pudo con la solicitud. Inténtalo más tarde.',
    },
    /** Mientras el servidor reserva tu código. */
    preparing: 'Preparando tu invitación…',
    /** El botón de pedir entrar, mientras la solicitud sale. */
    sending: 'Enviando…',
    /**
     * Por qué tu código todavía no sirve (ADR-0044 §2). Aparece en lugar del QR:
     * un código que nadie puede usar no se muestra como si funcionara.
     */
    problem: {
      offline: 'Sin conexión. Tu código todavía no funciona para nadie más.',
      busy: 'Demasiados intentos. Espera un rato y vuelve a abrir esta pantalla.',
      handleTaken: 'Tu alias ya es de otra persona. Elige otro y tu código empieza a funcionar.',
      handleInvalid: 'Tu alias no sirve: de 3 a 20 letras sin tilde, números o _. Cámbialo y tu código empieza a funcionar.',
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
    /** Aceptar sin red: queda hecho aquí y sale solo en cuanto haya conexión. */
    acceptQueued: 'Aceptado en este teléfono. Entra a tu círculo cuando haya conexión.',
    /** El servidor ya no tiene esa solicitud. */
    acceptGone: 'Esa solicitud ya no existe.',
    acceptA11y: (name: string) => `Aceptar a ${name}`,
    declineA11y: (name: string) => `Rechazar a ${name}`,
    removeA11y: (name: string) => `Quitar a ${name}`,
    /**
     * Bajo el código, la primera vez que la cuenta nace sobre el círculo de ejemplo:
     * esas personas se acaban de ir, y se dice.
     */
    demoGone: 'Los ejemplos del círculo se fueron: desde ahora solo ves a personas reales.',
    members: 'En tu círculo',
    /** '3 de 12 lugares': cuenta también a quien pidió entrar y a quien espera respuesta. */
    count: (members: number, max: number) => `${members} de ${max} lugares`,
    waiting: 'esperando que acepte',
    remove: 'Quitar',
    removeQuestion: (name: string) => `¿Quitar a ${name} de tu círculo?`,
    removeMessage:
      'Deja de ver tus números y tú los suyos, y cada uno sale de los retos que hizo el otro. Sus marcas en los retos se borran.',
    /**
     * Con cuenta, cuando el servidor desplegado todavía no tiene la llamada de ADR-0049
     * (contestó 404): quitar solo cambia este teléfono. Se dice antes de confirmar.
     */
    removeMessageAccount:
      'Sale de tu círculo en este teléfono y sus marcas se borran. Por ahora el vínculo sigue en el servidor: todavía ve tu semana y puede darte ánimo. Para cortarlo del todo, borra tu cuenta en Ajustes › Círculo.',
    removeConfirm: 'Quitar',
    /**
     * Lo que dice la línea después de Rechazar, Quitar o Salir cuando el servidor no lo
     * supo todavía (ADR-0049): sin conexión, o un servidor sin la llamada.
     */
    endQueued: 'Hecho en este teléfono. Se completa en cuanto haya conexión.',
    declineUnsupported: 'Rechazada en este teléfono. El servidor todavía no sabe avisarle: su solicitud sigue esperando.',
    removeUnsupported:
      'Salió de tu círculo en este teléfono. El servidor todavía no sabe cortar el vínculo: sigue viendo tu semana hasta que sepa.',
    /**
     * Cómo llega una solicitud (ADR-0044, ADR-0037): un aviso que compone el otro
     * teléfono si lo tiene permitido, y si no, la próxima vez que abra Vesper.
     */
    deliveryNote: 'Le llega un aviso si lo tiene permitido; si no, lo ve al abrir Vesper.',
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
    noProfileBody: 'Un nombre y un alias. Al guardarlos vuelves aquí con este código.',
    createProfile: 'Crear tu perfil',
    /** Un link sin código válido: el campo para escribirlo está en Invitar. */
    typeCode: 'Escribir un código',
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
    /** La regla del alias, la misma que aplica el servidor (server/src/auth.ts). */
    handleRule: 'De 3 a 20: letras sin tilde, números o _. Es como te encuentran.',
    handleTaken: 'Ese alias ya es de otra persona.',
    /** Guardar sin red, con cuenta: el cambio sale solo en la próxima sincronía. */
    renamePending: 'Guardado aquí. Tu círculo lo ve cuando haya conexión.',
    saving: 'Guardando…',
    /** Sin cuenta: nada ha salido todavía (ADR-0044 §2). */
    profileHint: 'Nombre y alias viven en este teléfono hasta que invitas a alguien o usas un código. No hay correo ni contraseña.',
    /** Con cuenta: el nombre y el alias ya están en el servidor. */
    profileHintAccount:
      'Tu nombre y tu alias están en el servidor del círculo para que tu gente te vea. No hay correo ni contraseña.',
    share: 'Qué compartes',
    shareFocus: { label: 'Horas de foco', description: 'Tu tiempo enfocado de la semana' },
    /**
     * Solo los números de la semana de tus hábitos: un reto se comparte porque te
     * uniste a él, y unirse es el consentimiento (ADR-0042 §5).
     */
    shareHabits: { label: 'Hábitos', description: 'Cuántas veces cumpliste tus hábitos esta semana' },
    shareSocial: { label: 'Uso de redes', description: 'El piso estimado del teléfono' },
    shareHint:
      'El uso de redes es una estimación y se muestra como tal, en su propia línea. Los retos a los que te unes siempre muestran qué días marcaste a quienes están en ellos. Lo que apagas aquí, tu círculo no lo ve; en tu respaldo solo va cifrado.',
    /**
     * Redes encendido, pero sin dato real que mandar (iOS, o el piso de ejemplo): no se
     * comparte nada, y se dice en vez de dejar creer que sí (ADR-0035).
     */
    socialNothing: 'En este teléfono todavía no hay dato real de redes, así que no se comparte nada.',
    /** La fila que lleva al interruptor de los avisos del círculo (ADR-0027 §2). */
    notices: 'Avisos del círculo',
    noticesOn: 'Sí',
    noticesOff: 'No',
    seeCircle: 'Ver círculo',
    leaveCircle: 'Salir del círculo',
    leaveQuestion: '¿Salir del círculo?',
    leaveMessage: 'Se borran las personas, sus números, los ánimos y los retos. Tu perfil y tus hábitos se quedan.',
    /** Con cuenta y un servidor que sabe cortar vínculos (ADR-0049). */
    leaveMessageLinked:
      'Se borran las personas, sus números, los ánimos y los retos, y dejan de ver tu semana. Tu perfil y tus hábitos se quedan.',
    leaveUnsupported:
      'Saliste en este teléfono. El servidor todavía no sabe cortar vínculos: tu círculo sigue viendo tu semana. Para cortar del todo, borra la cuenta.',
    /**
     * Con cuenta: el servidor todavía no sabe cortar vínculos, así que salir vacía este
     * teléfono y nada más. Se dice antes de confirmar.
     */
    leaveMessageAccount:
      'Se borran de este teléfono las personas, sus números, los ánimos y los retos. Mientras tengas cuenta, tu círculo sigue viendo tu semana. Para cortar del todo, borra la cuenta.',
    leaveConfirm: 'Salir',
    /**
     * La clave de respaldo vive en Ajustes › Respaldo desde el ADR-0048: es la de toda
     * la cuenta, no solo la del círculo. Aquí queda una fila que lleva allá.
     */
    backupRow: 'Clave de respaldo',
    backupRowHint: 'Con tu clave vuelve todo en otro teléfono: tus datos, tu círculo y tus retos.',
    deleteAccount: 'Borrar la cuenta',
    deleteQuestion: '¿Borrar tu cuenta?',
    /** La cuenta es la identidad (ADR-0048): con ella se van el respaldo y el círculo. */
    deleteMessage:
      'Se borran del servidor tu cuenta, tu círculo y tu respaldo, y tu clave de este teléfono. La app sigue funcionando entera, con una cuenta nueva y anónima.',
    deleteConfirm: 'Borrar',
    deleteFailed: 'No se pudo borrar la cuenta. Inténtalo cuando haya conexión.',
    /** Borrar sin la clave: se limpia aquí y la cuenta queda en el servidor, sin dueño. */
    deleteOrphaned:
      'Se borró de este teléfono, pero la cuenta sigue en el servidor: sin su clave nadie puede borrarla ni volver a entrar con ella.',
    /**
     * "Borrar todo y reiniciar" sin red: la base se vacía igual y la clave sale del
     * llavero, pero la cuenta sigue en el servidor y ya no hay con qué borrarla.
     * Se dice en voz alta, no en una nota al pie (ADR-0044 §7).
     */
    resetLeftAccountTitle: 'Tu cuenta sigue en el servidor',
    resetLeftAccount:
      'No se pudo borrar, y con ella siguen tu respaldo cifrado y tu círculo. Este teléfono ya no tiene su clave: si la guardaste, puedes restaurarla; si no, nadie volverá a entrar con ella.',
  },
};
