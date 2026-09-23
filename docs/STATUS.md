# Estado — 2026-09-17

Qué existe, dónde se verificó y qué falta. Se actualiza al cerrar cada tanda de trabajo.
El plan por fases está en `ROADMAP.md`; las tareas del primer prototipo, históricas, en
`SPRINT_01.md`.

## Resumen en una línea

**La app está completa en código y corre en el simulador de iOS y en el emulador de
Android.** Nada se ha probado en un teléfono físico. Lo que bloquea el bloqueo en iOS
no es código: es el entitlement de Family Controls, que lo pide el dueño de la cuenta.

Verificado hoy, en este árbol: `npx tsc --noEmit` limpio, `npm run lint` sin errores ni
avisos y `npx vitest run` con **871 tests en 63 archivos**, todos en verde; el módulo
Kotlin compila con Gradle.

## Estado actual

| Capacidad | iOS | Android | Verificado dónde |
|---|---|---|---|
| Persistencia (SQLite, migraciones 001–006, demo sembrado una vez, "Borrar todo y reiniciar") | real | real | Simulador y emulador: relanzar con sesión viva la rehidrata; reset deja la base como nueva |
| Sesión: reloj split-flap, modo horizontal, arte de foco (`?art=1`) | real | real | Simulador (capturas a mitad de giro, rotación por script, arte a 25/50/75/100 %). Sin medir el trazado de 6.000 puntos en un teléfono |
| Botón de Focus: toque arranca, mantener solo en profundo, `InkFlood` (ADR-0022) | real | real | Simulador iPhone 17 con `idb`, capturas a mitad del gesto. Sin verificar "Reducir movimiento" ni el ritmo a ojo en teléfono |
| Arranque: splash de tinta lisa y `BootReveal` que la disuelve hasta la marca (ADR-0028) | real | real | Simulador iPhone 17 Pro (dev client nuevo, video a 30 fps): splash negro liso, disolución de los bordes al centro, marca sola, fade a Focus; con "Reducir movimiento" la tinta salta a la marca y solo queda el fade. Emulador Pixel 7 API 36 con `-gpu host`, build de Release, tres arranques en frío iguales; el dev client de Android no sirve para juzgarlo (su lanzador oculta el splash). Sin teléfono físico |
| Sesión sin límite (tope 12 h) y pausas de 15 min cada 25 min de foco | real | real | Simulador: sin límite desde la hoja, pausa a claro y vuelta con reloj congelado, relanzar en frío a mitad de sesión |
| Salida consciente: respirar con el dedo, papel sobre tinta, `session/closed`, emergencia como ruta (ADR-0025) | real | real | Simulador con `idb`: ritual suave y firme, emergencia a los 7 s, gastada y sin gastar. Sin verificar "Reducir movimiento", la ruta de emergencia sin desbloqueos, ni el ritmo en teléfono |
| `SessionGate`: relanzar cae en la sesión, cierra al vencer, termina la pausa | real | real | Simulador: relanzar en frío a los 11 min de 25 abrió en la sesión. Android: `useBlockBack` bloquea atrás en `session/*` (sin captura) |
| Motor de rutinas: arranca la sesión de la ventana, espera si hay una, nunca dos veces; rutinas sin hora | real | real | Simulador: a las 16:16 de un miércoles "Trabajo" arrancó sola con "Trabajo profundo" |
| Notificaciones locales (fin de sesión, fin de pausa, rutinas, cierre semanal; se replanifican al cambiar idioma) | real | real | Simulador iPhone 17: el aviso de rutina "Empieza Lectures · Modo Deep work. Toca para empezar la sesión." salió en la pantalla bloqueada y abrir la app cayó en la sesión. Sin verificar el fin de pausa en segundo plano ni nada en Android |
| Live Activity: banner, isla (cinco regiones), relojes nativos, pausa en papel (ADR-0023) | real | no aplica | Simulador iPhone 17 Pro: banner contando con la app fuera, isla compacta y expandida en foco y pausa, tocar abre la sesión. Sin verificar sesión sin límite en la isla (solo tests) |
| Salud: entrenamientos, pasos y sueño marcan hábitos verificados | real (`react-native-health`, con parche) | no existe (`status()` lo dice; sin Health Connect) | Simulador iPhone 17 Pro: "Conectar Salud" abre la hoja de permisos del sistema y queda "Salud conectada · última lectura"; sin datos que leer |
| Bloqueo durante la sesión | integrado (`react-native-device-activity`); **imposible sin el entitlement de Apple** | real (`modules/vesper-blocking`: servicio `specialUse`, escudo superpuesto) | iOS: solo compila; las tres extensiones se generan en `targets/`. Android: emulador Pixel 6 (API 34) por adb: escudo sobre Ajustes y Reloj, baja con "Volver" |
| Ventanas de rutina con la app cerrada | `DeviceActivity` por día (sin verificar) | `AlarmManager` exactas o con 10 min de holgura, `BootReceiver` | Android: ventana abierta con el proceso muerto, cierre al minuto, alarmas de vuelta tras `adb reboot`, servicio revivido tras `kill -9`. iOS: aritmética con tests, nada en dispositivo |
| Pausa con el bloqueo (`pausePlan`/`resumePlan`) | `release()` + `applyPlan()` (sin verificar) | del servicio, sin JS | Android: notificación en pausa, reanudación al segundo tras `kill -9`, escudo subiendo sobre Ajustes |
| Escudo | tinta de la sesión, botón "Cerrar" (`openApp` no funciona desde la extensión) | superposición oscura, "Volver", "Se libera a las 11:26" | iOS: solo compila. Android: capturas en el emulador |
| Notificación de Android como pantalla bloqueada: cronómetro nativo, canal `vesper_session`, pública, abre `vesper://session/active` | no aplica | real | Emulador: panel, pantalla bloqueada con PIN, pausa contando. Emulador Pixel 7 API 36: cuenta regresiva y hacia arriba, `requestPromotedOngoing=true` en `dumpsys`, pero el sistema no promovió la notificación (sin chip) |
| Reglas "modo estricto", "bloquear instalaciones", "bloquear compras" | solo UI (la librería no expone esas claves) | solo UI (sin equivalente) | El pie de "Mis reglas" lo dice. Solo el filtro de contenido adulto llega al sistema, y solo en iOS |
| Idioma español e inglés, override en Ajustes (ADR-0020) | real | real | `tsc` (una clave que falte no compila) y tests en los dos idiomas; cambio en caliente verificado en las pantallas del círculo |
| Círculo: personas, semana sin posiciones, ánimo, retos, invitación por código, link y QR (ADR-0021) | UI y base local; **sin backend** (`platform/circle.status()` lo dice) | igual | Simulador con `idb`: flujo completo; QR leído por Vision desde la captura; `vesper://circle/join?code=…` con `simctl openurl`. Sin verificar: "Salir del círculo", "Quitar", los topes de 12 y 5 desde la UI, la línea de ánimo en el cierre, la cámara de un iPhone real |
| Declaraciones de Play y ficha (`PLAY_DECLARATIONS.md`, `STORE_LISTING.md`, `docs/media/`) | — | escritas | Falta la pantalla de divulgación destacada y subir el video |
| La llave: otra persona abre y cierra la sesión con un código que rota (ADR-0035) | código completo, **sin probar en dispositivo** (falta dev client con cámara) | igual | Sin cámara no hay verificación real. Lo que sí está verificado sin dispositivo: el código dibujado como campo de puntos **se decodifica** —Vision, el mismo motor de la cámara del iPhone, leyó el código rotatorio y el de emparejamiento desde PNG, y sigue leyéndolos con puntos al 50 % y a 3 px por módulo—, y la derivación HMAC contra FIPS 180-4 y RFC 4231. Sin verificar en Android: el lector de ML Kit, que es menos tolerante que Vision |

**Nada se ha verificado en un teléfono real de ningún fabricante.** Todo lo de arriba se
probó en el simulador iPhone 17 / 17 Pro y en el emulador Pixel 6 (API 34).

## Cómo probar

### Simulador de iOS

```sh
npx expo prebuild --platform ios --clean   # tras cambiar plugins o el widget
npx expo run:ios --device "iPhone 17 Pro"
npx expo start --dev-client                # el ciclo normal después del primer build
```

- Sin tocar la pantalla: `idb` para toques y mantener, `xcrun simctl openurl booted
  vesper://circle/join?code=…` para deep links, `xcrun simctl io booted screenshot`.
- Rutas con parámetro para revisar: `/session/active?art=1` (arte de foco),
  `/(tabs)/activity?view=lifetime` (o `month`).
- Con una cuenta gratuita de Apple: `VESPER_FREE_TEAM=1 npx expo prebuild --platform ios
  --clean` deja fuera widgets y Screen Time (`app.config.js`) y todo lo demás corre en
  el teléfono.
- Recargar el JS con la app abierta puede tumbar op-sqlite (`ResultPropNames`, SIGSEGV);
  relanzar en frío no. Ver "Deuda conocida".

### Banderas de desarrollo (`src/dev/route.ts`)

Todas vuelven a `null` / `false` antes de commitear. Solo actúan en `__DEV__`.

| Bandera | Qué hace |
|---|---|
| `DEV_START_ROUTE = '/modes'` | Salta a esa ruta al arrancar |
| `DEV_SESSION = 'running' \| 'completed'` | Arranca una sesión falsa antes (o la arranca y cierra) para las pantallas de sesión |
| `DEV_SKIP_ONBOARDING = true` | Marca el onboarding hecho en una instalación limpia |
| `DEV_CIRCLE_PROFILE = true` | Crea un perfil del círculo si no hay, para `circle/*` |
| `DEV_BLOCK_TEST = 'com.android.settings'` | Android: a los 2 s aplica un plan `block` con ese paquete |
| `DEV_WINDOW_TEST = 'com.google.android.deskclock'` | Android: a los 2,5 s registra una ventana que abre a los 2 min y dura 3 |

### Emulador de Android

```sh
export ANDROID_HOME=$HOME/Library/Android/sdk
npx expo prebuild --platform android --clean
npx expo run:android --device Pixel_6_API_34     # nombre del AVD, no el id de adb
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081   # cada vez que arranca
adb shell appops set com.gusplayer.vesper GET_USAGE_STATS allow
adb shell appops set com.gusplayer.vesper SYSTEM_ALERT_WINDOW allow
adb shell appops set com.gusplayer.vesper SCHEDULE_EXACT_ALARM allow
adb shell pm grant com.gusplayer.vesper android.permission.POST_NOTIFICATIONS
adb logcat -s VesperBlocking
```

Las recetas completas (matar el proceso sin `force-stop`, reiniciar, pausar con el
proceso muerto) están en `PLATFORM_ANDROID.md`. **`am force-stop` y "Forzar detención"
cancelan las alarmas**: no sirven para probar ventanas.

**Un solo agente por dispositivo a la vez.** Dos sesiones sobre el mismo simulador o
emulador se pisan las banderas, las capturas y, en Android, las alarmas.

### En tu iPhone

1. Pide a Apple el entitlement de Family Controls (Distribution) para
   `com.gusplayer.vesper` y sus tres extensiones `.ActivityMonitorExtension`,
   `.ShieldAction`, `.ShieldConfiguration`. Tarda semanas; todo lo demás no lo necesita.
2. Conecta el iPhone y corre `npx expo run:ios --device` eligiendo tu teléfono. Firma con
   el team `2D3R79CT8F` (`app.json`). Con cuenta gratuita, la firma dura siete días y
   hace falta `VESPER_FREE_TEAM=1`.
3. En el teléfono: onboarding → permitir notificaciones y Salud → crear un modo → iniciar
   sesión. Deberías ver la Live Activity en la pantalla bloqueada y la notificación al
   terminar.
4. `Ajustes › Borrar todo y reiniciar` deja la base como recién instalada.

## Qué falta

- **Entitlement de Family Controls** (distribución) en el portal de Apple, y con él
  probar en un iPhone real: escudo en sesión, ventanas de rutina, pausa que baja y sube
  el escudo.
- **Teléfonos reales**: notificaciones, Salud, Live Activity y el ritmo de las
  animaciones en iOS; bloqueo, alarmas inexactas y optimización de batería (Samsung,
  Xiaomi) en Android. Anotar aquí qué se vio.
- **Play**: pantalla de divulgación destacada antes de pedir el acceso de uso; subir el
  video y poner la URL en `PLAY_DECLARATIONS.md`; verificar el manifiesto fusionado del
  build de release.
- **Android 16**: el emulador API 36 no promueve la notificación aunque la pide; verificar en un Pixel real con Android 16.
- **Toque en la notificación de Android** y en el aviso de rutina de iOS: no se pueden
  entregar desde adb/idb; confirmar en teléfono.
- Persistir la duración elegida en la hoja de sesión (`usePlannedStore` vive en memoria).
- La intención de la sesión persiste, pero solo se lee en el cierre.
- ADR-0024 (sonido y vibración) sigue en propuesta, sin implementar.
- El cierre del domingo no tendrá pantalla (ADR-0026): es el aviso más Actividad › Semanal.

## Deuda conocida

- `react-native-health` lleva un parche en `patches/` con dos partes: `setBridge:` no
  existe en RN 0.86, y su `index.js` copiaba con `Object.assign` un módulo que bajo la
  New Architecture llega vacío (los métodos viven en el prototipo), así que Salud decía
  "este build no incluye Salud" aunque el pod estaba enlazado. Ojo: con Xcode 16 el
  ejecutable `Vesper.app/Vesper` es un stub; el código está en `Vesper.debug.dylib`.
- El SIGSEGV de op-sqlite al recargar el JS (`ResultPropNames`) era su issue #446,
  resuelto en 18.2.0; el proyecto usa 18.2.3 y sobrevive a la recarga. Un dev client
  compilado antes del 2026-09-17 sigue cayendo: hay que recompilarlo.
- `t.depth.label` está en minúscula; `DepthCards` capitaliza localmente.
- `ios/` y `android/` no se versionan; se regeneran con `npx expo prebuild --clean` tras
  cambiar plugins o el widget. `targets/`, `modules/` y `patches/` sí se versionan. Un
  `ios/` viejo puede no traer `ExpoWidgetsTarget`: `--clean` lo arregla.
- Los restos de la fase 1 (`repositories/sessionConfig.ts`, `queries/week.ts`, cinco
  claves viejas de `settings`) se borraron en la revisión del 2026-09-17 (ADR-0026).
- Círculo sin servidor: escribir un código ajeno responde "todavía no hay servidor"; solo
  la invitación sembrada (Mateo) se puede aceptar. Es lo honesto hasta el backend (ADR-0021).
- Sin textos legales: Acerca de no tiene Términos ni Privacidad hasta que existan.

## Historial

Una entrada por tanda, con su fecha y su ADR. Los detalles de cada una viven en el ADR y
en los documentos de plataforma.

- **2026-09 · Fase 1 e-ink (ADR-0001 a 0015).** Tres pantallas, swipe, libro mayor,
  hábitos, meta semanal, vida, SQLite con migraciones, recuperación de huérfanas. Corrió
  en simulador y emulador. Superada en forma por ADR-0016; `SPRINT_01.md` es su registro.
- **2026-09-15 · Pivote a Brick (ADR-0016).** Cuatro pestañas, modos, horarios,
  Actividad (semanal, mensual, de por vida), Ajustes, onboarding, sesión en oscuro. El
  sistema de diseño de `src/design/`, escrito a mano.
- **2026-09-15 · Capacidades reales (ADR-0017).** `src/platform/` con `status()` por
  capacidad; migración 002; notificaciones con plan determinista; Salud con función pura;
  Live Activity; bloqueo de iOS integrado sin poder verificarse.
- **2026-09-15 · Reloj split-flap y modo horizontal.** `FlipClock`, 340 ms sin rebote;
  girar el teléfono en sesión muestra solo el reloj (`expo-screen-orientation`).
- **2026-09-15 · Arte de foco (ADR-0018).** Cinco obras puntillistas (pagoda, Eiffel,
  Libertad, rostro, perro) que se dibujan con el reloj; visor `scripts/artPreview.ts`.
- **2026-09-15 · Idioma (ADR-0020).** `src/i18n/es` y `en`, `Strings = typeof es`,
  `expo-localization` solo en `device.ts`; los datos de demo se siembran en el idioma
  del teléfono y no cambian.
- **2026-09-15/16 · Círculo (ADR-0021).** Migración 004, cinco tablas, perfil y
  preferencias en `settings`, `platform/circle` sin backend, invitación por código, link
  y QR (`src/lib/qr.ts`, sin librería).
- **2026-09-16 · Rutinas y Android (ADR-0019).** Motor puro de rutinas, rutinas sin
  hora (migración 003), Focus con la próxima rutina; `modules/vesper-blocking` fase 1
  (selector, servicio, escudo), fase 2 (alarmas, reinicio) y fase 3 (declaraciones de
  Play, ficha, video). Ventanas de rutina en iOS con `DeviceActivity`.
- **2026-09-16 · Focus y `SessionGate`.** Focus dice solo hoy; la sesión es de verdad una
  ruta sin salida: relanzar cae en ella, vence aunque su pantalla no esté montada;
  `useBlockBack` en Android.
- **2026-09-16/17 · Botón de Focus, sin límite y pausas (ADR-0022).** Toque arranca,
  mantener solo en profundo, hoja con "Sin límite", tope 12 h, pausas de 15 min cada 25
  de foco, migración 005, `settle` para lo que pasó con la app dormida, `InkFlood` y
  `HoldButton` con disolución punteada (`src/lib/dissolve.ts`).
- **2026-09-17 · Superficies fuera de la app (ADR-0023).** Relojes nativos en la Live
  Activity y en la notificación de Android; pausa en papel; escudo de iOS con tinta y
  "Cerrar"; canal `vesper_session`; `pausePlan`/`resumePlan`; `PlanTiming` con `open`.
- **2026-09-17 · Salir de la sesión (ADR-0025).** `BreathingObject` que respira con el
  dedo (4-4-6), papel sobre tinta, `session/closed`, `session/emergency` como ruta;
  `EmergencySheet` desapareció; profundo con caption y sin pill apagado.
- **2026-09-17 · Revisión de QA y documentación (ADR-0026).** Cierre de los ADR 0011,
  0012, 0013, 0015 y las cifras de 0022; restos de la fase 1 borrados; todos los docs
  contrastados con el código.

## Racha diaria, avisos que traen de vuelta y empujones (2026-09-17, ADR-0027)

El dueño del producto reafirmó, tras las objeciones, que quiere que la app se use más:
racha, recordatorios y retos con avisos. Queda hecho en local; lo social espera el backend.

- **Racha diaria** (`domain/streak.ts`): un día cuenta con 10 minutos de foco en sesión.
  **Tres días de gracia por mes** (`grace_days`, migración 007) que se aplican solos al
  abrir la app si hay una racha que proteger y el mes tiene presupuesto; si el hueco es
  más largo que la gracia, no se gasta ninguno. Se ve en Focus bajo la píldora ("5 días
  seguidos · 3 de gracia") y en Actividad › De por vida (sección "Racha"). Sin fuego, sin
  animación; la meta semanal sigue siendo la métrica y su pie ya no dice "sin rachas".
- **Silencio en sesión**: con una sesión corriendo o en pausa, el plan de avisos solo
  contiene fin de sesión y fin de pausa; rutinas, cierre semanal y avisos diarios se
  cancelan al arrancar y vuelven al cerrar (`domain/reminders.ts`).
- **Avisos nuevos**, todos con interruptor en Ajustes › Notificaciones › "Cada día" y a
  la hora elegida (8:00 a 21:00, 20:00 por defecto): racha en riesgo (hoy y mañana, si la
  racha tiene 2 días o más y hoy no cuenta), día sin foco (si la racha es menor), y volver
  a los 3 y 7 días sin abrir la app (`lastOpenedAt`). Máximo dos al día fuera de sesión y
  rutina, nada entre 22:00 y 8:00. El interruptor "Empujones" existe pero la entrega
  necesita servidor.
- **Retos**: duración 1, 2, 4 semanas, **21 días** (por defecto) o **sin límite**
  (`challenges.end_day_key`, null = sin fin). **Empujón**: chip "Empujar" bajo cada
  participante que no marcó hoy, una vez al día por persona (`nudges`), y la línea "Ana te
  empujó hoy." con datos de demostración.
- Verificado en el simulador iPhone 17 Pro con base recién sembrada: la línea de racha en
  Focus, la sección en Actividad, Ajustes › Notificaciones con los tres grupos y la hoja de
  hora (20:00 → 19:00), el reto "Read · 21 días · quedan 18", "Ana te empujó hoy", "Empujar"
  → "Empujado" en Ana, y los chips de duración en el reto nuevo. `tsc` limpio, 784 tests en
  56 archivos.
- No verificado: ningún aviso llegó (el simulador no tiene permiso); el plan se cubre con
  tests. Tampoco la gracia aplicándose a un día real (cubierto por tests), ni nada en un
  teléfono.
- Enmiendas: regla 11 y "Qué NO hacer" en `CLAUDE.md`, PRD ("Meta semanal y racha diaria
  con gracia"), ADR-0021 principio 2. Deuda: el chip "Empujar" sin seleccionar no se
  distingue del fondo de la tarjeta, igual que el chip "Dar ánimo" que ya existía.
- **2026-09-20 · La rutina que propone el onboarding sigue a la idea.** `ModeIdea` gana
  `schedule` y `activityId`: cada una de las cinco ideas trae su ventana (Dormir 22:00
  abierta todos los días, Trabajo y Sin redes 9:00–18:00 de lunes a viernes, Familia
  19:00–21:00 y Calma 20:00–21:00 todos los días) y la actividad a la que cuenta su
  tiempo. `setGoal` recibe la idea entera y copia su horario al borrador; `commit.ts` lee
  `idea.activityId` en vez de comparar contra `'idea-family'`, y Modos › Ideas hace lo
  mismo al crear un modo. Antes las cinco abrían la pantalla en 21:00, lunes a viernes.
- Verificado en el simulador iPhone 17 Pro con `idb`, recorriendo el onboarding dos veces:
  "Dormir" abre "Starts 22:00 · Ends Until you end it · Every day" y "Trabajo" abre
  "9:00 – 18:00 · Weekdays", y la tarjeta de previsualización dice "Work · routine ·
  9:00 – 18:00 · Weekdays". `tsc` limpio, `eslint` sin avisos, la suite en verde con
  ocho tests nuevos (cuatro en `seed.test.ts`, cuatro en `onboardingDraft.test.ts`).
- No verificado: la actividad de un modo creado desde Modos › Ideas (no se ve en pantalla;
  la cubre `seed.test.ts`), y nada en un teléfono.
- **2026-09-22 · "descanso" es una actividad.** Resuelve la deuda de la entrada anterior:
  Dormir y Calma ya no cuentan su tiempo como "trabajo". Séptima actividad por defecto
  (`descanso` / `rest`), sin migración: `activities.seedDefaults` corre en cada arranque
  con `INSERT OR IGNORE`, así que llega también a una base ya sembrada. Las ideas Dormir
  y Calma apuntan a `REST_ACTIVITY_ID`; Familia sigue en `familia` y las otras dos en
  `trabajo`.
- Verificado contra la base real del simulador iPhone 17 Pro, que ya estaba sembrada desde
  el 17 de septiembre: tras un arranque, `sqlite3` sobre `Library/vesper.db` muestra las
  seis actividades viejas intactas con su fecha original y `descanso|rest` creada en ese
  arranque. `tsc` limpio, `eslint` sin avisos, la suite en verde.
- No verificado: cómo se ve "descanso" en los selectores de actividad (la base del
  simulador tenía una sesión abierta y salir de ella pide el ritual completo).

- **2026-09-21 · El reto dice cómo vas, avisa cuando se te está yendo y se ve desde
  Focus (ADR-0031).** `challengeOutlook` y `challengeWeeks` en `domain/circle.ts` dan el
  estado de la semana (`met`, `onTrack`, `tight`, `atRisk`, `missed`) y las semanas que
  el reto lleva corridas; `data/challenges.ts` los reduce a lo que leen el planificador
  y las pantallas. `domain/reminders.ts` gana dos avisos locales, `challengeRisk`
  (a la hora del recordatorio, solo cuando el reto ya solo sale marcando todos los días
  que quedan, uno al día, el más apretado) y `challengeEnd` (el día después del último,
  con cuántas semanas cumpliste), los dos dentro del presupuesto de dos del ADR-0027 y
  con interruptor propio (`prefs.challenges`) en Ajustes › Notificaciones. La pantalla
  del reto abre con la semana dibujada (misma `HeatGrid`, hoy respirando) y la línea con
  verbo; un reto terminado muestra cómo fue y ofrece "Repetir" o "Archivar", que es lo
  primero que llama a `archiveChallenge`. El reto se asoma en Hábitos ("Reto con Ana y
  Luis"), en Actividad › Semanal (una fila por reto activo) y en Focus (una línea bajo la
  racha y la fila de siete puntos bajo la grilla). "Nuevo reto" propone cinco retos
  nuestros.
- Verificado en el simulador iPhone 17 Pro con `idb` (Metro en :8082, el :8081 lo tenía
  otro proyecto): Focus muestra "Read · you need 4 more · 7 days left" con la fila de
  puntos vacía, el reto abre con su semana y "0 of 4", "Mark today" llena el lunes y todo
  pasa en el mismo toque a "1 of 4 · You need 3 more · 7 days left", y Focus vuelve con la
  línea y el punto actualizados. `tsc`, `eslint` y `vitest` en verde sobre el índice
  aislado de esta tanda, sin el trabajo sin commitear de las otras dos.
- No verificado: ningún aviso de reto llegó a la bandeja (el simulador no tiene permiso;
  el plan se cubre con tests), el cierre de un reto terminado y "Repetir" (la siembra no
  trae un reto vencido), y nada en un teléfono.
- Pendiente de decisión: ADR-0032 (retos públicos) está en propuesta y depende del ADR del
  backend. Deuda heredada: el chip "Empujar" sin seleccionar sigue sin distinguirse del
  fondo de la tarjeta.

- **2026-09-22 · El servidor del círculo existe y corre (ADR-0033).** `server/` es un
  paquete aparte (Hono sobre Node, Postgres con `pg`, fuera del bundle de Expo por
  `metro.config.js`) con la forma que el ADR-0021 dejó escrita: la cuenta es un id que
  elige el teléfono más un secreto que el servidor entrega una sola vez y guarda
  hasheado, los alias son únicos, y `POST /sync` sube lo que el llamante posee y baja lo
  que cambió en su círculo desde un cursor. Cada escritura se fuerza al llamante: una
  semana es suya, una marca es suya, el ánimo y el empujón salen de él, y lo que no
  cumple vuelve en `rejected`. El empujón sale por Expo push y respeta el interruptor de
  quien lo recibe; el presupuesto, las horas de silencio y el silencio en sesión siguen
  siendo del teléfono (ADR-0027). `DELETE /account` borra la cuenta y sus filas.
- Verificado: `tsc` y `vitest` del servidor en verde (16 tests sobre las reglas de dueño
  y de cursor), y el flujo completo corriendo de verdad contra `localhost:8787` con
  curl: dos cuentas, código redimido, aceptación, semana de Ana visible para Gus, reto
  creado, marca de Ana viajando, marca de un desconocido rechazada y empujón entregado.
  La app sigue igual de verde (`tsc`, `eslint`, 824 tests) y su bundle compila sin nada
  de `server/` adentro.
- No verificado: nada contra un Postgres real (el `PgStore` solo está cubierto por el
  esquema y por tipos; los tests corren sobre la tienda en memoria), ningún push real de
  Expo, y la app todavía **no habla con el servidor**: `platform/circle.ts` sigue
  diciendo que no hay conexión. Ese cliente es la siguiente tanda.
- Pendiente de decisión: desplegar en Railway + Neon (cuesta dinero y usa las cuentas del
  dueño), y el ADR-0032, que depende de que esto esté desplegado.

- **2026-09-23 · La llave (ADR-0035, y el ADR-0036 para la web).** Una sesión que abre y
  cierra otra persona escaneando un código que rota cada 30 s, derivado de un secreto
  compartido al emparejar y verificado sin red. Migraciones 008 y 009, `domain/key.ts`,
  `lib/sha256.ts` y `lib/dotMatrix.ts` a mano, `platform/camera.ts` y `platform/keyStore.ts`,
  el componente `KeyPattern`, cinco pantallas y el recibo en `session/closed`. El ADR-0021
  decía que no habría cámara ni escáner; el 0034 lo reemplaza en ese punto.
- Tres agentes revisaron el trabajo y encontraron cosas que ya están arregladas: el código
  de emparejamiento con un id UUID medía 106 bytes contra un codificador que topa en 84, y
  la pantalla reventaba al dibujarlo (ahora el id son 12 hex); adelantar el reloj cerraba
  la sesión sola (una sesión con llave ya no tiene temporizador: la termina la llave, el
  tope de 12 h o la emergencia); atrasarlo dejaba replicar para siempre una foto del código
  (cada llave guarda la ventana más nueva aceptada); el teléfono bloqueado dibujaba el
  código de la llave que lo bloquea (`paired_keys.role`); dos códigos seguidos abrían y
  cerraban en el mismo minuto (mínimo de dos minutos); y la pantalla de sesión seguía
  diciendo "solo el timer termina" a quien solo podía salir con la llave.
- De paso se arregló una deuda del ADR-0025 que la llave vuelve crítica: el desbloqueo de
  emergencia **nunca se recargaba**. Eran cinco por instalación, para siempre, mientras
  Ajustes decía "al mes". Ahora `domain/emergency.ts` recarga al cambiar el mes.
- No verificado: **nada en un dispositivo**. La cámara no existe en el simulador y el dev
  client nuevo no se pudo compilar por falta de espacio en disco (3 GB libres). Tampoco se
  verificó el lector de Android, ni la protección contra captura de pantalla en las dos
  pantallas que muestran un código, que está pendiente y anotada en el ADR.
