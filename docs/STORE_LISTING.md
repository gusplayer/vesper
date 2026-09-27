# Ficha de Google Play

Textos de la ficha para el lanzamiento en Android. Español neutro (tú), sin voseo. Los
límites son los de Play Console: título 30 caracteres, descripción breve 80, descripción
completa 4000. Sin claims que la app no cumpla: el escudo cubre la app en menos de un
segundo, no la impide, y quien lo pone es quien lo puede quitar.

## Título (≤ 30)

- ES: `Vesper: foco y tiempo`
- EN: `Vesper: focus and time`

## Descripción breve (≤ 80)

- ES: `Sesiones de foco que pausan las apps que tú eliges. Sin registro ni anuncios.`
- EN: `Focus sessions that pause the apps you choose. No sign-up, no ads.`

## Descripción completa — español

Vesper es un temporizador de foco para ti, no para vigilar a nadie. Eliges qué apps
esperan mientras trabajas, tocas un botón y la sesión empieza. Si abres una
de esas apps antes de terminar, Vesper la cubre con un recordatorio y un solo botón:
Volver. Tú pusiste el bloqueo; tú lo puedes quitar.

**Qué hace**

- Sesiones de foco de 5 a 120 minutos, o sin límite, con una pausa de 15 minutos cada
  25 de foco.
- Modos: cada uno con sus apps, sus sitios y su profundidad. Suave termina tras una
  respiración; firme, tras dos y una frase; profundo solo termina con el reloj.
- Rutinas: un modo que se enciende solo a la hora que programaste, o cuando lo pidas.
- Hasta cinco hábitos y una meta semanal. Sin rachas, sin insignias, sin ranking.
- Un libro mayor del día con tres monedas que nunca se suman: tiempo invertido, tiempo
  verificado y tiempo consumido.
- Las semanas de vida que te quedan, si decides escribir tu fecha de nacimiento.
- Retos con tu círculo, de hasta doce personas que tú invitas. Si el reto lo permite,
  puedes agregar una foto al día que marcaste: la ven solo quienes están en ese reto, viaja
  cifrada de extremo a extremo y se borra del servidor dos semanas después de que el reto
  termina. Nunca es obligatoria.

**Qué necesita y por qué**

- *Acceso de uso*: para saber qué app está en pantalla durante una sesión y mostrar el
  recordatorio. Se lee en tu teléfono. Vesper solo anota cuántas veces el recordatorio cubrió
  cada app, para mostrártelo; nunca guarda cuánto tiempo usas una app.
- *Mostrar sobre otras apps*: para dibujar el recordatorio encima de la app que elegiste
  pausar. Nunca aparece fuera de una sesión.
- *Notificaciones*: para avisarte cuando termina una sesión o empieza una rutina, y para
  mostrar que hay una sesión en marcha.
- *Cámara*: solo si decides tomar una foto para un día de un reto. Las fotos de tu galería
  se eligen con el selector del sistema, que no le da a Vesper nada más.

Los dos primeros se piden solo cuando eliges apps reales en un modo, y la cámara solo al
tocar «Tomar una foto». La app funciona sin ellos.

**Qué no hace nunca**

- Sin registro, sin correo ni contraseña. Lo tuyo vive en tu teléfono; al servidor sube un
  respaldo cifrado, que se apaga en Ajustes, y lo que eliges compartir con tu círculo. Todo
  se borra desde Ajustes.
- No vende ni comparte datos. No hay anuncios ni SDKs de terceros para analítica.
- No es control parental: no vigila a otras personas, y lo que ve tu círculo lo eliges tú.
- No usa servicios de accesibilidad ni lee el contenido de otras apps.
- No impide abrir una app: la cubre en menos de un segundo. La decisión sigue siendo tuya.

Vesper está pensada para quien ya intentó usar menos el teléfono y sabe que el problema
no es la información, sino la fricción. Una pantalla, un botón, y el tiempo que elegiste.

## Full description — English

Vesper is a focus timer for you, not for watching anyone else. You choose which apps
should wait while you work, you tap a button, and the session starts. If you open one of
those apps before you are done, Vesper covers it with a reminder and a single button: Go
back. You set the block; you can lift it.

**What it does**

- Focus sessions from 5 to 120 minutes, or open-ended, with a 15-minute break every
  25 minutes of focus.
- Modes: each with its own apps, websites and depth. Soft ends after one breath; firm
  after two and a sentence; deep only ends with the clock.
- Routines: a mode that turns itself on at the time you scheduled, or whenever you ask.
- Up to five habits and one weekly goal. No streaks, no badges, no leaderboards.
- A ledger of the day with three currencies that are never added together: time
  invested, time verified and time consumed.
- The weeks of life you have left, if you choose to enter your birth date.
- Challenges with your circle, up to twelve people you invite. If a challenge allows it,
  you can add a photo to a day you marked: only the people in that challenge see it, it
  travels end-to-end encrypted and it leaves the server two weeks after the challenge
  ends. It is never required.

**What it needs and why**

- *Usage access*: to know which app is on screen during a session and show the reminder.
  It is read on your phone. Vesper only notes how many times the reminder covered each app,
  to show you; it never keeps how long you use an app.
- *Display over other apps*: to draw the reminder on top of the app you chose to pause.
  It never appears outside a session.
- *Notifications*: to tell you when a session ends or a routine starts, and to show that
  a session is running.
- *Camera*: only if you choose to take a photo for a day of a challenge. Photos from your
  library are picked with the system picker, which gives Vesper nothing else.

The first two are only requested when you pick real apps in a mode, and the camera only
when you tap "Take a photo". The app works without them.

**What it never does**

- No sign-up, no email, no password. Your data lives on your phone; the server gets an
  encrypted backup, which you can turn off in Settings, and what you choose to share with
  your circle. Everything can be erased from Settings.
- No selling or sharing data. No ads, no third-party analytics SDKs.
- Not parental control: it does not watch other people, and you choose what your circle
  sees.
- No accessibility services, and it never reads the content of other apps.
- It does not prevent an app from opening: it covers it within a second. The decision is
  still yours.

Vesper is for people who have already tried to use their phone less and know the problem
is not information but friction. One screen, one button, and the time you chose.

## Notas

- Categoría: Productividad. Clasificación: utilidad, **con contenido generado por usuarios**
  desde ADR-0051: una foto opcional en el día marcado de un reto, visible solo para quienes
  están en él. Las respuestas del cuestionario están en `docs/APP_REVIEW.md` §3.
- Público objetivo: 18 años o más. No es una app para familias.
- Capturas: Focus con el modo, el selector "Apps reales", la sesión, el escudo sobre otra
  app y la salida consciente. Los fotogramas de `docs/media/` sirven de punto de partida.
- Las declaraciones de permisos y de seguridad de datos están en `docs/PLAY_DECLARATIONS.md`;
  las notas para el revisor sobre las fotos, en `docs/APP_REVIEW.md`, y el proceso de
  moderación, en `docs/MODERATION.md`.
- Capturas con fotos: si una captura muestra un reto con fotos, las fotos son de la semilla
  de ejemplo o tomadas para la ficha, nunca de una persona real sin su permiso.
- **Se actualizó el 2026-09-26:** la descripción breve y "Qué no hace nunca" decían "sin
  cuenta ni nube", y dejó de ser cierto con la identidad y el respaldo (ADR-0048).
