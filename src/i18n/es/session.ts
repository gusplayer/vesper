import type { ArtworkId } from '../../domain/art/types';

/**
 * Everything a running session says: the active screen, the duration and emergency
 * sheets, the exit ritual, the completion page, the Live Activity on the lock screen
 * and the shield iOS draws over a blocked app. Clock text ('12:34') and durations
 * ('2h 15m') arrive already formatted; only the words live here.
 */
export const session = {
  /** The big button on every screen of the ritual and on the emergency sheet. */
  stayFocused: 'Seguir enfocando',
  active: {
    elapsedLabel: 'Tiempo en foco',
    /** Under the clock of an open session, instead of the progress bar. */
    openSince: (time: string) => `Sin límite · desde las ${time}`,
    /** The break button, when a break is available. */
    takeBreak: 'Pausa de 15 min',
    /** A caption, not a button, while the next break is still locked. 'Pausa disponible en 12m'. */
    breakIn: (remaining: string) => `Pausa disponible en ${remaining}`,
    /** Under the clock when the mode is gone. */
    focused: 'En foco',
    /** The heading when the mode is gone. */
    fallbackName: 'Sesión',
    /** What VoiceOver adds after the mode's name, which opens its details. */
    modeHint: 'Muestra qué hace este modo',
    /** What VoiceOver calls the thin bar under the clock. */
    progressLabel: 'Avance de la sesión',
    /** The ghost that opens the drawing, and the one that goes back to the clock. */
    art: 'Ver el dibujo',
    clock: 'Ver el reloj',
    end: 'Terminar',
    /** A caption under the bar in deep: the pill is gone, only the timer ends it. */
    deepOnlyTimer: 'Profundo · solo el reloj termina',
    /** Under the mode when a routine started this session: 'Rutina Trabajo · termina a las 18:00'. */
    routine: (name: string, time: string) => `Rutina ${name} · termina a las ${time}`,
    /** The intention written before starting, under the mode: '“Terminar el esquema”'. */
    intention: (text: string) => `“${text}”`,
    /** What VoiceOver reads on the life-buoy icon, top right. */
    emergencyLabel: (left: number) =>
      left === 0
        ? 'Desbloqueo de emergencia, no te quedan este mes'
        : left === 1
          ? 'Desbloqueo de emergencia, te queda 1'
          : `Desbloqueo de emergencia, te quedan ${left}`,
    interruptions: (count: number) => (count === 1 ? '1 interrupción' : `${count} interrupciones`),
  },
  duration: {
    title: '¿Cuánto tiempo?',
    /** '25 min', the chips. */
    minutes: (minutes: string) => `${minutes} min`,
    open: 'Sin límite',
    /** The hours come from the session's cap (domain/session). */
    openHint: (hours: number) => `Sin límite termina cuando tú digas, o a las ${hours} horas. Con un modo profundo corre como firme.`,
  },
  break: {
    title: 'Pausa',
    /** Under the countdown: when the session resumes and what the break allows. */
    body: (time: string) => `Vuelves a las ${time}. Mientras tanto, las apps se desbloquean.`,
    resumeNow: 'Volver ahora',
    endSession: 'Terminar la sesión',
  },
  emergency: {
    title: 'Desbloqueo de emergencia',
    body: (left: number) =>
      left === 1
        ? 'Te queda 1 este mes. Termina la sesión ahora mismo, sin el ritual, y cuenta como cancelada.'
        : `Te quedan ${left} este mes. Termina la sesión ahora mismo, sin el ritual, y cuenta como cancelada.`,
    ready: 'Si de verdad es una emergencia, adelante.',
    /**
     * Soft and firm have a free way out; said before the unlock is spent. Deep has none,
     * so it gets no line.
     */
    freeWay: {
      soft: 'Este modo se termina sin gastar uno: vuelve, toca Terminar y respira una ronda.',
      firm: 'Este modo se termina sin gastar uno: vuelve, toca Terminar, respira dos rondas y escribe la frase.',
    },
    wait: (seconds: number) => `Puedes confirmar en ${seconds} s.`,
    use: 'Usar un desbloqueo',
    /** What VoiceOver calls the ten-second bar. */
    waitLabel: 'Espera',
    /** The route with none left: only "Seguir enfocando" remains. */
    none: 'No te quedan desbloqueos este mes.',
    noneHint: 'Vuelven con el mes que viene.',
    /** How the stored identifier (`features/session/exitReason`) reads when a reason row shows it. */
    reason: 'desbloqueo de emergencia',
  },
  closed: {
    title: 'Sesión cerrada.',
    /** '12m quedan contados.' The served time, as the ledger will keep it. */
    counted: (served: string) => `${served} quedan contados.`,
    /** Under the title when the session ended with an emergency unlock. */
    emergency: (left: number) =>
      left === 0
        ? 'Usaste un desbloqueo. No te quedan este mes.'
        : left === 1
          ? 'Usaste un desbloqueo. Te queda 1 este mes.'
          : `Usaste un desbloqueo. Te quedan ${left} este mes.`,
    reason: 'Motivo',
    /** The duration row: what was served against the plan. '12m de 50m'. */
    servedOf: (served: string, planned: string) => `${served} de ${planned}`,
    /** The same for a session with no limit. */
    servedOpen: (served: string) => `${served} · sin límite`,
  },
  art: {
    /** What VoiceOver reads on the drawing: the work, how far along, what a tap does. */
    label: (name: string, percent: number) => `${name}, ${percent} por ciento. Toca para volver al reloj`,
    /** Shown under the drawing once it is complete: the name, then one quiet line. */
    works: {
      dog: { name: 'Perro', caption: 'Se sienta y espera contigo.' },
      eiffel: { name: 'Torre Eiffel', caption: 'Se levantó pieza a pieza, como tu sesión.' },
      face: { name: 'Rostro', caption: 'Mira hacia dentro. Lo demás puede esperar.' },
      liberty: { name: 'Estatua de la Libertad', caption: 'Lleva la antorcha en alto desde 1886. Tú solo sostén esta sesión.' },
      pagoda: { name: 'Pagoda', caption: 'Cinco techos que suben hacia el silencio.' },
    } satisfies Record<ArtworkId, { name: string; caption: string }>,
  },
  exit: {
    breatheFirst: 'Antes de decidir, respira.',
    /** Under the object: the breathing only runs while the finger is on it. */
    holdHint: 'Mantén el objeto y respira con él.',
    /** After letting go before a round ends. */
    releasedHint: 'Soltaste. La ronda vuelve a empezar.',
    /** What VoiceOver reads on the object. */
    holdLabel: 'Objeto de Vesper. Mantén para respirar',
    phase: {
      inhale: 'Inhala',
      hold: 'Sostén',
      exhale: 'Exhala',
    },
    /** Under the breathing once it is done: what leaving now would mean. */
    counted: 'Lo hecho queda contado; lo que falta, no.',
    oneRound: 'Una ronda.',
    /** What VoiceOver calls the bar under the object. */
    progressLabel: 'Respiración',
    round: (cycle: number, cycles: number) => `Ronda ${cycle} de ${cycles}`,
    wantToEnd: 'Quiero terminar',
    /** The primary when the ritual was opened from a break: going back lands on the break. */
    backToBreak: 'Volver a la pausa',
    /** 'Terminar · llevas 12m'. */
    endWithServed: (served: string) => `Terminar · llevas ${served}`,
    typeSentence: 'Escribe la frase.',
    /** The sentence typed in 'firm'. Short, first person, not something to autocomplete. */
    sentence: 'Elijo dejar esto ahora',
    sentenceField: 'Frase',
    sentencePlaceholder: 'Tal cual',
    /** Under the field after tapping "Terminar" with the sentence typed wrong. */
    sentenceMismatch: 'La frase no coincide',
    reasonField: 'Motivo',
    reasonPlaceholder: 'Opcional',
    reasonHint: 'Queda guardado con la sesión. Nadie más lo ve.',
  },
  complete: {
    firstTitle: 'Primera sesión completa.',
    title: 'Sesión completa.',
    subtitle: 'Recuperaste tu tiempo.',
    /** An open session that hit its cap: closed by the app, not by the user. */
    cappedTitle: (hours: number) => `La sesión llegó a las ${hours} horas.`,
    cappedSubtitle: 'Se cerró sola. Lo hecho queda contado.',
    mode: 'Modo',
    duration: 'Duración',
    intention: 'Intención',
    /**
     * The blocking row when nothing was really blocked (rule 8). With a real selection
     * the row is the mode's own 'Apps bloqueadas' and the count instead.
     */
    blocking: 'Bloqueo',
    blockingNone: 'Ninguno',
    notBlocked: (reason: string) => `Este teléfono no bloquea apps: ${reason}.`,
    notBlockedHere: 'Este teléfono no bloquea apps.',
  },
  liveActivity: {
    /**
     * Under the mode name on the lock screen and in the island. Only the phase: the
     * time next to it is a native clock, so no minutes are written here (ADR-0023).
     */
    statusFocus: 'En foco',
    /** An open session counts up instead. */
    statusOpen: 'En foco · sin límite',
    /** The break counts down next to it. */
    statusBreak: 'Pausa',
    /** A session whose mode was deleted meanwhile still needs a name. */
    fallbackModeName: 'Foco',
    notIos:
      'Las Actividades en tiempo real solo existen en iPhone. En Android la sesión se ve en una notificación fija, también con el teléfono bloqueado.',
    oldIos: 'Las Live Activities necesitan iOS 16.2 o más nuevo.',
    noModule: 'Esta versión de Vesper no puede mostrar Live Activities.',
  },
  shield: {
    subtitle: 'Estás enfocando. Esta app espera.',
    /** The iOS shield button. It only closes the blocked app, so it says just that. */
    close: 'Cerrar',
    /** The Android shield button: it goes to the home screen, not to Vesper. */
    home: 'Volver',
    /**
     * The Android shield's third line when the session has an end. Not a function:
     * Kotlin fills `{time}` with the device's short time format, so the placeholder
     * must stay written exactly like this.
     */
    releasesAt: 'Se libera a las {time}',
    /** The Android notification channel, as Settings › Notifications shows it. */
    channelName: 'Sesión de foco',
    channelDescription: 'Se muestra mientras una sesión bloquea apps.',
    /** Under the title of the Android notification; the chronometer counts next to it. */
    session: 'Sesión de foco',
    /** The same line during a break, counting down to the session coming back. */
    pause: 'Pausa',
  },
};
