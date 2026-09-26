/** 'Ana', 'Ana y Luis', 'Ana, Luis y Sofía'. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Photos in a challenge (ADR-0051): the optional photo pinned to a marked day, the
 * sheet that takes or picks it, the preview before saving, the viewer and the album a
 * finished challenge leaves. Since the second step a photo in a challenge with photos
 * goes, encrypted, to the people who joined it, and every line says who sees it.
 *
 * The photo is testimony, never proof: nothing here asks for one, counts them or says
 * a mark is worth more with one. No reactions, no counts, no "seen by", no "new".
 */
export const photos = {
  /**
   * `platform/camera` reasons (rule 8), one line under the row they explain. The camera
   * is missing in the simulator and on a phone without one; the picker is missing in a
   * build without expo-image-picker.
   */
  cameraUnavailable: 'La cámara no está disponible en este dispositivo.',
  pickerUnavailable: 'Esta versión de Vesper no puede abrir tus fotos.',
  /** 'martes 24'. `weekday` already comes in the language's own case. */
  day: (weekday: string, day: number, _month: string) => `${weekday} ${day}`,
  /** The row under your week on a challenge's page. */
  row: {
    addToday: 'Agregar la foto de hoy',
    addYesterday: 'Agregar la foto de ayer',
    changeToday: 'Cambiar la foto de hoy',
    changeYesterday: 'Cambiar la foto de ayer',
    /** Under "Agregar": the photo is never the condition of the mark. */
    optional: 'Es opcional: tu marca cuenta igual.',
  },
  /** The sheet the row opens: camera or library. */
  sheet: {
    today: 'Foto de hoy',
    yesterday: 'Foto de ayer',
    take: 'Tomar una foto',
    pick: 'Elegir de tu galería',
    preparing: 'Preparando la foto…',
    /** The camera was refused, now or before: the library still works (rule 8). */
    cameraDenied: 'Vesper no tiene acceso a la cámara. Puedes elegir de tu galería o darlo en Ajustes.',
    libraryDenied: 'Vesper no tiene acceso a tus fotos. Puedes darlo en Ajustes.',
    failed: 'No se pudo preparar la foto. Inténtalo de nuevo.',
  },
  /** circle/photo-new: the photo before it is saved. */
  preview: {
    caption: 'Pie de foto',
    captionPlaceholder: 'Una línea, si quieres',
    /** Nobody else will see it: photos off, no one else joined, or no account to send it with. */
    onlyYou: 'Solo la ves tú.',
    /**
     * Who will see it, by name (ADR-0051 §5): the people who joined the challenge, not
     * whoever joins it later.
     */
    audience: (names: readonly string[]) =>
      names.length === 1 ? `La ve ${joinNames(names)}, solo en este reto.` : `La ven ${joinNames(names)}, solo en este reto.`,
    /** Nothing leaves: 'Guardar'. It goes to the challenge: 'Agregar al reto'. */
    save: 'Guardar',
    add: 'Agregar al reto',
    /** Shared, and the upload waits: no connection, or the queue has not gone out yet. */
    queued: 'Se sube cuando haya conexión.',
    retake: 'Tomar otra',
    repick: 'Elegir otra',
    /** The day stopped taking a photo while the preview was open: unmarked, or midnight passed twice. */
    slotGone: 'Ese día ya no admite foto. Solo hoy y ayer, en un día marcado.',
    photoA11y: 'La foto que vas a guardar',
  },
  /** circle/photo: one photo, opened from the grid or the album. */
  viewer: {
    /** 'Tú · martes 24'. */
    whoDay: (who: string, day: string) => `${who} · ${day}`,
    caption: (text: string) => `“${text}”`,
    /** Where it came from, said quietly and only here, never in the grid. */
    fromCamera: (time: string) => `Con la cámara · ${time}`,
    fromLibrary: 'De la galería',
    /** How the day's mark was counted (ADR-0042). The photo never changes it. */
    markSource: {
      health: 'Marcado con Salud',
      session: 'Marcado con sesiones de foco',
      manual: 'Marcado a mano',
    },
    mineA11y: (day: string) => `Tu foto del ${day}`,
    theirsA11y: (name: string, day: string) => `Foto de ${name} del ${day}`,
    remove: 'Quitar la foto',
    removeQuestion: '¿Quitar la foto?',
    removeMessage: 'Tu marca se queda.',
    /** Once it went out: removing it takes it from everyone who could see it. */
    removeSharedMessage: 'Se borra para todos. Tu marca se queda.',
    removeConfirm: 'Quitar',
    goneTitle: 'Esta foto ya no está',
    goneDescription: 'Vuelve al reto.',
    /** The photo is on its way to this phone: it downloads when it is opened. */
    downloading: 'Bajando la foto…',
    /** Why it did not come down this time (`usePhotoFetch`). Opening it again tries again. */
    downloadProblem: {
      offline: 'Sin conexión. La foto se baja cuando vuelvas a abrirla con conexión.',
      gone: 'Esta foto ya no está en el servidor.',
      unavailable: 'Este teléfono no puede abrir esta foto.',
      failed: 'No se pudo bajar la foto. Vuelve a abrirla para intentarlo otra vez.',
    },
    /** The "…" in the header: what VoiceOver says. */
    moreA11y: 'Más opciones de la foto',
    /** After "Reportar la foto": it is gone from this phone at once. */
    reported: 'Reportada. Ya no la ves, y la revisamos.',
    /** Reported without a connection: hidden here, the report goes out later. */
    reportedQueued: 'Reportada. Ya no la ves, y el reporte sale cuando haya conexión.',
    /** After "Ocultar las fotos de Ana". */
    hidden: (name: string) => `Ya no ves las fotos de ${name}.`,
    hiddenBody: 'Sus marcas se siguen viendo. Puedes volver a mostrarlas en Ajustes › Círculo.',
  },
  /**
   * The "…" of someone else's photo (ADR-0051 §18): report it, hide that person's
   * photos for you, or block them. Nothing here reacts to the photo.
   */
  options: {
    title: 'Opciones',
    report: 'Reportar la foto',
    hide: (name: string) => `Ocultar las fotos de ${name}`,
    hideHint: 'Solo para ti. Sus marcas se siguen viendo.',
    block: (name: string) => `Bloquear a ${name}`,
  },
  /** The report, in the same sheet. The key of that one photo goes with it, and nothing else. */
  report: {
    title: 'Reportar la foto',
    anonymous: 'Nadie sabrá que fuiste tú.',
    reasons: {
      unwanted: 'No debería estar aquí',
      consent: 'Sale alguien sin su permiso',
      minor: 'Sale un menor',
      other: 'Otra cosa',
    },
    note: 'Nota',
    notePlaceholder: 'Si quieres, cuéntanos más',
    send: 'Enviar el reporte',
    sending: 'Enviando…',
    failed: 'No se pudo enviar el reporte. Inténtalo de nuevo.',
  },
  /**
   * Blocking (ADR-0051 §18, ADR-0049): the link ends, and the person cannot ask to come
   * back. From the photo's "…" and next to "Quitar" in Invitar.
   */
  block: {
    label: 'Bloquear',
    a11y: (name: string) => `Bloquear a ${name}`,
    question: (name: string) => `¿Bloquear a ${name}?`,
    message: 'Sale de tu círculo y de tus retos, y no puede volver a pedir entrar. No se le avisa.',
    confirm: 'Bloquear',
    /** Without a connection: done here, the server hears it on the next sync. */
    queued: 'Bloqueado en este teléfono. Se completa en cuanto haya conexión.',
  },
  /** Ajustes › Círculo: the people whose photos you hid, and the way back. */
  hiddenPeople: {
    title: 'Fotos ocultas',
    footer: 'Solo para ti. Sus marcas se siguen viendo.',
    show: 'Mostrar',
    showA11y: (name: string) => `Mostrar las fotos de ${name}`,
  },
  /**
   * circle/photo-terms: before the first photo that leaves the phone (ADR-0051 §19).
   * Three blocks, the rule that has no exceptions, the terms, and "Ahora no".
   */
  terms: {
    title: 'Antes de tu primera foto',
    who: {
      heading: 'Quién la ve',
      body: 'Solo quienes ya están en este reto. No hay perfil ni feed: la foto no sale de ahí.',
    },
    howLong: {
      heading: 'Cuánto dura',
      body: 'Se borra del servidor 14 días después de que el reto termina, o a los 28 días en un reto sin fin. Puedes quitarla antes.',
    },
    care: {
      heading: 'Qué cuidar',
      body: 'Si sale otra persona, pregúntale antes. Quitamos la ubicación de la foto. Una captura de pantalla no se puede impedir.',
    },
    zeroTolerance:
      'Cero tolerancia con el abuso: una foto reportada se revisa, y quien sube algo sexual, violento, ilegal o que exponga a un menor sale de Vesper.',
    termsRow: 'Términos de uso',
    termsNote: 'Al tocar Entendido, aceptas estos términos para tus fotos.',
    accept: 'Entendido',
    notNow: 'Ahora no',
  },
  /** circle/challenge, over "Unirme", in a challenge with photos (ADR-0051 §5). */
  invited: 'En este reto se comparten fotos. Las tuyas son opcionales.',
  /** The end of a challenge. */
  album: {
    title: 'Tu álbum',
    note: 'Tus fotos se quedan en este teléfono hasta que archives el reto.',
    /** Everyone's, when the photos went out: a row per person, no counts. */
    groupTitle: 'El álbum',
    /** A fixed date, never a countdown (ADR-0051 §12): '25 de octubre'. */
    until: (date: string) => `Las fotos se quedan aquí hasta el ${date}.`,
    /** The archive confirmation, when there are photos: archiving deletes them. */
    archiveMessage: 'Sale de tu lista y tus fotos de este reto se borran. Tu hábito y tus marcas se quedan.',
  },
  /** circle/challenge-new. */
  create: {
    toggle: 'Fotos del día',
    toggleHint: 'Cada quien puede agregar una foto a su marca. Nunca es obligatoria.',
  },
};
