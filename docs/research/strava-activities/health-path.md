# Actividades de Strava por la capa del sistema: Apple Salud y Health Connect

Informe técnico · 2026-09-29 · sin cambios al repo

> **Nota posterior.** El ADR-0055 acotó la propuesta de §5:
> - Son cuatro clases (cualquier entrenamiento, bici, correr, nadar), no seis.
> - Caminar sigue siendo pasos, y fuerza cae en "cualquier entrenamiento".
> - Las metas pasan a ir de 1 a 6 en hábitos y en retos. Los retos ya ofrecían el 3; faltaban
>   el 1 en los dos y el 3 y el 5 en los hábitos.

Leído contra `CLAUDE.md` (reglas 4, 7, 8 y 9), ADR-0005, 0008, 0017, 0041, 0042, 0043 y 0052,
`src/domain/healthMarks.ts`, `src/domain/habits.ts`, `src/platform/health.ios.ts`,
`src/platform/healthConnectReading.ts`, `src/platform/hooks/useHealthSync.ts` y
`modules/vesper-health/`. El código de terceros se leyó instalado: `node_modules/react-native-health`
1.19.0, el AAR de `androidx.health.connect:connect-client` 1.1.0 de la caché de Gradle y los headers de
HealthKit del SDK de iOS 26.5.

## Resumen

- **Veredicto: sí se puede, y casi todo sin hablar con Strava.** Strava ya escribe en Salud y en
  Health Connect. Garmin, Apple Watch, Samsung, Google Health y otras apps escriben directo.
- "Ejercicio 3 veces por semana" ya funciona hoy: cuenta cualquier entrenamiento de 10 min. "Bici 1 día
  a la semana" no funciona: hoy "bici" cuenta cualquier entrenamiento, y un hábito solo acepta 2, 4 o 6.
- Falta pasar el tipo de entrenamiento desde las dos plataformas y leer la clase del nombre, como la meta
  de pasos (ADR-0042). No hace falta migración, ni servidor, ni permiso nuevo. Son 5,5 a 7 días.
- **Antes de todo hay un bug que ya afecta a los hábitos de hoy:** `getAnchoredWorkouts` descarta sin
  avisar todo entrenamiento sin `metadata` o sin `productType`.
- Esta vía no alcanza el tipo fino de Strava (e-bike, virtual, gravel), las actividades sin GPS de Strava
  en Android, ni a quien no conectó ninguna app a Salud.

## 1. Strava ya escribe en las dos capas

**iPhone.** Según su ayuda, Strava *"will automatically send route information, activity type,
distance, time, and calories to Apple Health"*. Se activa en Strava › Settings › Manage Apps and Devices
› Health › **Send to Health**. La misma página dice que *"route information from activities recorded
with an app from another company (such as Garmin or Zwift) will not sync"*. O sea que lo subido desde un
Garmin, un Wahoo o Zwift sí llega a Salud, pero sin la ruta. En marzo de 2022 Strava cortó ese reenvío
y a los pocos días lo volvió a encender: *"we have decided to turn syncing back on for third party
applications to Apple Health"* (DC Rainmaker).

- **Quién escribe.** La guía de solución de problemas pide abrir Strava y actualizar el feed. Por eso la
  escritura parece salir de la app de Strava en ese teléfono, no de su servidor. Es una inferencia,
  sin confirmar.
- **Si la opción viene encendida por defecto:** sin confirmar. La ayuda solo dice "toggle on".
- **Actividades manuales de Strava:** sin confirmar si llegan a Salud y si llevan la marca de "ingresado
  por el usuario".
- **Qué `HKWorkoutActivityType` usa por deporte:** sin confirmar. No hay tabla pública. HealthKit no
  tiene tipo para e-bike ni para rodillo virtual. Una salida en e-bike solo puede llegar como `Cycling`
  (13) o como `Other` (3000). Hay que mirarlo en un teléfono con una cuenta real antes de prometer "bici".
- **En sentido contrario,** de Salud a Strava solo viajan entrenamientos de la app Entrenamiento de Apple
  de los últimos 30 días. No nos afecta, pero explica los duplicados (§4).

**Android.** Strava *"syncs with Health Connect to send time, distance, and calorie data from GPS-based
activities and to receive weight data"*. Se activa en You › engranaje › Manage Apps and Devices › Health
Connect. Solo menciona actividades con GPS, así que el rodillo, la cinta, una salida virtual de Zwift o el
gimnasio probablemente no llegan a Health Connect por Strava (inferencia, sin confirmar). Tampoco
confirmé desde cuándo existe ni qué `exerciseType` escribe.

## 2. Quién más escribe entrenamientos

| Fuente | Apple Salud | Health Connect |
|---|---|---|
| Apple Watch, app Entrenamiento | Sí, nativo. La app Salud también deja agregar un entrenamiento a mano | — |
| Garmin Connect | Sí: entrenamientos, pasos y sueño, sin GPS | Sí desde junio de 2025. Va solo de Garmin a Health Connect |
| Strava | Sí, con Send to Health, también de lo subido por otras apps | Sí, solo actividades con GPS |
| Samsung Health / Galaxy Watch | — | Sí desde la versión 6.22.5 (oct. 2022): ejercicio, sueño y pulso |
| Google Health (Fitbit, Pixel Watch) | Sí desde agosto de 2026 | Sí: *"Exercise, Exercise route"*, Android 9 o más |
| Wahoo ELEMNT | Sí: sube entrenamientos a *"HealthKit"* | Sin confirmar |
| Zwift | Zwift Companion escribe, con fallas en su foro. Por Strava, sí | Sin confirmar |
| Nike Run Club | Sí: Workouts, distancia y energía (guía de terceros) | Sin confirmar |
| Peloton | Sí: *"Write access will import your Peloton workouts"* | Sin confirmar |
| Google Fit | — | Deja de tener soporte en 2026 (ADR-0043) |

En iPhone, Salud es de verdad el punto de encuentro: quien usa Strava, Garmin o un Apple Watch ya tiene
ahí sus salidas. En Android, Health Connect cubre Garmin, Samsung, Google y Strava con GPS. Los huecos
son apps de nicho en Android y el entrenamiento sin GPS que solo pasa por Strava.

## 3. Qué puede leer el código

### iOS: `react-native-health` 1.19.0

`getAnchoredWorkouts` ya entrega por entrenamiento (`RCTAppleHealthKit+Queries.m:539-553`):
`activityId` (el entero de `HKWorkoutActivityType`), `activityName`, `id`, `calories`, `distance` (en
millas), `duration` (en segundos), `tracked` (falso cuando `HKMetadataKeyWasUserEntered` es 1),
`metadata` (el diccionario, con `HKIndoorWorkout` o `HKTimeZone`), `sourceName`, `sourceId` (el bundle
id de quien escribió), `device`, `workoutEvents`, `start` y `end`. Nuestro `toWorkouts` guarda solo
`start` y `end`. Leer el tipo es un cambio de JS, salvo por el bug de abajo.

- Hay que usar `activityId`, no `activityName`: la tabla de nombres de la librería no conoce
  `SwimBikeRun` (82), `Transition` (83), `UnderwaterDiving` (84), `DiscSports` ni `FitnessGaming`, y
  los devuelve como "Other".
- El predicado usa `HKQueryOptionStrictStartDate`: solo entran entrenamientos que empiezan dentro de la
  ventana. Coincide con la regla de `workoutDays` (el día en que empezó).
- En bridgeless, lo que no es JSON dentro de `metadata` (un `HKQuantity`, una fecha) llega como
  `undefined` (`RCTTurboModule.mm:92-108`). No rompe nada, y los booleanos llegan como booleanos.

**El bug.** La línea 545 arma el diccionario con `@"metadata" : [sample metadata]`. En el SDK de iOS 26.5,
`metadata` es `nullable` (`HKObject.h:48`) y `productType` también (`HKSourceRevision.h:43`, *"may be
nil for older data"*). Un literal de Objective-C con `nil` lanza una excepción. El `@catch` la escribe en
el log y **salta ese entrenamiento**. Upstream lo arregló para `getSamples` en el commit `9c135078`
(2023-01-18, *"Fixed an issue that caused getSamples to discard workouts with no metadata"*), pero no
aquí. La 1.19.0 (2024-10-15) es la última en npm, y `master` sigue igual.

- **Quién escribe sin metadata:** el propio `workout_save` de la librería (`metadata: nil`), y cualquier
  app que guarde así. Si Strava o Garmin lo hacen, sin confirmar.
- **El arreglo** son dos líneas más en `patches/react-native-health+1.19.0.patch` (`?: @{}` y
  `?: @""`). Es nativo: pide build, y el fingerprint cambia porque `patches/` entra en él (ADR-0052).

### Android: `modules/vesper-health`

`ExerciseSessionRecord` en `connect-client` 1.1.0 (leído del AAR instalado) trae `exerciseType`,
`title`, `notes`, `segments` (cada uno con su `segmentType`), `laps`, `startZoneOffset` y `metadata`.
`metadata` trae `dataOrigin.packageName`, `recordingMethod` (0 desconocido, 1 grabado activamente,
2 automático, **3 ingresado a mano**) y `device.type`. Hoy `readWorkouts` (`VesperHealthModule.kt`) solo
pasa `start` y `end`.

- **El cambio:** agregar `exerciseType`, `recordingMethod` y el paquete de origen al mapa. Después,
  ajustar `NativeWorkout` en `index.ts` y `toWorkouts` en `healthConnectReading.ts`. `title` no hace
  falta.
- **Permisos:** ninguno nuevo. Todo viene en el registro que `READ_EXERCISE` ya lee. Solo la ruta pide
  `READ_EXERCISE_ROUTES`, y no la usamos. La declaración de Play no cambia.
- **Nativo:** el Kotlin pide build, y el módulo está en el fingerprint (ADR-0052).
- Desde la 1.1.0-alpha12, quien escribe **tiene que** declarar `recordingMethod`. Los datos viejos
  pueden decir "desconocido".
- Por defecto, Health Connect deja leer 30 días antes del primer permiso. Una semana cabe de sobra.

### Las constantes

| Clase | HealthKit (`HKWorkoutActivityType`) | Health Connect (`EXERCISE_TYPE_*`) |
|---|---|---|
| bici | `Cycling` 13, `HandCycling` 74 | `BIKING` 8, `BIKING_STATIONARY` 9 |
| correr | `Running` 37, `WheelchairRunPace` 71 | `RUNNING` 56, `RUNNING_TREADMILL` 57 |
| caminar y senderismo | `Walking` 52, `Hiking` 24, `WheelchairWalkPace` 70 | `WALKING` 79, `HIKING` 37, `WHEELCHAIR` 82 |
| nadar | `Swimming` 46 | `SWIMMING_POOL` 74, `SWIMMING_OPEN_WATER` 73 |
| fuerza | `TraditionalStrengthTraining` 50, `FunctionalStrengthTraining` 20, `CoreTraining` 59 | `STRENGTH_TRAINING` 70, `WEIGHTLIFTING` 81, `CALISTHENICS` 13 |
| triatlón | `SwimBikeRun` 82 → bici, correr y nadar | No hay tipo; usan segmentos o sesiones sueltas (sin confirmar) |
| cualquiera | Todo lo anterior y además `HighIntensityIntervalTraining` 63, `Yoga` 57, `Pilates` 66, `Elliptical` 16, `Rowing` 35, `MixedCardio` 73, `CrossTraining` 11, `Other` 3000… | Todo lo anterior y además `HIGH_INTENSITY_INTERVAL_TRAINING` 36, `YOGA` 83, `PILATES` 48, `ELLIPTICAL` 25, `ROWING` 53, `ROWING_MACHINE` 54, `EXERCISE_CLASS` 26, `OTHER_WORKOUT` 0… |
| ninguna | `Transition` 83 | — |

Meter la silla de ruedas en caminar y en correr es una decisión de producto. Propongo que sí. Los valores
de HealthKit salen del orden del enum en `HKWorkout.h` (`AmericanFootball` = 1, `SwimBikeRun` = 82,
`Other` = 3000). Los de Health Connect salen de `javap` sobre el AAR.

## 4. Casos de borde

- **Duplicados.** Un Apple Watch y Strava pueden escribir la misma salida. Como las marcas son una por
  día, el día cuenta una vez. Hasta ayuda: si el reloj la guardó como `Other` y Strava como `Cycling`, la
  clase "bici" igual encuentra la suya. Lo único que se duplica es el `durationMs` de la marca, porque
  `workoutDays` suma. Hoy ninguna pantalla lo muestra. Si alguna lo muestra, hay que unir intervalos.
- **Entradas manuales.** En iOS, `tracked` es falso cuando la escritura dice "ingresado por el usuario".
  La app Salud deja agregar un entrenamiento a mano y lo esperado es que lleve esa marca (sin confirmar
  en un teléfono). En Android existe `RECORDING_METHOD_MANUAL_ENTRY`. **Hoy esas entradas marcan un
  hábito verificado**, y ADR-0005 define verificado como algo que *"el usuario no puede inflar"*.
  Propongo excluirlas de toda marca de Salud. Lo que no trae la marca se cuenta: no se puede saber, y el
  producto es espejo, no juez.
- **Duración mínima.** Hoy es de 10 min por entrenamiento (`MIN_WORKOUT_MS`), no la suma del día.
  Propongo lo mismo para toda clase. Si el producto quiere más para caminar, se hace con una tabla por
  clase.
- **Adentro y afuera.** "Bici" incluye rodillo, `BIKING_STATIONARY` y `HKIndoorWorkout`. No propongo
  separar las dos cosas: nadie escribe "bici afuera" en un nombre, y una salida virtual es esfuerzo real.
- **E-bike.** Ninguna de las dos plataformas tiene ese tipo, así que llega como bici. No se puede
  distinguir. Si al producto le importa, la pantalla debe decirlo.
- **Multideporte.** `SwimBikeRun` (desde iOS 16) llega como un solo entrenamiento, porque la librería no
  expone las sub-actividades. Propongo que cuente para bici, correr y nadar.
- **Medianoche.** Cuenta el día en que empezó, que es la regla de hoy. Una salida de 23:30 a 00:45 es
  del día anterior.
- **Zonas horarias.** `dayKeyOf` usa la zona actual del teléfono. Existen `HKMetadataKeyTimeZone` y
  `startZoneOffset`, pero solo importan en un viaje. Por ahora lo dejaría así.
- **Hasta dónde se lee.** Solo se lee la semana en curso, y solo cuando la app vuelve al frente
  (`useHealthSync.ts`, `healthWindow`). Supón que una salida del domingo llega a Salud después de la
  última vez que abriste Vesper ese domingo. El lunes ya no se lee, y ese día se pierde. Con Strava o
  Garmin escribiendo minutos u horas después, es la falla más probable. Propongo leer también la semana
  anterior hasta que se cierre (ADR-0013), o los últimos 8 días. Es un cambio puro en el dominio.

## 5. Diseño propuesto (sin código)

**La clase se lee del nombre**, como la meta de pasos (ADR-0042) y las horas de sueño. ADR-0008 y
ADR-0041 ya decidieron que el hábito se define por su nombre, y descartaron un selector de tipo.

1. **Dominio, puro y con vitest.** `WorkoutKind = 'any' | 'bike' | 'run' | 'walk' | 'swim' |
   'strength'` y `workoutKindFor(name)`, con patrones en los dos idiomas, como `HEALTH_HINTS`. Por
   ejemplo: bici, bicicleta, ciclismo, pedalear, spinning, bike o cycling dan `bike`; correr, trotar,
   run o jog dan `run`; nadar, natación o swim dan `swim`; pesas, fuerza, weights o strength dan
   `strength`; senderismo, caminata o hike dan `walk`. Todo lo demás, incluido "gym", da `any`, y así no
   cambia lo que ya existe.
2. **`HealthWorkout` gana `kinds: WorkoutKind[]` y `userEntered: boolean`.** Las tablas de §3 viven en
   `platform/` como funciones puras con tests, igual que `healthConnectReading.ts`. El dominio solo
   conoce `WorkoutKind`.
3. **`workoutDays` recibe la clase.** Descarta lo que es `userEntered` y exige `kind === 'any'` o que la
   clase esté en `kinds`. `daysFor` llama a `workoutKindFor(habit.name)`, como ya hace con
   `stepGoalFor`. Los ids `hm-<hábito>-<día>` no cambian.
4. **`HEALTH_HINTS`.** "Caminar" sigue siendo pasos (ADR-0042). Que "senderismo" y "hike" pasen de pasos
   a entrenamiento cambia hábitos que ya existen, así que se decide en el ADR.
5. **iOS.** `toWorkouts` lee `activityId` y `tracked`, y el parche arregla el `nil`.
6. **Android.** El Kotlin pasa `exerciseType` y `recordingMethod`. Luego se ajustan los tipos de
   `index.ts` y `toWorkouts` en `healthConnectReading.ts`.
7. **Qué guarda el hábito: nada nuevo.** `health_type` sigue siendo `'workout'` y no hace falta
   migración 014. La alternativa sería una columna `workout_kind` en `habits` y en `challenges` (la 014
   local más un `alter table` en el servidor), el campo en `/sync` y un selector en el editor. Eso choca
   con la alternativa que ADR-0041 descartó y suma unos 2 días.
8. **Retos.** El nombre ya lleva la clase. Todos leen el mismo nombre, así que todos cuentan la misma
   clase: es el argumento de ADR-0042 §1. El servidor no cambia. El círculo sigue viendo días, nunca
   tipos ni minutos (regla 11). Unirse pide Salud como hoy.
9. **La línea bajo el nombre.** El editor y "Nuevo reto" dicen lo que se leyó: "Cuenta los días con una
   salida en bici de 10 min o más". En Ajustes › Salud, una línea: "¿Usas Strava? Activa Enviar a Salud
   en Strava". Todo en `src/i18n/es` y `src/i18n/en`.
10. **Metas.** "1 día a la semana" hoy no se puede elegir. Un hábito ofrece 2, 4 o 6
    (`HABIT_TARGET_OPTIONS`) y un reto de 2 a 6 (`CHALLENGE_TARGET_OPTIONS`). Agregar 1 y 3 no toca el
    esquema, porque `weekly_target` es un entero. Pero es una decisión de producto: `docs/SPRINT_01.md`
    dejó fuera el valor libre.

| Parte | Días |
|---|---|
| Dominio: clases, `workoutKindFor`, filtro, entradas manuales fuera, ventana de 8 días, tests | 1,5 a 2 |
| iOS: `toWorkouts` y el parche del `nil` | 0,5 |
| Android: Kotlin, tipos, `healthConnectReading` y tests | 1 |
| UI: la línea de clase, los strings y la línea de Strava en Ajustes | 1 |
| ADR, `STATUS.md` y PRD | 0,5 |
| Verificar en teléfonos reales con Strava, Garmin y un Apple Watch | 1 a 2 |
| **Total** | **5,5 a 7** (más 0,5 si se agregan metas de 1 y 3) |

Hay cambio nativo en las dos plataformas, así que sale con build de tienda y no por el aire (ADR-0052).
Nada nuevo sale del teléfono (regla 7) y no se pide ningún permiso nuevo (regla 8).

## 6. Veredicto frente a la API de Strava

| | Capa del sistema | API de Strava |
|---|---|---|
| A quién cubre | A quien graba con Strava, Garmin, Apple Watch, Samsung, Google… | Solo a quien usa Strava |
| Servidor | Ninguno | OAuth con secreto, renovación de tokens y webhooks: backend con ADR (regla 7) |
| Permiso | El de Salud que ya pedimos | Cuenta de Strava y una hoja de OAuth más |
| Tipo fino | `Cycling` o `BIKING` | `sport_type`: `EBikeRide`, `VirtualRide`, `GravelRide`, `MountainBikeRide`… |
| Manual | Una marca opcional de quien escribe | El campo `manual` |
| Android sin GPS | No llega por Strava | Llega |
| Esfuerzo | 5,5 a 7 días | Ver el informe hermano |

**Qué no puede hacer esta vía:**

- **Quien graba solo en un Garmin que sincroniza con Strava.** En iPhone le llega por dos caminos: Garmin
  Connect escribe directo en Salud, y Strava reenvía si Send to Health está encendido. En Android, Garmin
  escribe en Health Connect desde junio de 2025. Solo queda fuera quien no activó ninguno de los dos
  enlaces, y la pantalla puede decirle cómo hacerlo.
- **Quien sube a Strava desde la web y no tiene Strava en el teléfono.** Sin confirmar: parece que quien
  escribe en Salud es la app.
- Distinguir e-bike, virtual, gravel o montaña.
- En Android, lo que Strava graba sin GPS.

**Recomendación.** Arreglar ya el bug de `metadata`, porque hoy pierde entrenamientos. Después, hacer
esta vía primero: responde "ejercicio N veces" y "bici 1 día" para casi todos, sin backend. Además, la
API de Strava igual necesitaría las clases y la lectura del nombre. Dejaría la API para cuando haya
usuarios de Android que entrenan adentro con Strava, o cuando el producto quiera separar la e-bike.

## Fuentes

- Strava, Apple Health and Strava: https://support.strava.com/en-us/articles/15402024-apple-health-and-strava
- Strava, Health Connect and Strava: https://support.strava.com/en-us/articles/15401554-health-connect-and-strava
- DC Rainmaker, el corte de 2022: https://www.dcrainmaker.com/2022/03/strava-abruptly-health.html
- DC Rainmaker, la reversa: https://www.dcrainmaker.com/2022/03/strava-reverses-course-turns-back-on-apple-health-sync-functionality.html
- Strava API, `SportType` y `manual`: https://developers.strava.com/docs/reference/
- Apple, agregar un entrenamiento a mano en Salud: https://support.apple.com/en-us/101952
- Apple, apps de entrenamiento de terceros en Fitness: https://support.apple.com/guide/iphone/sync-a-third-party-workout-app-iph392b962da/ios
- Garmin, Sharing Your Garmin Connect Data With Apple Health: https://support.garmin.com/en-US/?faq=lK5FPB9iPF5PXFkIpFlFPA
  (Cloudflare bloqueó la lectura directa; el contenido se tomó de guías que la citan, como https://www.sonarhealth.co/blog/sync-garmin-with-apple-health/)
- Garmin, Sharing Your Garmin Connect Data With Health Connect: https://support.garmin.com/en-US/?faq=JToBEy0jfe6pIygark2Ui5
- the5krunner, Garmin y Health Connect (actualizado 2026-04-11): https://the5krunner.com/2025/05/22/garmin-connect-and-strava-runna-new-link-to-goolge-health-connect/
- Gadgets & Wearables, fecha de junio de 2025: https://gadgetsandwearables.com/2025/05/22/garmin-health-connect-sync/
- Samsung, Health Connect: https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect y https://developer.samsung.com/health/health-connect-faq.html
- Google Health y Health Connect: https://support.google.com/fitbit/answer/14506680?hl=en
- Google Health escribe en Apple Salud (2026-08-03): https://9to5mac.com/2026/08/03/google-health-adds-two-way-apple-health-syncing-on-iphone/
- Wahoo ELEMNT Companion (ficha en la App Store): https://apps.apple.com/us/app/wahoo-elemnt-companion/id1049469683
- Zwift Companion y Salud (foro): https://forums.zwift.com/t/zwift-companion-activity-not-syncing-to-apple-health/372082
- Nike Run Club y Salud (guía de terceros): https://evernorth.zendesk.com/hc/en-us/articles/20751488886427-How-to-connect-Nike-Run-Club-to-Apple-Health
- Peloton y Salud (actualizado 2026-03-12): https://www.onepeloton.com/blog/wearables-integration
- Android, metadata y `recordingMethod`: https://developer.android.com/health-and-fitness/health-connect/metadata
- Android, lectura de 30 días e historial: https://developer.android.com/health-and-fitness/health-connect/read-data
- react-native-health, el commit que arregló `getSamples`: https://github.com/agencyenterprise/react-native-health/commit/9c135078755a42f1488e6aa8571dd4b79aca7d6b
- react-native-health en npm (1.19.0 es la última): https://www.npmjs.com/package/react-native-health
- Leído en local: `RCTAppleHealthKit+Queries.m`, `RCTAppleHealthKit+Utils.m` y `+Methods_Workout.m`
  (1.19.0); `HKWorkout.h`, `HKObject.h`, `HKSourceRevision.h` y `HKMetadata.h` (SDK de iOS 26.5);
  `connect-client-1.1.0.aar` (`ExerciseSessionRecord`, `Metadata`, `Device` y `ExerciseSegment`, con
  `javap`); `RCTTurboModule.mm` (React Native 0.86)
