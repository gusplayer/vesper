/**
 * What a local notification says: the ones the app schedules ahead of time (session,
 * break, routine, Sunday close, and the three daily ones of ADR-0027), the test one
 * behind "Probar ahora", and the Android channel they arrive through. The domain builds
 * the specs from this slice (`src/domain/reminders.ts`).
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
  /** At the reminder hour, when the streak is two days or longer and today does not count yet. */
  streakRisk: {
    title: (days: number) => `Tu racha de ${days} ${days === 1 ? 'día' : 'días'} termina a medianoche`,
    body: '10 minutos bastan.',
  },
  /** At the reminder hour, on a day with no session and no streak to warn about. */
  noFocus: {
    title: 'Hoy no has enfocado',
    body: '25 minutos y listo.',
  },
  /** After 3 and 7 days without opening the app. The body says what the app knows. */
  reactivation: {
    title: (days: number) => `Llevas ${days} ${days === 1 ? 'día' : 'días'} sin enfocar`,
    body: 'Una sesión corta cuenta.',
    bodyStreak: (days: number) => `Tu racha se detuvo en ${days}. Puedes empezar otra hoy.`,
    bodyCircle: 'Tu círculo sigue ahí.',
  },
  /** The one "Probar ahora" shows right away. */
  test: {
    title: 'Así se ve un aviso',
    body: 'Vesper te va a hablar así. Toca para volver.',
  },
};
