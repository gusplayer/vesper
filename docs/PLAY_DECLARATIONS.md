# Declaraciones de Google Play — bloqueo y Health Connect en Android

Fase 3 de ADR-0019. Todo lo que hay que pegar en Play Console para publicar el módulo
`vesper-blocking`. Los textos que Play exige en inglés van en inglés, con su traducción
debajo. Lo que declara el manifiesto fusionado del build actual (`android/app/build/…/
merged_manifests`) es la fuente de verdad; este documento no promete nada que no esté ahí.

Lo que el build declara hoy y viene de Vesper:

| Permiso / componente | Quién lo declara | Para qué |
|---|---|---|
| `PACKAGE_USAGE_STATS` | `modules/vesper-blocking` | Dos usos: saber qué app está al frente durante una sesión, y responder cuánto estuvo al frente cada app elegida hoy y esta semana, para el desglose de Actividad › Hoy (ADR-0029). Lo segundo se lee a demanda y no se guarda |
| `SYSTEM_ALERT_WINDOW` | `modules/vesper-blocking` | El escudo (`TYPE_APPLICATION_OVERLAY`) |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | `modules/vesper-blocking` | `BlockingService`, tipo `specialUse` |
| `POST_NOTIFICATIONS` | `modules/vesper-blocking`, `expo-notifications` | Notificación permanente de sesión; recordatorios de rutina |
| `POST_PROMOTED_NOTIFICATIONS` | `modules/vesper-blocking` | Android 16: la notificación de sesión pide promoverse a actualización en vivo (chip en la barra) |
| `RECEIVE_BOOT_COMPLETED` | `modules/vesper-blocking`, `expo-notifications` | Rearmar las ventanas de rutina y los recordatorios tras reiniciar |
| `SCHEDULE_EXACT_ALARM` | `modules/vesper-blocking` | Abrir y cerrar las ventanas de rutina al minuto (fase 2) |
| `<queries>` MAIN/LAUNCHER y MAIN/HOME | `modules/vesper-blocking` | Listar apps con lanzador; reconocer el launcher |
| `health.READ_STEPS`, `health.READ_EXERCISE`, `health.READ_SLEEP` | `modules/vesper-health` | Leer de Health Connect la semana en curso para marcar solos los hábitos verificados (ADR-0043). Solo lectura; nada se escribe |
| `<queries>` `com.google.android.apps.healthdata`, `PermissionsRationaleActivity` y su alias `VIEW_PERMISSION_USAGE` | `modules/vesper-health` | Saber si Health Connect está instalado; la pantalla que Health Connect abre para explicar por qué pedimos cada permiso |
| `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `VIBRATE` | plantilla de Expo / RN | La app de producción no hace ninguna llamada de red |

**No declarado, y no se declarará:** `QUERY_ALL_PACKAGES`, ningún `AccessibilityService`,
ningún `NotificationListenerService` (fuera de la fase 1), `READ_PHONE_STATE`, ubicación,
cámara, micrófono, contactos. `USE_EXACT_ALARM` tampoco: Vesper pide `SCHEDULE_EXACT_ALARM`,
el que concede el usuario, y funciona con alarmas inexactas si lo niega.

Políticas que aplican (URLs oficiales; `docs/PLATFORM_ANDROID.md` no cita ninguna, así
que estas hay que verificarlas al pegar):

- Servicios en primer plano: https://support.google.com/googleplay/android-developer/answer/13392821
  y tipos: https://developer.android.com/develop/background-work/services/fg-service-types
- Permisos: https://support.google.com/googleplay/android-developer/answer/9888170
- Visibilidad de paquetes (`QUERY_ALL_PACKAGES`): https://support.google.com/googleplay/android-developer/answer/10158779
- API de accesibilidad: https://support.google.com/googleplay/android-developer/answer/10964491
- Alarmas exactas: https://support.google.com/googleplay/android-developer/answer/13161072
- Datos del usuario y divulgación destacada: https://support.google.com/googleplay/android-developer/answer/10144311
- Seguridad de datos: https://support.google.com/googleplay/android-developer/answer/10787469
- Abuso de dispositivos y redes: https://support.google.com/googleplay/android-developer/answer/9888379
- Familias: https://support.google.com/googleplay/android-developer/answer/9893335
- Apps de salud: https://support.google.com/googleplay/android-developer/answer/12261419

---

## a) Servicio en primer plano `specialUse`

Play Console › Política › Contenido de la app › **Permisos de servicios en primer plano**.
Marcar `FOREGROUND_SERVICE_SPECIAL_USE` y rellenar los cuatro campos. El primer campo
usa exactamente el texto de `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` del manifiesto.

**1. Subtype / description (igual que el manifiesto)**

> Focus session: detects when a user-selected app comes to the foreground and covers it with a full-screen reminder until the session ends.

*Sesión de foco: detecta cuándo una app elegida por el usuario pasa al frente y la cubre
con un recordatorio a pantalla completa hasta que termina la sesión.*

**2. Describe the functionality**

> Vesper is a self-imposed focus timer. The user picks, per focus mode, which of their installed apps should wait while they focus. When the user starts a session (a tap on "Enfocarme 25 min", or a deliberate long press when the mode is deep) or a routine they scheduled opens its window, `BlockingService` starts as a foreground service. While the screen is on it reads `UsageStatsManager.queryEvents` about once per second and, when an app from the user's list comes to the foreground, it shows a full-screen overlay window (`SYSTEM_ALERT_WINDOW`) with the session name, the time it lifts, and one button, "Volver" (Go back), which returns to the launcher. The service stops when the user ends the session in Vesper or the session's end time passes. Between sessions the service does nothing. The same permission has a second, separate use with no service running: when the user opens the Activity tab, the app asks the system how long each app they chose in a mode was in the foreground today and this week, and shows that breakdown (a floor, never an exact figure). That answer is rendered and dropped — the app writes no usage history of its own, to its database or anywhere else. It never reads the content of other apps, never blocks the launcher, Settings, the dialer or system UI.

*Vesper es un temporizador de foco autoimpuesto. El usuario elige, por modo, qué apps
instaladas esperan mientras se enfoca. Al iniciar una sesión (un toque en "Enfocarme 25 min",
o una pulsación larga deliberada si el modo es profundo) o cuando abre la ventana de una rutina que el
usuario programó, `BlockingService` arranca en primer plano. Con la pantalla encendida
lee `UsageStatsManager.queryEvents` una vez por segundo y, cuando una app de la lista
pasa al frente, muestra una ventana superpuesta a pantalla completa con el nombre de la
sesión, la hora a la que se libera y un solo botón, "Volver", que lleva al inicio. El servicio se detiene cuando el
usuario termina la sesión en Vesper o vence su hora de fin. Entre sesiones no hace nada.
Nunca lee el contenido de otras apps, nunca bloquea el launcher, Ajustes, el marcador ni
la interfaz del sistema, y no guarda historial de las apps que ve.*

**3. User-facing impact**

> Without a foreground service Android stops the polling within seconds of Vesper leaving the screen, so the focus session would only work while the user is looking at Vesper — that is, never when it matters. With it, the user sees a persistent notification ("Sesión de foco", session name, a native countdown) for the length of the session, and a full-screen reminder the moment they open one of the apps they chose. There is no other user-visible effect.

*Sin servicio en primer plano, Android detiene el sondeo segundos después de que Vesper
salga de pantalla, y la sesión solo funcionaría mientras el usuario mira Vesper, es decir,
nunca cuando importa. Con él, el usuario ve una notificación permanente ("Sesión de
foco", nombre de la sesión) mientras dura la sesión, y un recordatorio a pantalla
completa en cuanto abre una de las apps que eligió. No hay otro efecto visible.*

**4. Why no other foreground service type fits**

> The task is "watch usage events and draw an overlay on the user's request". None of the enumerated types describe it: it is not media playback, media projection, location, camera, microphone, phone call, connected device, remote messaging, health (no Health Connect or sensors are involved in this service), data sync (nothing is transferred) or system exempted (Vesper is not a system app). `shortService` does not fit because a session lasts up to 12 hours (an open-ended session; a routine window up to 8). `specialUse` is the only remaining type and the subtype property in the manifest states the exact use.

*La tarea es "observar eventos de uso y dibujar una superposición a pedido del usuario".
Ningún tipo enumerado la describe: no es reproducción de medios, proyección, ubicación,
cámara, micrófono, llamada, dispositivo conectado, mensajería remota, salud (este servicio
no toca Health Connect ni sensores), sincronización (no se transfiere nada) ni exención
del sistema. `shortService` no sirve porque una sesión dura hasta 12 horas (una sesión sin
límite; una ventana de rutina, hasta 8). `specialUse` es el único tipo que queda y la propiedad del manifiesto dice el uso
exacto.*

**5. Video link**

> `<<VIDEO_URL>>` — unlisted link to `docs/media/vesper-android-demo.mp4` (1:07, Pixel 6 emulator, API 34): 0:00 the app's own permission screen, 0:03 "Usage access" granted in Settings, 0:09 "Display over other apps" granted, 0:17 back in the app; 0:26 the Clock app is ticked in the mode's real-app picker and the mode is saved; 0:35 hold to start the session, the persistent notification appears; 0:39 Home, the Clock app is opened and the full-screen reminder covers it; 0:41 "Volver"; 0:45 "Terminar" and one breathing round; 1:00 the session ends; 1:03 the Clock app opens normally again.

*Subir `docs/media/vesper-android-demo.mp4` a YouTube (no listado) o Drive con acceso por
enlace y pegar la URL. Los fotogramas clave están en `docs/media/android-*.png`.*

---

## b) Permisos sensibles

### `PACKAGE_USAGE_STATS` (acceso de uso)

- **Formulario en Play:** ninguno. Es un permiso de `appop`; Play lo revisa dentro de la
  política de permisos y de datos del usuario.
- **Cómo se pide:** no hay diálogo. `requestAuthorization()` abre
  `Settings.ACTION_USAGE_ACCESS_SETTINGS` y comprueba al volver. Solo se pide cuando el
  usuario entra a "Apps" dentro de un modo; nunca en el arranque.
- **Divulgación destacada (obligatoria antes de mandar a Ajustes, política de datos del
  usuario):** **existe desde ADR-0046**, como la ruta `/usage-access` (`src/app/usage-access.tsx`):
  una pantalla propia, no un `Alert`, con tres bloques —los dos propósitos por separado y
  la privacidad—, un botón que abre Ajustes y una salida. Se antepone en los dos sitios
  que piden el permiso: el paso de onboarding y "Apps" dentro de un modo. En iOS no
  se muestra.

  > **Vesper needs Usage access.** Vesper uses it for two things: during a focus session it checks which app is on screen, so it can show the reminder when you open one of the apps you chose; and in the Activity tab it shows how long each of those apps was in front today and this week. Both are processed on your phone and never leave it. Vesper stores no history of the apps you use: it asks the system each time and shows the answer.

  > **Vesper necesita el acceso a datos de uso.** Durante una sesión: Vesper mira qué app está al frente para cubrirla con el recordatorio cuando abres una de las que elegiste; la compara con tu lista y la suelta. En la pestaña Actividad: con la app abierta y sin sesión corriendo, Vesper le pregunta al sistema cuánto estuvo al frente hoy y esta semana cada app que elegiste, y te muestra el desglose. Nada de esto sale de tu teléfono y no va a ningún servidor. Vesper tampoco guarda historial de las apps que usas: se lo pregunta al sistema cada vez y muestra la respuesta.

  (Es el texto que la pantalla muestra de verdad, en `modes.usageAccess` de los dos diccionarios.)

- **Sin él:** `status()` responde "Falta el acceso de uso" y la pantalla lo dice; el resto
  de la app funciona igual.

### `SYSTEM_ALERT_WINDOW` (mostrar sobre otras apps)

- **Formulario en Play:** ninguno.
- **Cómo se pide:** `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`, desde la misma pantalla
  de "Apps", después del acceso de uso. La divulgación en pantalla:

  > **Display over other apps.** This is how Vesper shows the full-screen reminder on top of an app you chose to pause during a session. It is never shown at any other time.

  > **Mostrar sobre otras apps.** Así muestra Vesper el recordatorio a pantalla completa encima de una app que elegiste pausar durante una sesión. No se muestra en ningún otro momento.

- **Sin él:** el escudo cae a `ShieldActivity`, que Android 10+ puede negar desde segundo
  plano; `status()` responde "Falta mostrar sobre otras apps".

### `SCHEDULE_EXACT_ALARM`

- **Formulario en Play:** Play solo tiene formulario para `USE_EXACT_ALARM` (alarmas y
  calendarios), que Vesper **no** usa. `SCHEDULE_EXACT_ALARM` lo concede el usuario
  (`Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`) y Play lo evalúa contra la política de
  alarmas exactas. Si el revisor pregunta, la respuesta:

  > Vesper uses SCHEDULE_EXACT_ALARM only to open and close routine windows the user scheduled themselves (for example "Work, weekdays 9:00–12:00"). The alarm starts or ends a focus session at the minute the user chose; an inexact alarm would start the block up to several minutes late, which defeats a time-boxed session. The permission is requested in context, when the user saves a routine with a start time, and the app keeps working with reminders only if it is denied.

  > *Vesper usa SCHEDULE_EXACT_ALARM solo para abrir y cerrar ventanas de rutina que el usuario programó (por ejemplo "Trabajo, entre semana 9:00–12:00"). La alarma inicia o termina la sesión al minuto que eligió el usuario; una alarma inexacta empezaría el bloqueo varios minutos tarde, y una sesión con horario deja de tener sentido. Se pide en contexto, al guardar una rutina con hora, y si se niega la app sigue con recordatorios.*

- **Qué hace el código:** `WindowScheduler.kt` usa `setExactAndAllowWhileIdle` cuando
  `canScheduleExactAlarms()` es cierto y, si no, `setWindow` con diez minutos de margen.
  Nunca `USE_EXACT_ALARM`. Ver `docs/PLATFORM_ANDROID.md`, fase 2.

### `POST_NOTIFICATIONS`

Permiso en tiempo de ejecución, sin formulario. Se pide en el paso de notificaciones del
onboarding y, si se negó, al iniciar la primera sesión con bloqueo. Sin él el servicio
corre igual: solo deja de verse la notificación permanente.

### `RECEIVE_BOOT_COMPLETED`

Lo declaran `expo-notifications`, para reprogramar los recordatorios locales tras un
reinicio, y `modules/vesper-blocking` (`BootReceiver.kt`), para rearmar las ventanas de
rutina y volver a levantar el escudo si una ventana está abierta al reiniciar. No hay
formulario.

### Lo que NO se usa

- **`QUERY_ALL_PACKAGES`:** no. El selector lista solo las apps que responden al intent
  `MAIN`/`LAUNCHER` declarado en `<queries>`; `MAIN`/`HOME` identifica el launcher para no
  cubrirlo nunca. Si Play marca visibilidad de paquetes, la respuesta es "la app usa
  `<queries>` por intent, no `QUERY_ALL_PACKAGES`".
- **`AccessibilityService`:** no, y no se va a usar (ADR-0019, `docs/PLATFORM_ANDROID.md`).
  No hay `BIND_ACCESSIBILITY_SERVICE` en el manifiesto.
- **`NotificationListenerService`:** no en fase 1.

---

## c) Seguridad de datos (Data safety)

Play define "recopilar" como transmitir datos fuera del dispositivo. Vesper no transmite
nada: no hay cuenta, no hay backend, no hay analítica, no hay SDK de anuncios. Todo vive
en SQLite y en `SharedPreferences` del teléfono.

| Pregunta del formulario | Respuesta | Por qué |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | Nada sale del dispositivo |
| Is all of the user data collected by your app encrypted in transit? | n/a | No hay tránsito |
| Do you provide a way for users to request that their data is deleted? | n/a en el formulario; en la app, **sí** | Ajustes › "Borrar todo y reiniciar" vacía todas las tablas; desinstalar también |
| Independent security review | No | — |

Lo que la app toca, para que el revisor no encuentre sorpresas:

| Dato | Qué pasa con él | ¿Recopilado según Play? |
|---|---|---|
| Lista de apps instaladas (con lanzador) | Se lee para el selector; los nombres de paquete elegidos se guardan localmente en el modo | No |
| App en primer plano (eventos de uso) | Durante una sesión se lee cada segundo, se compara con la lista y se descarta. Al abrir Actividad se pregunta al sistema cuánto estuvo al frente cada app elegida, hoy y esta semana, y la respuesta se dibuja y se suelta. La app no guarda historial propio | No |
| Sesiones, modos, rutinas, hábitos, meta semanal, fecha de nacimiento (opcional) | SQLite local | No |
| Diagnóstico / crashes | No se envía | No |

Health Connect (ADR-0043) cambia este formulario: aunque nada salga del teléfono, hay que
declarar **Health and fitness → Health info / Fitness info** como datos a los que la app
accede, marcados "procesados solo en el dispositivo". Y se llena aparte la declaración de
Health Connect (sección f).

Cuando la app le hable al servidor del círculo, los días cumplidos de un reto de pasos sí
salen del teléfono (ADR-0042 §5): ahí la respuesta a la primera pregunta pasa a **Sí** y
hay que declararlo como compartido, con consentimiento del usuario.

---

## d) Lista de verificación de políticas

- [ ] **Familias / Diseñada para familias:** no. Público objetivo: 18 años o más en
  "Público objetivo y contenido". La app no está dirigida a niños y no es control
  parental: la persona que bloquea es la misma que puede quitar el bloqueo.
- [ ] **Apps de salud:** aplica desde ADR-0043. Declaración de Health Connect (sección f),
  política de privacidad publicada que nombre los tres tipos leídos, y una semana más de
  revisión.
- [ ] **Abuso de dispositivos y redes:** la superposición solo aparece sobre apps que el
  usuario eligió, durante una sesión que el usuario inició; siempre tiene "Volver"; nunca
  cubre el launcher, Ajustes, el marcador ni SystemUI; no modifica ni interfiere con
  otras apps más allá de dibujar encima; no hay bloqueo a nivel de sistema. Documentar
  el límite con honestidad: la app bloqueada abre y el escudo la cubre en menos de un
  segundo; no la impide.
- [ ] **Permisos:** cada permiso corresponde a una función visible, se pide en contexto
  (al entrar a "Apps"), y la app funciona si se niega. Sin `QUERY_ALL_PACKAGES`,
  sin accesibilidad. Divulgación destacada antes de mandar a Ajustes (ver b).
- [ ] **Servicios en primer plano:** declaración `specialUse` con texto y video (ver a).
- [ ] **Datos del usuario / Seguridad de datos:** "No recopila ni comparte" (ver c).
- [ ] **Stalkerware / monitoreo:** no aplica. Vesper vigila el propio dispositivo para el
  propio usuario, no reporta a nadie y no se oculta: la notificación permanente dice que
  hay una sesión.
- [ ] **Conducta engañosa:** la ficha dice lo que hace y lo que no (ver
  `docs/STORE_LISTING.md`); nada de "bloqueo imposible de saltar".
- [ ] **Nivel de API objetivo:** `compileSdk`/`targetSdk` 36 en el manifiesto generado
  (`PLATFORM_ANDROID.md`, fase 4); cumple el mínimo vigente. Confirmar en el build de release.
- [ ] **Cuestionario de clasificación de contenido:** utilidad / productividad, sin
  contenido generado por usuarios, sin compras, sin anuncios.
- [ ] **Acceso a la app (App access):** "Todas las funciones están disponibles sin
  cuenta" + las notas del revisor (ver e).

---

## e) Notas para el revisor

Pegar en "App access › Instructions" y en el campo de notas de la declaración del servicio.

> **All functionality is available without an account. How to test the foreground service in 60 seconds:**
> 1. Open Vesper. Grant "Usage access" and "Display over other apps" when the app sends you to Settings (both are asked from a mode's "Apps" screen), or grant them in advance in Settings › Apps › Vesper.
> 2. Focus tab › tap the mode name › "Gestionar modos" › "Editar" › "Apps" › tick any app, for example Clock › "Listo" › "Guardar modo".
> 3. Back on Focus, tap "Enfocarme 25 min" (a deep mode asks you to hold the button instead). A session starts and a persistent notification "Sesión de foco" with a countdown appears: that is the foreground service.
> 4. Go Home and open the app you ticked. Within a second a dark full-screen reminder "Vesper · <mode>" covers it, with the time it lifts and one button "Volver" that returns to Home.
> 5. Open Vesper › "Terminar" › after one breathing round tap "Terminar · llevas …". The session ends, the notification disappears and the app you ticked opens normally again.
>
> The app never uses AccessibilityService or QUERY_ALL_PACKAGES. Focus, habits, modes and routines work fully offline with no account. The only network feature is the optional circle (ADR-0033): a device account with no email, which syncs only what the user turns on, per metric, to people they invited. Deleting everything: Ajustes › "Borrar todo y reiniciar", and the circle account has its own delete.

*Traducción para uso interno: 1) abrir Vesper y conceder "Acceso de uso" y "Mostrar sobre
otras apps" cuando la app mande a Ajustes (se piden desde "Apps" de un modo) o
concederlos antes en Ajustes › Apps › Vesper. 2) Focus › nombre del modo › "Gestionar
modos" › "Editar" › "Apps" › marcar Reloj › "Listo" › "Guardar
modo". 3) Tocar "Enfocarme 25 min" (un modo profundo pide mantener): arranca la sesión y
aparece la notificación "Sesión de foco" con cuenta regresiva. 4) Ir al inicio y abrir
Reloj: en menos de un segundo el escudo "Vesper · Sin redes" lo cubre, con la hora a la
que se libera y "Volver". 5) Abrir Vesper › "Terminar" › una
ronda de respiración › "Terminar · llevas …". Sin AccessibilityService, sin
`QUERY_ALL_PACKAGES`, sin red, sin cuenta. Borrar todo: Ajustes › "Borrar todo y reiniciar".*

---

## f) Declaración de Health Connect

Play Console › Política de la app › Permisos de Health Connect. Un texto por tipo, en
inglés; Vesper solo lee.

| Permiso | Justificación para pegar |
|---|---|
| `READ_STEPS` | Vesper marks a user's walking habit as done on the days Health Connect reports the step goal the user wrote in the habit's name (8,000 by default). Only the current week is read, on the device, when the app is open. |
| `READ_EXERCISE` | Vesper marks a user's workout habit as done on the days Health Connect has an exercise session of 10 minutes or more. Only the current week is read, on the device, when the app is open. |
| `READ_SLEEP` | Vesper marks a user's sleep habit as done on the mornings after a night with the hours the user asked for (7 by default). Only the current week is read, on the device, when the app is open. |

*Vesper marca un hábito como cumplido los días en que Health Connect confirma pasos,
entrenamiento o sueño. Lee solo la semana en curso, en el teléfono, con la app abierta.*

- Sin lectura en segundo plano (`READ_HEALTH_DATA_IN_BACKGROUND`) ni de historial
  (`READ_HEALTH_DATA_HISTORY`): la semana en curso entra en los 30 días que Health Connect
  concede sin ellos.
- La pantalla de justificación (`PermissionsRationaleActivity`) es un diálogo que dice qué
  se lee, que nada se escribe, que nada sale del teléfono y cómo quitar el permiso. Play
  exige además la URL de la política de privacidad en la ficha.

---

## Pendientes antes de enviar

- ~~Pantalla de divulgación destacada antes de `requestAuthorization()` (b).~~ Hecha
  (ADR-0046, ruta `/usage-access`). **Sin caminar en un teléfono**: falta verla una vez en
  Android desde el onboarding y desde "Apps" de un modo.
- `SYSTEM_ALERT_WINDOW` tiene su divulgación escrita en este documento y **sin pantalla
  propia**. No la exige la política de datos del usuario (no lee datos), así que se deja
  fuera a propósito: un cuarto bloque diluiría la que Play sí lee.
- Subir el video y reemplazar `<<VIDEO_URL>>` (a.5).
- Publicar la política de privacidad con los tres tipos de Health Connect (f).
- Verificar en el manifiesto fusionado del build de release que la lista de permisos sea
  la de la tabla de arriba y nada más.
