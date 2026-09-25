/**
 * The identity without login (ADR-0048): finding a previous Vesper on a new phone,
 * restoring it with the backup key, and whether the key travels by itself.
 * Plain object, never `as const`.
 */
export const identity = {
  /**
   * Si la clave llega sola a un teléfono nuevo, y por qué no (regla 8). Lo dice
   * `identityTravels()` en src/platform/identity.ts.
   */
  travel: {
    icloudKeychain: 'Tu clave llega sola a un iPhone nuevo con tu cuenta de Apple, cifrada de extremo a extremo.',
    blockStore: 'Tu clave llega sola a un Android nuevo con tu cuenta de Google, cifrada con tu bloqueo de pantalla.',
    /** Android sin bloqueo de pantalla: la copia no sale del teléfono, para que Google no pueda leerla. */
    blockStoreNoScreenLock:
      'Con un bloqueo de pantalla, tu clave llegaría sola a un Android nuevo. Sin él, guarda tu clave de respaldo.',
    unavailable: 'Este teléfono no lleva tu clave a otro por sí solo. Guarda tu clave de respaldo.',
    /** "Empezar aparte" (ADR-0050 §9): la clave que viaja es la del otro dispositivo. */
    localOnly:
      'La clave de este dispositivo no viaja sola: la que viaja es la de tu otro dispositivo. Guárdala o agrega un correo de recuperación.',
  },
  /** La bienvenida, cuando encuentra un Vesper anterior en este teléfono. */
  welcome: {
    /** Mientras pregunta al servidor de cuándo es el respaldo. */
    found: 'Encontramos tu Vesper anterior.',
    /** '25 de septiembre de 2026': la fecha llega formateada con el idioma de la app. */
    foundBackup: (when: string) => `Encontramos tu Vesper anterior, con un respaldo del ${when}.`,
    foundNoBackup: 'Encontramos tu Vesper anterior. No tiene respaldo: vuelven tu círculo y las marcas de tus retos.',
    /** Sin red no se puede preguntar si sigue en uso ni de cuándo es el respaldo. */
    foundUnknown: 'Encontramos tu Vesper anterior. Sin conexión no se puede ver si sigue en uso ni de cuándo es su respaldo.',
    /**
     * Usado en los últimos 30 días (ADR-0050 §9); `when` es `ago`: 'hace 2 horas'. El
     * servidor no distingue otro dispositivo de una reinstalación de este: dice cuándo, no dónde.
     */
    inUse: (when: string) => `Este Vesper se usó por última vez ${when}. Si sigue en otro dispositivo, puedes traerlo aquí o empezar aparte.`,
    /** Hermes no trae Intl.RelativeTimeFormat: el "hace" se escribe aquí, en cada idioma. */
    ago: (count: number, unit: 'minute' | 'hour' | 'day') => {
      if (unit === 'minute') {
        return count === 1 ? 'hace 1 minuto' : `hace ${count} minutos`;
      }
      if (unit === 'hour') {
        return count === 1 ? 'hace 1 hora' : `hace ${count} horas`;
      }
      return count === 1 ? 'hace 1 día' : `hace ${count} días`;
    },
    restore: 'Restaurar',
    startFresh: 'Empezar de cero',
    bringHere: 'Traerlo aquí',
    bringHereQuestion: '¿Traerlo aquí?',
    bringHereMessage:
      'Si sigue en otro dispositivo, ese deja de respaldar y de ver tu círculo. Lo que tiene se queda en él, pero ya no se actualiza.',
    bringHereConfirm: 'Traerlo aquí',
    /** Una identidad propia para este dispositivo, sin borrar nada. */
    startApart: 'Empezar aparte',
    apartDone:
      'Este dispositivo tiene su propio Vesper y el otro sigue igual. Su clave no viaja sola: guárdala o agrega un correo en Ajustes › Respaldo.',
    haveKey: 'Tengo una clave',
    freshQuestion: '¿Empezar de cero?',
    freshMessage:
      'Se borran del servidor tu Vesper anterior, su respaldo y su círculo. No se puede deshacer.',
    freshConfirm: 'Borrar y empezar',
    /** Borrar sin red: la cuenta anterior se borra con su propia clave en cuanto haya conexión. */
    freshPending: 'Sin conexión: tu Vesper anterior se borra en cuanto haya red.',
  },
  /** restore/key: pegar la clave de respaldo. */
  key: {
    title: 'Tu clave de respaldo',
    body: 'Pégala como la guardaste, con espacios o sin ellos. Con ella vuelven tu respaldo, tu círculo y tus retos.',
    label: 'Clave',
    placeholder: 'Pega tu clave aquí',
    /** La forma no es la de una clave: se dice antes de mandar nada. */
    invalid: 'Esa no parece una clave de Vesper. Revisa que esté completa.',
    /** Desde la app, no desde la bienvenida: lo que hay aquí se reemplaza. */
    replaces: 'Restaurar reemplaza lo que hay en este teléfono por lo de esa clave.',
    restore: 'Restaurar',
    /** La fila hacia restore/email (ADR-0050 §3). */
    emailRow: 'Recuperar con mi correo',
    emailHint: 'Si agregaste un correo de recuperación, te llega un código y no necesitas la clave.',
  },
  /** restore/email: recuperar con el correo y un código (ADR-0050 §3). */
  email: {
    title: 'Recuperar con tu correo',
    body: 'Escribe el correo de recuperación que confirmaste en Vesper. Te llega un código de seis dígitos.',
    emailLabel: 'Correo',
    emailPlaceholder: 'tu@correo.com',
    send: 'Enviar código',
    sending: 'Enviando…',
    /** Nunca dice si el correo existe (ADR-0050 §4). */
    sent: (email: string) => `Si ${email} tiene un Vesper, te llegó un código. Dura diez minutos.`,
    codeLabel: 'Código',
    codePlaceholder: '123456',
    recover: 'Recuperar',
    recovering: 'Comprobando…',
    otherEmail: 'Usar otro correo',
    replaces: 'Recuperar reemplaza lo que hay en este teléfono por lo de ese Vesper.',
  },
  /**
   * Por qué no se pudo, con el correo de recuperación: al confirmarlo en Ajustes y al
   * recuperar. Un código equivocado y un correo sin Vesper dicen lo mismo (ADR-0050 §4).
   */
  recoveryErrors: {
    badEmail: 'Ese correo no parece completo. Revisa que tenga una @ y un dominio.',
    wrongCode: 'Ese código no sirve. Revisa el correo y los seis dígitos, o pide uno nuevo.',
    codeExpired: 'Ese código venció: dura diez minutos. Pide uno nuevo.',
    /** 429 del tope por dirección o por correo: esperar sí sirve. */
    tooMany: 'Demasiadas solicitudes seguidas. Espera un rato y vuelve a intentarlo.',
    /** 429 'too many attempts': cinco códigos equivocados; ese código ya no sirve. */
    tooManyAttempts: 'Demasiados intentos con ese código. Pide uno nuevo.',
    /** 502 'email not sent': el proveedor de correo no lo aceptó. */
    notSent: 'No se pudo enviar el correo. Prueba de nuevo más tarde.',
    /** 500 'escrow unreadable': el servidor ya no puede abrir su copia de la clave. */
    escrowUnreadable: 'Tu correo ya no puede devolverte la clave. Usa tu clave de respaldo en "Tengo una clave".',
    offline: 'Sin conexión. No se envió nada: inténtalo cuando haya red.',
    /** 503 'email not configured': el servidor todavía no tiene cómo enviar correos (regla 8). */
    notConfigured: 'El correo de recuperación todavía no está disponible. Tu clave de respaldo sigue funcionando.',
    noIdentity:
      'Este teléfono todavía no está registrado en el servidor. Pasa solo, la próxima vez que haya conexión.',
    noKey: 'Este teléfono no tiene su clave, así que no puede agregar un correo. Pégala en "Tengo una clave".',
    /** 401 con la clave de este dispositivo (ADR-0050 §10). */
    keyRejected:
      'La clave de este dispositivo dejó de servir: tu Vesper se trasladó a otro dispositivo o su clave cambió.',
    server: 'El servidor no respondió. Inténtalo de nuevo en un rato.',
  },
  /** restore/restoring: lo que pasó, en palabras. */
  restoring: {
    title: 'Restaurar',
    working: 'Restaurando tu Vesper…',
    workingNote: 'Toma unos segundos. No cierres la app.',
    restored: 'Listo. Tus datos volvieron a este teléfono.',
    circleOnly: 'No había respaldo. Volvieron tu círculo y las marcas de tus retos.',
    keyOnly: 'La clave es tuya, pero no había respaldo ni círculo que traer.',
    unreadable: 'Tu respaldo no se pudo abrir con esta clave. Volvió tu círculo, y el próximo respaldo lo reemplaza.',
    wrongKey: 'Esa clave no es de ninguna cuenta de Vesper. Revisa que sea la última que guardaste.',
    offline: 'Sin conexión. No se cambió nada: inténtalo cuando haya red.',
    newerApp: 'Ese respaldo es de una versión más nueva de Vesper. Actualiza la app y vuelve a intentarlo. No se cambió nada.',
    noKeychain: 'Este teléfono no puede guardar la clave, así que no se restauró nada.',
    failed: 'No se pudo restaurar. No se cambió nada: inténtalo de nuevo.',
    /** Restaurar rota el secreto (ADR-0048 §5). */
    keyChanged:
      'Tu clave de respaldo es nueva y la anterior deja de servir. Si la guardaste en un gestor de contraseñas, guarda la nueva desde Ajustes › Respaldo.',
    /** Lo que nunca viaja (ADR-0048 §9). */
    permissions: 'Los permisos se piden otra vez, cada uno cuando haga falta.',
    iosApps: 'En iPhone, elige otra vez las apps de cada modo: Tiempo de uso no las pasa de un teléfono a otro.',
    continue: 'Continuar',
    retry: 'Intentar de nuevo',
    otherKey: 'Probar otra clave',
  },
};
