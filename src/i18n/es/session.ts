import type { ArtworkId } from '../../domain/art/types';

/**
 * Everything a running session says: the active screen, the duration and emergency
 * sheets, the exit ritual, the completion page, the Live Activity on the lock screen
 * and the shield iOS draws over a blocked app. Clock text ('12:34') and durations
 * ('2h 15m') arrive already formatted; only the words live here.
 */
export const session = {
  /** The big button on every screen of the ritual and on the emergency sheet. */
  stayFocused: 'Seguir enfocado',
  active: {
    elapsedLabel: 'Llevas enfocado',
    /** Under the clock of an open session, instead of the progress bar. */
    openSince: (time: string) => `Sin límite · desde las ${time}`,
    /** The break button, when a break is available. */
    takeBreak: 'Pausa de 15 min',
    /** The same button while the next break is still locked. 'Pausa en 12m'. */
    breakIn: (remaining: string) => `Pausa en ${remaining}`,
    /** Under the clock when the mode is gone. */
    focused: 'Enfocado',
    /** The heading when the mode is gone. */
    fallbackName: 'Sesión',
    modeLabel: (name: string) => `${name}. Ver qué hace este modo`,
    art: 'Arte',
    end: 'Terminar',
    deepOnlyTimer: 'Profundo · solo el timer termina',
    emergencyLeft: (count: number) => `Desbloqueo de emergencia (${count})`,
    noEmergencyLeft: 'Sin desbloqueos de emergencia',
    interruptions: (count: number) => (count === 1 ? '1 interrupción' : `${count} interrupciones`),
  },
  duration: {
    title: '¿Cuánto tiempo?',
    /** '25 min', the chips. */
    minutes: (minutes: string) => `${minutes} min`,
    open: 'Sin límite',
    openHint: 'Termina cuando tú digas, o a las 12 horas. Un modo profundo corre como firme.',
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
      `Te quedan ${left} este mes. Termina la sesión ahora mismo, sin el ritual, y cuenta como cancelada.`,
    ready: 'Si de verdad es una emergencia, adelante.',
    wait: (seconds: number) => `Puedes confirmar en ${seconds} s.`,
    use: 'Usar un desbloqueo',
    /** Stored as the session's exit reason, so the ledger can say how it ended. */
    reason: 'desbloqueo de emergencia',
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
    phase: {
      inhale: 'Inhala',
      hold: 'Sostén',
      exhale: 'Exhala',
    },
    /** Under the breathing once it is done: what leaving now would mean. */
    counted: 'Lo hecho queda contado; lo que falta, no.',
    oneRound: 'Una ronda.',
    round: (cycle: number, cycles: number) => `Ronda ${cycle} de ${cycles}`,
    wantToEnd: 'Quiero terminar',
    /** 'Terminar · llevas 12m'. */
    endWithServed: (served: string) => `Terminar · llevas ${served}`,
    typeSentence: 'Escribe la frase.',
    /** The sentence typed in 'firm'. Short, first person, not something to autocomplete. */
    sentence: 'Elijo dejar esto ahora',
    sentenceField: 'Frase',
    sentencePlaceholder: 'Tal cual',
    reasonField: 'Motivo',
    reasonPlaceholder: 'Opcional',
    reasonHint: 'Queda guardado con la sesión. Nadie más lo ve.',
  },
  complete: {
    firstTitle: 'Primera sesión completa.',
    title: 'Sesión completa.',
    subtitle: 'Recuperaste tu tiempo.',
    /** An open session that hit its cap: closed by the app, not by the user. */
    cappedTitle: 'La sesión llegó a las 12 horas.',
    cappedSubtitle: 'Se cerró sola. Lo hecho queda contado.',
    mode: 'Modo',
    duration: 'Duración',
    intention: 'Intención',
  },
  liveActivity: {
    /** 'Enfocado · quedan 21m', under the mode name on the lock screen. */
    status: (remaining: string) => `Enfocado · quedan ${remaining}`,
    /** An open session counts up instead. */
    statusOpen: 'Enfocado · sin límite',
    /** 'Pausa · vuelves en 12m'. */
    statusBreak: (remaining: string) => `Pausa · vuelves en ${remaining}`,
    /** A session whose mode was deleted meanwhile still needs a name. */
    fallbackModeName: 'Foco',
    notIos: 'Las Live Activities solo existen en iPhone.',
    oldIos: 'Las Live Activities necesitan iOS 16.2 o más nuevo.',
    noModule: 'Este build no trae el módulo de Live Activities. Hay que recompilar el dev client.',
  },
  shield: {
    subtitle: 'Estás enfocado. Esta app espera.',
    back: 'Volver a Vesper',
    /** The Android shield button: it goes to the home screen, not to Vesper. */
    home: 'Volver',
  },
};
