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
  schedule: {
    title: (scheduleName: string) => `Empieza ${scheduleName}`,
    body: (modeName: string) => `Modo ${modeName}. Toca para enfocar.`,
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
