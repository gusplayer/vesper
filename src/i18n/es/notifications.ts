/**
 * What a local notification says: the three the app schedules ahead of time, the test
 * one behind "Probar ahora", and the Android channel they arrive through. The domain
 * builds the specs from this slice (`src/domain/reminders.ts`).
 */
export const notifications = {
  /** The Android channel name, visible in the system's notification settings. */
  channelName: 'Recordatorios',
  /** Why there are no notifications here (simulator, web). */
  unavailable: 'Las notificaciones solo existen en el teléfono.',
  sessionEnd: {
    title: 'Terminó tu sesión',
    /** `duration` is '1h 15m', language-neutral. */
    body: (duration: string) => `${duration} de foco. Vuelve a Vesper para cerrarla.`,
  },
  breakEnd: {
    title: 'Se acabó la pausa',
    body: 'Las apps vuelven a bloquearse. Tu sesión sigue.',
  },
  schedule: {
    title: (scheduleName: string) => `Empieza ${scheduleName}`,
    /** Tapping opens Vesper, and opening Vesper is what starts the session. */
    body: (modeName: string) => `Modo ${modeName}. Toca para empezar la sesión.`,
  },
  weeklyClose: {
    title: 'Cierra la semana',
    body: 'Mira cómo te fue. La que empieza mañana arranca en cero.',
  },
  /** The one "Probar ahora" shows right away. */
  test: {
    title: 'Así se ve un aviso',
    body: 'Vesper te va a hablar así. Toca para volver.',
  },
};
