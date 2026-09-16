# Declaraciones de Google Play — bloqueo en Android

Fase 3 de ADR-0019. Todo lo que hay que pegar en Play Console para publicar el módulo
`vesper-blocking`. Los textos que Play exige en inglés van en inglés, con su traducción
debajo. Lo que declara el manifiesto fusionado del build actual (`android/app/build/…/
merged_manifests`) es la fuente de verdad; este documento no promete nada que no esté ahí.

Lo que el build declara hoy y viene de Vesper:

| Permiso / componente | Quién lo declara | Para qué |
|---|---|---|
| `PACKAGE_USAGE_STATS` | `modules/vesper-blocking` | Saber qué app está al frente durante una sesión |
| `SYSTEM_ALERT_WINDOW` | `modules/vesper-blocking` | El escudo (`TYPE_APPLICATION_OVERLAY`) |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | `modules/vesper-blocking` | `BlockingService`, tipo `specialUse` |
| `POST_NOTIFICATIONS` | `modules/vesper-blocking`, `expo-notifications` | Notificación permanente de sesión; recordatorios de rutina |
| `RECEIVE_BOOT_COMPLETED` | `modules/vesper-blocking`, `expo-notifications` | Rearmar las ventanas de rutina y los recordatorios tras reiniciar |
| `SCHEDULE_EXACT_ALARM` | `modules/vesper-blocking` | Abrir y cerrar las ventanas de rutina al minuto (fase 2) |
| `<queries>` MAIN/LAUNCHER y MAIN/HOME | `modules/vesper-blocking` | Listar apps con lanzador; reconocer el launcher |
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

> Vesper is a self-imposed focus timer. The user picks, per focus mode, which of their installed apps should wait while they focus. When the user starts a session (a deliberate long press on "Hold to focus") or a routine they scheduled opens its window, `BlockingService` starts as a foreground service. While the screen is on it reads `UsageStatsManager.queryEvents` about once per second and, when an app from the user's list comes to the foreground, it shows a full-screen overlay window (`SYSTEM_ALERT_WINDOW`) with the session name and one button, "Volver" (Go back), which returns to the launcher. The service stops when the user ends the session in Vesper or the session's end time passes. It does nothing between sessions. It never reads the content of other apps, never blocks the launcher, Settings, the dialer or system UI, and keeps no history of the apps it sees.

*Vesper es un temporizador de foco autoimpuesto. El usuario elige, por modo, qué apps
instaladas esperan mientras se enfoca. Al iniciar una sesión (una pulsación larga
deliberada en "Mantén para enfocar") o cuando abre la ventana de una rutina que el
usuario programó, `BlockingService` arranca en primer plano. Con la pantalla encendida
lee `UsageStatsManager.queryEvents` una vez por segundo y, cuando una app de la lista
pasa al frente, muestra una ventana superpuesta a pantalla completa con el nombre de la
sesión y un solo botón, "Volver", que lleva al inicio. El servicio se detiene cuando el
usuario termina la sesión en Vesper o vence su hora de fin. Entre sesiones no hace nada.
Nunca lee el contenido de otras apps, nunca bloquea el launcher, Ajustes, el marcador ni
la interfaz del sistema, y no guarda historial de las apps que ve.*

**3. User-facing impact**

> Without a foreground service Android stops the polling within seconds of Vesper leaving the screen, so the focus session would only work while the user is looking at Vesper — that is, never when it matters. With it, the user sees a persistent notification ("Sesión de foco", session name) for the length of the session, and a full-screen reminder the moment they open one of the apps they chose. There is no other user-visible effect.

*Sin servicio en primer plano, Android detiene el sondeo segundos después de que Vesper
salga de pantalla, y la sesión solo funcionaría mientras el usuario mira Vesper, es decir,
nunca cuando importa. Con él, el usuario ve una notificación permanente ("Sesión de
foco", nombre de la sesión) mientras dura la sesión, y un recordatorio a pantalla
completa en cuanto abre una de las apps que eligió. No hay otro efecto visible.*

**4. Why no other foreground service type fits**

> The task is "watch usage events and draw an overlay on the user's request". None of the enumerated types describe it: it is not media playback, media projection, location, camera, microphone, phone call, connected device, remote messaging, health (no Health Connect or sensors are involved in this service), data sync (nothing is transferred) or system exempted (Vesper is not a system app). `shortService` does not fit because a session lasts up to 8 hours (a routine window). `specialUse` is the only remaining type and the subtype property in the manifest states the exact use.

*La tarea es "observar eventos de uso y dibujar una superposición a pedido del usuario".
Ningún tipo enumerado la describe: no es reproducción de medios, proyección, ubicación,
cámara, micrófono, llamada, dispositivo conectado, mensajería remota, salud (este servicio
no toca Health Connect ni sensores), sincronización (no se transfiere nada) ni exención
del sistema. `shortService` no sirve porque una sesión dura hasta 8 horas (una ventana de
rutina). `specialUse` es el único tipo que queda y la propiedad del manifiesto dice el uso
exacto.*

**5. Video link**

> `<<VIDEO_URL>>` — unlisted link to `docs/media/vesper-android-demo.mp4` (0:00 pick the app in the mode, 0:19 hold to start the session, 0:24 the Clock app is opened and shielded, 0:29 "Volver", 0:31 end the session).

*Subir `docs/media/vesper-android-demo.mp4` a YouTube (no listado) o Drive con acceso por
enlace y pegar la URL. Los tiempos de arriba se ajustan al corte final.*

---

## b) Permisos sensibles

### `PACKAGE_USAGE_STATS` (acceso de uso)

- **Formulario en Play:** ninguno. Es un permiso de `appop`; Play lo revisa dentro de la
  política de permisos y de datos del usuario.
- **Cómo se pide:** no hay diálogo. `requestAuthorization()` abre
  `Settings.ACTION_USAGE_ACCESS_SETTINGS` y comprueba al volver. Solo se pide cuando el
  usuario entra a "Apps reales (Tiempo de uso)" dentro de un modo; nunca en el arranque.
- **Divulgación destacada (obligatoria antes de mandar a Ajustes, política de datos del
  usuario):** una pantalla propia, no un `Alert`, con este texto y un solo botón que abre
  Ajustes. Hoy `requestAuthorization()` abre Ajustes directamente: hay que anteponer esta
  pantalla antes de publicar.

  > **Vesper needs Usage access.** During a focus session Vesper checks which app is on screen so it can show the reminder when you open one of the apps you chose. This information is used only for that, is processed on your phone and never leaves it. Vesper keeps no history of the apps you use.

  > **Vesper necesita el acceso de uso.** Durante una sesión de foco, Vesper comprueba qué app está en pantalla para mostrarte el recordatorio cuando abres una de las apps que elegiste. Esa información se usa solo para eso, se procesa en tu teléfono y nunca sale de él. Vesper no guarda historial de las apps que usas.

- **Sin él:** `status()` responde "Falta el acceso de uso" y la pantalla lo dice; el resto
  de la app funciona igual.

### `SYSTEM_ALERT_WINDOW` (mostrar sobre otras apps)

- **Formulario en Play:** ninguno.
- **Cómo se pide:** `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`, desde la misma pantalla
  de "Apps reales", después del acceso de uso. La divulgación en pantalla:

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
| App en primer plano (eventos de uso) | Se lee cada segundo durante una sesión, se compara con la lista y se descarta. Sin historial | No |
| Sesiones, modos, rutinas, hábitos, meta semanal, fecha de nacimiento (opcional) | SQLite local | No |
| Diagnóstico / crashes | No se envía | No |

Si en el futuro se agrega Health Connect (fase 1.5), este formulario cambia: hay que
declarar "Health and fitness" aunque siga siendo local, y llenar la declaración de Health
Connect aparte.

---

## d) Lista de verificación de políticas

- [ ] **Familias / Diseñada para familias:** no. Público objetivo: 18 años o más en
  "Público objetivo y contenido". La app no está dirigida a niños y no es control
  parental: la persona que bloquea es la misma que puede quitar el bloqueo.
- [ ] **Apps de salud:** no aplica en fase 1 (no hay Health Connect ni datos de salud).
  Cuando llegue Health Connect, declaración específica y una semana más de revisión
  (`docs/PLATFORM_ANDROID.md`).
- [ ] **Abuso de dispositivos y redes:** la superposición solo aparece sobre apps que el
  usuario eligió, durante una sesión que el usuario inició; siempre tiene "Volver"; nunca
  cubre el launcher, Ajustes, el marcador ni SystemUI; no modifica ni interfiere con
  otras apps más allá de dibujar encima; no hay bloqueo a nivel de sistema. Documentar
  el límite con honestidad: la app bloqueada abre y el escudo la cubre en menos de un
  segundo; no la impide.
- [ ] **Permisos:** cada permiso corresponde a una función visible, se pide en contexto
  (al entrar a "Apps reales"), y la app funciona si se niega. Sin `QUERY_ALL_PACKAGES`,
  sin accesibilidad. Divulgación destacada antes de mandar a Ajustes (ver b).
- [ ] **Servicios en primer plano:** declaración `specialUse` con texto y video (ver a).
- [ ] **Datos del usuario / Seguridad de datos:** "No recopila ni comparte" (ver c).
- [ ] **Stalkerware / monitoreo:** no aplica. Vesper vigila el propio dispositivo para el
  propio usuario, no reporta a nadie y no se oculta: la notificación permanente dice que
  hay una sesión.
- [ ] **Conducta engañosa:** la ficha dice lo que hace y lo que no (ver
  `docs/STORE_LISTING.md`); nada de "bloqueo imposible de saltar".
- [ ] **Nivel de API objetivo:** el de Expo SDK 57 (Android 15+), cumple el mínimo vigente.
- [ ] **Cuestionario de clasificación de contenido:** utilidad / productividad, sin
  contenido generado por usuarios, sin compras, sin anuncios.
- [ ] **Acceso a la app (App access):** "Todas las funciones están disponibles sin
  cuenta" + las notas del revisor (ver e).

---

## e) Notas para el revisor

Pegar en "App access › Instructions" y en el campo de notas de la declaración del servicio.

> **All functionality is available without an account. How to test the foreground service in 60 seconds:**
> 1. Open Vesper. Grant "Usage access" and "Display over other apps" when the app sends you to Settings (both are asked from a mode's "Apps reales (Tiempo de uso)" screen), or grant them in advance in Settings › Apps › Vesper.
> 2. Focus tab › tap the mode name › "Gestionar modos" › "Editar" › "Apps reales (Tiempo de uso)" › tick any app, for example Clock › "Listo" › "Guardar modo".
> 3. Back on Focus, press and hold "Mantén para enfocar" for 1.5 s. A session starts and a persistent notification "Sesión de foco" appears: that is the foreground service.
> 4. Go Home and open the app you ticked. Within a second a dark full-screen reminder "Vesper · <mode>" covers it, with one button "Volver" that returns to Home.
> 5. Open Vesper › "Terminar" › after one breathing round tap "Terminar · llevas …". The session ends, the notification disappears and the app you ticked opens normally again.
>
> The app never uses AccessibilityService or QUERY_ALL_PACKAGES, makes no network requests and has no account. Deleting everything: Ajustes › "Borrar todo y reiniciar".

*Traducción para uso interno: 1) abrir Vesper y conceder "Acceso de uso" y "Mostrar sobre
otras apps" cuando la app mande a Ajustes (se piden desde "Apps reales" de un modo) o
concederlos antes en Ajustes › Apps › Vesper. 2) Focus › nombre del modo › "Gestionar
modos" › "Editar" › "Apps reales (Tiempo de uso)" › marcar Reloj › "Listo" › "Guardar
modo". 3) Mantener "Mantén para enfocar" 1,5 s: arranca la sesión y aparece la
notificación "Sesión de foco". 4) Ir al inicio y abrir Reloj: en menos de un segundo el
escudo "Vesper · Sin redes" lo cubre, con "Volver". 5) Abrir Vesper › "Terminar" › una
ronda de respiración › "Terminar · llevas …". Sin AccessibilityService, sin
`QUERY_ALL_PACKAGES`, sin red, sin cuenta. Borrar todo: Ajustes › "Borrar todo y reiniciar".*

---

## Pendientes antes de enviar

- Pantalla de divulgación destacada antes de `requestAuthorization()` (b). Hoy no existe.
- Subir el video y reemplazar `<<VIDEO_URL>>` (a.5).
- Verificar en el manifiesto fusionado del build de release que la lista de permisos sea
  la de la tabla de arriba y nada más.
