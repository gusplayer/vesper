/**
 * La llave (ADR-0034): otro dispositivo que abre y cierra una sesión mostrando un
 * código. Español neutro, de tú, en oración.
 *
 * El nombre del producto es "llave", nunca "brick": Brick es de otra empresa y aquí
 * solo se usa como referencia interna de diseño.
 */
export const keys = {
  /** Ajustes › Llaves. */
  title: 'Llaves',
  subtitle: 'Un dispositivo que abre y cierra tus sesiones. Hay que tenerlo cerca.',
  empty: 'Todavía no tienes ninguna llave.',
  emptyHint: 'Con una llave, la sesión no termina hasta que vuelvas a escanearla.',
  add: 'Agregar una llave',
  max: (n: number) => `Hasta ${n} llaves.`,
  pairedOn: (date: string) => `Emparejada el ${date}`,
  remove: 'Quitar',
  removeConfirm: 'Quitar esta llave. Las sesiones que abrió siguen como están.',
  nameLabel: 'Nombre',
  /** What a key this phone holds is called until the user renames it. */
  defaultName: 'Esta llave',
  namePlaceholder: 'El teléfono de Ana',

  /** Elegir de qué lado está este teléfono. */
  choose: {
    title: '¿Este teléfono guarda la llave o la usa?',
    isKey: 'Guarda la llave',
    isKeyHint: 'Este teléfono muestra el código. El otro no podrá salir sin él.',
    usesKey: 'La usa',
    usesKeyHint: 'Este teléfono escanea el código para empezar y para terminar.',
  },

  /** Este teléfono es la llave: muestra el código de emparejamiento y luego los códigos. */
  show: {
    title: 'Muéstrale este código al otro teléfono',
    hint: 'Se escanea una sola vez. Después de esto, el código cambia solo.',
    done: 'Listo',
    codeTitle: 'Escanea para empezar',
    codeHint: 'El código cambia cada 30 segundos y cada uno sirve una sola vez.',
    gone: 'Esta llave ya no está en este teléfono.',
  },

  /** Este teléfono usa la llave: escanear para emparejar. */
  pair: {
    title: 'Escanea el código del otro teléfono',
    hint: 'Ponlo frente a la cámara.',
    named: 'Ya está. ¿Cómo quieres llamarla?',
    save: 'Guardar',
    badCode: 'Ese código no es de una llave.',
    full: 'Ya tienes todas las llaves que caben.',
    noKeychain: 'Este teléfono no pudo guardar la llave.',
  },

  /** Empezar y terminar una sesión con la llave. */
  session: {
    start: 'Empezar con una llave',
    startHint: 'La sesión no termina hasta que vuelvas a escanear.',
    scanToStart: 'Escanea la llave para empezar',
    scanToEnd: 'Escanea la llave para terminar',
    tooSoon: 'La llave no termina una sesión recién empezada. Espera un momento.',
    noMode: 'Elige un modo antes de escanear.',
    wrongKey: 'Ese no es el código de esta sesión.',
    sameCode: 'Espera al siguiente código.',
    locked: 'Solo la llave termina esta sesión.',
    lockedFoot: 'Con la llave · o el desbloqueo de emergencia',
  },

  /** El recibo, al desbloquear. Se lee entre los dos, ahí mismo. */
  receipt: {
    title: 'Sesión terminada',
    duration: (text: string) => `${text} de foco`,
    completed: 'Llegó a su tiempo',
    cut: 'Terminó antes',
  },

  /** De qué lado está cada llave, en la lista. */
  role: {
    shows: 'Este teléfono la muestra',
    scans: 'Abre este teléfono',
  },

  /** Lo que dice `status().reason` de src/platform cuando algo no existe. */
  platform: {
    noModule: 'Este build no trae la cámara. Hay que recompilar el dev client.',
    simulator: 'El simulador no tiene cámara. Esto se prueba en un teléfono.',
    denied: 'Vesper no tiene permiso para usar la cámara. Se activa en Ajustes del sistema.',
    noKeychain: 'Este teléfono no tiene dónde guardar la llave.',
    permissionTitle: 'Vesper necesita la cámara',
    permissionBody: 'Solo para leer el código de la llave. No toma fotos ni las guarda.',
    permissionAsk: 'Permitir la cámara',
  },
};
