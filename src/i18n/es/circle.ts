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

export const circle = {
  sync: {
    /** Why nothing here is real yet, as `status().reason` in src/platform/circle.ts says it. */
    unavailable: 'Todavía no hay conexión con otros teléfonos. Lo que ves son datos de ejemplo.',
  },
  /** The section at the end of Actividad › Semanal. */
  section: {
    title: 'Tu círculo',
    noProfileTitle: 'Un círculo es la gente a la que le contarías que hoy no tocaste el teléfono.',
    noProfileBody: 'Crea tu perfil para invitar o ser invitado. Sin feed, sin ranking, sin avisos.',
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
    /** '4 veces por semana · 2 semanas'. */
    summary: (target: number, weeks: number) =>
      `${target} veces por semana · ${weeks === 1 ? '1 semana' : `${weeks} semanas`}`,
    /** 'con Ana y Luis'. */
    withNames: (names: readonly string[]) => `con ${joinNames(names)}`,
    alone: 'solo tú',
    nobody: 'sin participantes',
    status: {
      upcoming: 'Empieza el lunes',
      /** 'Última semana', 'Quedan 2 semanas'. */
      active: (weeksLeft: number) => (weeksLeft <= 1 ? 'Última semana' : `Quedan ${weeksLeft} semanas`),
      ended: 'Terminó',
    },
    /** '3 de 4'. */
    progress: (done: number, target: number) => `${done} de ${target}`,
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
  },
  /** circle/challenge-new. */
  challengeNew: {
    title: 'Nuevo reto',
    name: 'Nombre',
    namePlaceholder: 'leer, caminar, dormir 7h',
    fromHabit: 'Desde un hábito',
    fromHabitHint: 'Toca uno para usar su nombre y su meta.',
    timesPerWeek: 'Veces por semana',
    weeks: 'Cuántas semanas',
    /** '1 semana', '2 semanas'. */
    weeksOption: (weeks: number) => (weeks === 1 ? '1 semana' : `${weeks} semanas`),
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
    result: {
      ok: 'Solicitud enviada. Cuando acepte, aparece en tu círculo.',
      invalid: 'Ese código no existe. Son seis letras o números.',
      full: 'Tu círculo está lleno. Doce es el máximo, a propósito.',
      self: 'Ese es tu propio código.',
    },
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
    prototypeNote: 'En el prototipo nadie recibe la solicitud.',
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
    goToCircle: 'Ver círculo',
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
  },
};
