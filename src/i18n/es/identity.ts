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
  },
  /** La bienvenida, cuando encuentra un Vesper anterior en este teléfono. */
  welcome: {
    /** Mientras pregunta al servidor de cuándo es el respaldo. */
    found: 'Encontramos tu Vesper anterior.',
    /** '25 de septiembre de 2026': la fecha llega formateada con el idioma de la app. */
    foundBackup: (when: string) => `Encontramos tu Vesper anterior, con un respaldo del ${when}.`,
    foundNoBackup: 'Encontramos tu Vesper anterior. No tiene respaldo: vuelven tu círculo y las marcas de tus retos.',
    /** Sin red no se puede preguntar de cuándo es el respaldo. */
    foundUnknown: 'Encontramos tu Vesper anterior. Sin conexión no se puede ver de cuándo es su respaldo.',
    restore: 'Restaurar',
    startFresh: 'Empezar de cero',
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
