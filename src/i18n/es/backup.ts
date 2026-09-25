/**
 * The encrypted backup (ADR-0048): Ajustes › Respaldo and what it says about itself.
 *
 * Every line has to stay true (rule 8): the copy is encrypted on the phone before it
 * leaves, the server keeps it and cannot read it, and without the key nobody can open
 * it — Vesper included.
 */
export const backup = {
  title: 'Respaldo',
  toggleTitle: 'Respaldo cifrado',
  toggleDescription:
    'Una copia de tus datos que se cifra en este teléfono antes de salir. El servidor la guarda, pero no puede leerla.',
  /** Con correo de recuperación el servidor puede devolver la clave (ADR-0050 §1), y lo dice. */
  toggleDescriptionWithEmail:
    'Una copia de tus datos que se cifra en este teléfono antes de salir. Como agregaste un correo, Vesper también guarda tu clave, cifrada, para devolvértela.',
  /** What travels and what does not (ADR-0048 §7, §9). */
  contents:
    'Lleva tus modos, rutinas, sesiones, hábitos con sus marcas de Salud, tu meta, Vida y tu círculo. Las apps que eliges en iPhone no viajan: Tiempo de uso las ata a cada teléfono y se eligen de nuevo.',
  /** Under the switch while it is off. There is no way yet to delete the last copy by itself. */
  offNote: 'Apagado no se sube nada, y la copia del servidor se borra en cuanto haya conexión.',
  backupNow: 'Respaldar ahora',
  backingUp: 'Respaldando…',
  /** After "Respaldar ahora" worked. */
  done: 'Listo. Tu respaldo está al día.',
  keyTitle: 'Clave de respaldo',
  /** What is lost without it, said on the screen and not in a footnote (ADR-0048). */
  keyHint:
    'Solo esta clave abre tu respaldo. Guárdala en tu gestor de contraseñas: si pierdes el teléfono y la clave no llegó sola al nuevo, sin ella tu respaldo no se puede abrir. Nadie más la tiene, tampoco Vesper.',
  /** Lo mismo con correo de recuperación: "Nadie más la tiene" dejó de ser cierto. */
  keyHintWithEmail:
    'Solo esta clave abre tu respaldo. Guárdala en tu gestor de contraseñas. Como agregaste un correo de recuperación, Vesper también puede devolvértela.',
  /** 401 con la clave de este dispositivo (ADR-0050 §10): la clave que se muestra ya no sirve. */
  keyMoved:
    'Esta clave ya no abre tu Vesper. Si lo trajiste a otro dispositivo, la nueva está allí. Pega una clave en "Tengo una clave" o empieza una identidad nueva aquí.',
  /** Opens the system sheet, where Copiar and the password manager are. */
  keySave: 'Copiar o guardar la clave…',
  /** This install has no identity yet, or the keychain did not answer. */
  keyMissing: 'Este teléfono todavía no tiene su clave. Aparece aquí en cuanto se registre.',
  /** Registered, and the key did not come with the data: an Android system restore without a screen lock. */
  keyLost: 'Tus datos llegaron a este teléfono, pero tu clave no. Sin ella no se respalda nada: pégala en "Tengo una clave" o empieza una identidad nueva.',
  newIdentityRow: 'Empezar una identidad nueva',
  newIdentityHint: 'Tus datos se quedan en este teléfono y el respaldo vuelve a salir. Tu círculo anterior solo vuelve con tu clave.',
  newIdentityTitle: '¿Empezar una identidad nueva?',
  newIdentityMessage: 'Tus datos de este teléfono se quedan. El respaldo y el círculo anteriores solo se pueden recuperar con tu clave; sin ella quedan cerrados.',
  newIdentityConfirm: 'Empezar',
  /** Nada empezó: sin red no se puede comprobar que la clave dejó de servir. */
  newIdentityFailed: 'No se empezó nada: no hay conexión o el servidor no respondió. Inténtalo de nuevo.',
  /** La fila hacia settings/recovery-email (ADR-0050 §1). */
  recoveryRow: 'Correo de recuperación',
  recoveryNone: 'Ninguno',
  /** El precio, en una línea. */
  recoveryHint: 'Con un correo, Vesper puede devolverte tu clave, así que tu respaldo deja de estar cerrado solo para ti.',
  restoreRow: 'Tengo una clave',
  restoreHint: 'Para traer a este teléfono el respaldo de otro.',
  /** `status().reason`, one line, always true. `when` is already '25/09/26, 3:20 p. m.'. */
  status: {
    off: 'El respaldo está apagado.',
    /** Registered and the key is not on this phone: nothing can be sealed or signed. */
    noKey: 'No se respalda nada hasta que este teléfono tenga su clave.',
    /** The server refused this device's key (ADR-0050 §10). */
    moved:
      'La clave de este dispositivo dejó de servir: tu Vesper se trasladó a otro dispositivo o su clave cambió. Desde aquí no se respalda nada.',
    noCrypto: 'Este teléfono no puede cifrar el respaldo, así que no sale nada.',
    noIdentity: 'El respaldo empieza cuando este teléfono se registre en el servidor. Pasa solo, la próxima vez que haya conexión.',
    never: 'Todavía no hay respaldo. Se hace al cerrar una sesión y, como mucho, una vez al día.',
    last: (when: string) => `Último respaldo: ${when}.`,
    /** `why` is one of `errors`, a full sentence. */
    failed: (why: string, when: string) => `${why} El último respaldo desde este teléfono fue el ${when}.`,
    failedNever: (why: string) => `${why} Todavía no hay respaldo.`,
  },
  /** settings/recovery-email (ADR-0050 §1). The errors are `identity.recoveryErrors`. */
  recoveryEmail: {
    title: 'Correo de recuperación',
    /** El precio del ADR, en una línea, arriba de todo. */
    price: 'Con un correo, Vesper puede devolverte tu clave, así que tu respaldo deja de estar cerrado solo para ti.',
    body: 'Si pierdes el teléfono y tu clave, recuperas tu Vesper en cualquier teléfono con un código que llega a este correo.',
    loading: 'Consultando tu cuenta…',
    /** Sin red al abrir: no se sabe si ya hay uno. */
    unknown: 'Sin conexión no se puede ver si ya tienes un correo de recuperación.',
    emailLabel: 'Correo',
    emailPlaceholder: 'tu@correo.com',
    send: 'Enviar código',
    sending: 'Enviando…',
    codeSent: (email: string) => `Te enviamos un código a ${email}. Dura diez minutos.`,
    codeLabel: 'Código',
    codePlaceholder: '123456',
    confirm: 'Confirmar',
    confirming: 'Confirmando…',
    otherEmail: 'Usar otro correo',
    confirmedTitle: 'Tu correo',
    confirmedNote: 'Si pierdes tu clave, con este correo recuperas tu Vesper en cualquier teléfono.',
    done: 'Listo. Tu correo quedó confirmado.',
    change: 'Cambiar el correo',
    remove: 'Quitar el correo',
    removing: 'Quitando…',
    removeQuestion: '¿Quitar el correo?',
    removeMessage: 'Vesper borra tu correo y la copia de tu clave. Tu respaldo vuelve a abrirse solo con tu clave.',
    removeConfirm: 'Quitar',
    removed: 'Quitaste el correo. Vesper ya no guarda una copia de tu clave.',
  },
  /** Why the last attempt did not go out. Each one is a fact, never "algo salió mal". */
  errors: {
    offline: 'No se pudo respaldar: no hay conexión.',
    tooLarge: 'No se pudo respaldar: la copia pasa de 5 MB, el tope del servidor.',
    unauthorized: 'No se pudo respaldar: el servidor no reconoce la clave de este teléfono.',
    rateLimited: 'No se pudo respaldar: demasiados intentos seguidos. Se intenta de nuevo en un rato.',
    server: 'No se pudo respaldar: el servidor no respondió.',
    crypto: 'No se pudo cifrar el respaldo en este teléfono, así que no salió nada.',
    failed: 'No se pudo leer la base de este teléfono para respaldarla.',
    /** The server holds a newer copy that another install wrote; only the person replaces it. */
    newerElsewhere:
      'Tu cuenta tiene un respaldo más nuevo, hecho desde otro teléfono. No se reemplaza solo: “Respaldar ahora” lo cambia por lo de este.',
  },
};
