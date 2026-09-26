/**
 * Photos in a challenge (ADR-0051): the optional photo pinned to a marked day, the
 * sheet that takes or picks it, the preview before saving, the viewer and the album a
 * finished challenge leaves. In this first step the photo never leaves the phone, and
 * every line says so where it matters.
 *
 * The photo is testimony, never proof: nothing here asks for one, counts them or says
 * a mark is worth more with one.
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
    /** Tanda 1: nothing leaves the phone. */
    onlyYou: 'Solo la ves tú.',
    save: 'Guardar',
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
    removeConfirm: 'Quitar',
    goneTitle: 'Esta foto ya no está',
    goneDescription: 'Vuelve al reto.',
  },
  /** The end of a challenge. */
  album: {
    title: 'Tu álbum',
    note: 'Tus fotos se quedan en este teléfono hasta que archives el reto.',
    /** The archive confirmation, when there are photos: archiving deletes them. */
    archiveMessage: 'Sale de tu lista y tus fotos de este reto se borran. Tu hábito y tus marcas se quedan.',
  },
  /** circle/challenge-new. */
  create: {
    toggle: 'Fotos del día',
    toggleHint: 'Cada quien puede agregar una foto a su marca. Nunca es obligatoria.',
  },
};
