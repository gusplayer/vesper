# ADR-0024 — Sonido y vibración: la sesión se oye, apenas, y la app no

**Estado:** propuesta · 2026-09-17

## Contexto

Vesper no reproduce ningún sonido propio. No hay `expo-audio`, `expo-haptics` ni un
archivo de audio en el repo. Lo único que suena son dos avisos del sistema con el tono por
defecto de iOS: el fin de una sesión planeada y el fin de una pausa
(`src/domain/reminders.ts`). Con la app en primer plano, solo el de fin de sesión suena;
el resto llega en silencio. Empezar una sesión no suena ni vibra. Terminarla a mano
tampoco.

El dueño del producto pidió tres cosas:

1. Un sonido al **empezar** una sesión.
2. Un sonido al **terminar** una sesión.
3. Evaluar algo al **abrir la app**. La referencia es Opal, que arranca con un video
   corto con sonido. No se pide copiarlo; es un ejemplo de "la app tiene voz".

Lo que ya está decidido y que esto toca:

- ADR-0007 dejó los sonidos fuera de la app y exige un ADR para traerlos. Este es.
- Regla 6: sin spring, escala ni parallax; fade de 160 ms entre rutas. Un video de
  arranque es animación por definición.
- Regla del PRD: un toque desde abrir la app hasta estar en sesión. Nada puede ponerse
  delante de ese toque.
- ADR-0011: el toque se acusa invirtiendo el control, instantáneo. La app ya tiene un
  vocabulario para "respondí", y es visual.
- ADR-0017: cada capacidad nativa vive en `src/platform/`, expone `status()`, degrada
  sin romper y **se suscribe a los stores**, nunca al revés. El tema oscuro de la sesión
  ya funciona así: el store cambia y el resto reacciona.
- ADR-0023: cuando la app está cerrada, la sesión vive en superficies del sistema. Lo
  que suene ahí lo decide la notificación, no el JS.
- Una sesión puede arrancar sin que nadie toque nada (rutina, ADR-0019) y puede
  terminar sin que nadie mire (timer vencido con la app dormida).

## Opciones

### Al abrir la app

1. **Nada.** El splash estático de hoy, sin sonido.
2. **Un tono al arrancar.** Corto, sobre el splash.
3. **Un video corto con sonido**, a la manera de Opal.

Se descartan 2 y 3. Una app que suena al abrirse lo hace en la reunión, en la cama y en
el bus, y el usuario no eligió oírla: abrir no es una acción sobre la que la app tenga
algo que responder. Opal lo hace porque su arranque es un momento de marca para una
suscripción; el de Vesper es papel, y lo que promete es que no estorba. Además el video
choca de frente con la regla 6 y se interpone entre abrir y el toque que empieza la
sesión. Si algún día se quiere un momento de marca, el lugar es la **primera sesión**,
no el arranque.

### Al empezar y terminar una sesión

1. **Solo vibración.** Cero archivos, cero audio, funciona con el teléfono en silencio.
   Pero no se oye: el teléfono queda boca abajo en la mesa y la sesión empieza sin
   ceremonia.
2. **Solo sonido.** Se oye, pero desaparece con el interruptor de silencio, que es donde
   está el teléfono de mucha gente que quiere enfocarse.
3. **Sonido y vibración juntos, y el interruptor de silencio manda.** Con el teléfono en
   sonido pasa todo; en silencio queda la vibración. Nunca se fuerza el audio por encima
   del interruptor.

Se elige la 3.

## Decisión

1. **La app no suena al abrirse.** El splash sigue estático. No hay video ni tono de
   arranque.

2. **Dos sonidos, nada más, y los dos muy suaves.** Uno para empezar y uno para
   terminar. La intención es que el usuario se sienta tranquilo, no avisado: nada
   percusivo, nada brillante, nada que sobresalte. El carácter:

   - **Timbre**: cálido y redondo, como un cuenco tibetano rozado apenas o una nota de
     madera, sin metal ni agudos. Ningún "ding", ningún clic.
   - **Ataque lento**: el sonido aparece, no golpea. Entra en unos 30 ms y se apaga solo,
     con una cola natural corta. Dura alrededor de un segundo, nunca más de dos.
   - **Volumen bajo**: por debajo de una notificación del sistema. El reproductor se
     crea con `volume` en torno a 0,5 y el archivo se normaliza suave. Si alguien no
     lo oye en la calle, está bien: no es una alarma.
   - **Empezar**: una sola nota que se asienta, como una respiración que baja.
     **Terminar**: dos notas que suben despacio, la segunda más quieta que la primera.
     Las dos en la misma tonalidad para que se sientan de la misma familia.

   Formato `.wav` mono a 44,1 kHz en `assets/sounds/`, hechos en casa o con licencia
   CC0. Sin librerías de sonidos. Antes de aceptar un archivo, se escucha en un
   teléfono, a volumen medio, con el teléfono en la mesa: si llama la atención, se baja.

3. **El mismo sonido dentro y fuera de la app.** El aviso de fin de sesión deja el tono
   por defecto del sistema y usa el archivo de terminar, empaquetado por el plugin de
   `expo-notifications` (`sounds`). Así el usuario aprende un solo sonido para "terminó",
   lo oiga con la app abierta o desde la pantalla bloqueada. El aviso de fin de pausa
   también lo usa. El sistema reproduce los sonidos de notificación a su propio volumen,
   así que la suavidad tiene que estar en el archivo, no en el reproductor. Los avisos
   de rutina y de cierre semanal siguen en silencio.

4. **Qué suena y qué vibra**, por momento:

   | Momento | Sonido | Vibración |
   |---|---|---|
   | Abrir la app | — | — |
   | Empieza una sesión (toque, o mantener completado) | empezar | `impact` suave |
   | Empieza una pausa | — | `selection` |
   | Vuelve de la pausa | — | `impact` suave |
   | Termina completa o vence el timer, con la app activa | terminar | `impact` ligera |
   | Vence el timer con la app dormida | aviso del sistema con el sonido de terminar | la del aviso |
   | Sale antes de tiempo o usa la emergencia | — | `impact` ligera |

   La vibración sigue la misma regla que el sonido: suave siempre. Se usan `Soft` y
   `Light` de `expo-haptics` y nunca `notificationAsync`, cuyos patrones de éxito y
   error son dobles y triples pulsos pensados para alertar. Vesper no alerta.

   Sin la app activa el JS no corre, así que ahí no hay nada que decidir: es el aviso.
   Una sesión que la app **liquida al despertar** (`settleNow`, ADR-0022) no suena: el
   aviso ya sonó y el usuario está volviendo, no terminando.

5. **El sonido sigue al estado, no al gesto.** Igual que el tema oscuro: `focus.start`
   cambia el store y un hook de plataforma reacciona. Eso incluye una rutina que arranca
   sola con la app abierta, y es correcto: acaban de bloquearse las apps y la pantalla
   se volvió tinta; un sonido lo marca. Ni las pantallas ni el store importan audio.

6. **El interruptor de silencio manda.** `playsInSilentMode: false`. El audio se mezcla
   con lo que suene (`interruptionMode: 'mixWithOthers'`): quien enfoca con música no
   quiere que se le corte. Nunca en segundo plano.

7. **Un interruptor en Ajustes.** Una fila con `Toggle` en Ajustes › Notificaciones,
   en un grupo propio: "Sonido y vibración · Al empezar y terminar una sesión".
   Encendido por defecto. Se guarda en `Settings.sounds`. Apagado, no suena ni vibra
   nada dentro de la app; los avisos del sistema siguen su propio interruptor, que ya
   existe.

8. **Nada más suena.** Marcar un hábito, cambiar de pestaña, elegir un modo o dar ánimo
   en el círculo siguen en silencio. La regla 11 ya lo dice del círculo; se extiende a
   toda la app. Si alguien quiere un sonido para otra cosa, es un ADR nuevo.

## Cómo se construye

- `src/platform/sound.ts`: `status()`, `play(cue)` con `cue: 'start' | 'end'`, y
  `haptic(kind)`. Dos reproductores con `createAudioPlayer` creados una vez, con
  `seekTo(0)` antes de cada `play()`, liberados con `release()` al desmontar. Donde
  falte el módulo, `status().available` es falso y la fila de Ajustes lo dice, como las
  demás (ADR-0017).
- `src/platform/hooks/useSoundSync.ts`, montado en `PlatformEffects`. Se suscribe a
  `useFocusStore` y distingue la transición: `null → sesión` es empezar, `sesión →
  null` con `lastClosed.outcome` decide terminar o salir, y el cambio de
  `breakStartedAt` decide la pausa. Ignora la hidratación al arrancar y solo actúa con
  `AppState` en `active`.
- Cuando el toggle está encendido y la app está activa, el handler de primer plano de
  `notifications.ts` deja de sonar para `sessionEnd`: el sonido lo pone el hook, y así
  no suena dos veces.
- Dependencias nuevas: `expo-audio` y `expo-haptics`, ambas del SDK 57, sin plugin de
  configuración. Se justifican porque cada una es la única vía a su API del sistema.
- Cadenas nuevas en `src/i18n/{es,en}/settings.ts` para la fila y para la razón de no
  disponible.

## Consecuencias

- Hay que recompilar el dev client (ADR-0001): dos módulos nativos nuevos y un archivo
  de sonido dentro del paquete de notificaciones.
- En Android el sonido de una notificación vive en el canal y **no se puede cambiar
  una vez creado**: el canal de fin de sesión cambia de id. Es la misma restricción que
  ADR-0023 ya asume para el nombre del canal.
- `VIBRATE` ya está declarado en Android (`docs/PLAY_DECLARATIONS.md`); se actualiza la
  justificación de la tabla, que hoy dice "plantilla de Expo".
- En el simulador el audio sale por los parlantes del Mac y la vibración no hace nada.
  Se prueba en un teléfono.
- El usuario que tiene el teléfono en silencio nunca oye a Vesper. Es a propósito.
- Un `Settings` con un campo más y una migración de ajustes con su valor por defecto.
- Lo que sigue sin existir: sonido al abrir la app, sonidos en el resto de la interfaz,
  y cualquier cosa parecida a un video de arranque.
