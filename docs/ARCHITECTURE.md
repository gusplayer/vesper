# Arquitectura — Vesper

Cómo está armada la app hoy (ADR-0016 en adelante). Los ADR anteriores describen la
fase 1 e-ink, cuyo dominio y base de datos siguen vivos debajo de esto.

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Runtime | Expo SDK 57 + dev client | Módulos nativos: SQLite, notificaciones, Salud, widgets, Screen Time, bloqueo Android (ADR-0001, ADR-0017) |
| Lenguaje | TypeScript 6 estricto | `strict: true`, `noUnusedLocals`, sin `any` |
| Navegación | expo-router | Un `Stack` raíz con dos guardas (onboarding / app), cuatro pestañas de texto (`expo-router/js-tabs` con `TabBar` propio) y rutas a pantalla completa para la sesión |
| Persistencia | op-sqlite | Síncrono, sin ORM. Migraciones `001`–`011` en TypeScript |
| Ids | UUID v7 propio sobre `expo-crypto` | 20 líneas. Evita `uuid` + `react-native-get-random-values` |
| Estado | Zustand | Tres stores que cachean SQLite (`app`, `focus`, `circle`), el idioma, y borradores efímeros (modo, onboarding, duración) |
| Texto | Dos diccionarios tipados (`src/i18n/es`, `en`) | Sin librería de i18n (ADR-0020) |
| Notificaciones | expo-notifications | Plan determinista en `domain/reminders`, diff contra el SO |
| Salud | react-native-health (solo iOS, con parche) | Lectura de entrenamientos, pasos y sueño. Sin Health Connect |
| Live Activity | expo-widgets + @expo/ui | `src/widgets/FocusActivity.tsx`, relojes nativos (ADR-0023) |
| Bloqueo iOS | react-native-device-activity | Sin verificar: falta el entitlement de Family Controls |
| Bloqueo Android | módulo Expo local en Kotlin, `modules/vesper-blocking/` | Sin AccessibilityService (ADR-0019) |
| Gráficos | `View` y `react-native-svg` | Barras, grillas, QR y arte de foco a mano |

Sin backend. Sin cuenta de usuario. Sin sync. El círculo (ADR-0021) tiene sus tablas y
`platform/circle.status()` dice que no hay servidor.

## Estructura

```
src/
  app/                    expo-router. Todo archivo aquí es una ruta
    _layout.tsx           boot de la DB, fuentes, ThemeProvider, DevJump, PlatformEffects,
                          SessionGate, Stack con guardas
    (tabs)/               index (Focus), schedules (Rutinas), activity, settings
    session/              active, exit, emergency, closed, complete. Sin gesto de volver
    modes/                index, edit, apps, websites, ideas
    schedules/edit.tsx
    habits/               new, edit
    settings/             rules, emergency, notifications, live-activities, health, life,
                          language, help, about, circle
    circle/               index, invite, join, challenge, challenge-new
    onboarding/           welcome → goal → apps → screen-time → health → routine →
                          routine-set → notifications → tour
  features/<área>/        piezas compartidas por varias pantallas de un área, y sus
                          funciones puras con tests (activity, circle, habits, health, home,
                          modes, onboarding, schedules, session, settings)
  design/
    tokens.ts             color, font, space, radius, layout, shadow, motion
    theme.tsx             useSchemeStore, ThemeProvider, ForcedTheme, useTheme, useStyles
    navigation.ts         opciones del Stack: fade de 160 ms, rutas bloqueadas
    shieldPalette.ts      los tokens convertidos para el escudo de iOS
    useReduceMotion.ts
    components/           51 componentes exportados por index.ts, más tres internos
  data/
    index.ts              los hooks que usan las pantallas. Único punto de entrada
    stores/               app.ts (modos, rutinas, ajustes, hábitos, marcas, stats por día),
                          focus.ts (la sesión en curso), circle.ts
    seed.ts, circleSeed.ts  datos de demostración y catálogos (apps, sitios, ideas)
    modeDraft.ts, onboardingDraft.ts, modes.ts   borradores y la duración elegida
    types.ts              tipos de la superficie de producto (Mode, Schedule, Settings…)
  domain/                 puro: sin React, sin DB, sin plataforma
    types.ts              tipos de dominio, fuente de verdad (mirror de DATA_MODEL.md)
    session.ts            crear, cerrar, expirar, asentar; pausas; sesión sin límite
    routines.ts           ventanas, próxima rutina, decisión start/wait/none
    routineWindows.ts     rutinas → specs de ventana → intervalos del sistema
    blocking.ts           BlockPlan a partir de un modo y las reglas; copy del escudo
    reminders.ts          qué notificaciones deben existir ahora
    healthMarks.ts        semana de Salud → marcas verificadas
    exitRitual.ts         respiración 4-4-6, rondas por profundidad
    circle.ts             semana del círculo, retos, código de invitación
    key.ts                la llave: código rotatorio, código dictado, emparejamiento
    dictation.ts          el alfabeto que se lee en voz alta, compartido con el círculo
    emergency.ts          el presupuesto mensual del desbloqueo de emergencia
    ledger.ts, week.ts, habits.ts, day.ts, life.ts, lifeExpectancy.ts, time.ts
    art/                  motor puntillista y las cinco obras
    fixtures.ts           fábricas para los tests. Ningún código de app la importa
  lib/                    presentación y utilidades con React o nativo
    format.ts, tone.ts, text.ts, birthDate.ts, uuid.ts, random.ts
    dissolve.ts           las disoluciones punteadas (InkFlood, HoldButton)
    qr.ts                 codificador QR a mano, versiones 1–5
    dotMatrix.ts          la misma matriz dibujada como campo de puntos (ADR-0035)
    sha256.ts             SHA-256 y HMAC a mano, para derivar el código de la llave
    useNow.ts, useBlockBack.ts, useOrientation.ts, useRevision.ts
  db/
    client.ts             instancia de op-sqlite, pragmas y runner de migraciones
    boot.ts               abre, migra, siembra, recupera huérfanas; resolveActivityId; reset
    sql.ts                helpers de texto SQL, puros
    migrations/           001_init … 011_unshared_metrics, en TypeScript
    repositories/         toda escritura pasa por acá: activities, habits, sessions,
                          settings, modes, schedules, circle, keys
    queries/              modelos de lectura: dayStats (stats por día desde sessions)
    testing/fakeDb.ts     handle falso para los tests de repositorios y queries
  i18n/
    es/, en/              un archivo por área; Strings = typeof es
    index.ts              useStrings, getStrings, useLocale, stringsFor
    store.ts, locale.ts, device.ts   preferencia, resolución pura, expo-localization
  platform/               una capa por capacidad; cada una expone status()
    capabilities.ts       isIos, isAndroid, isDevice, CapabilityStatus
    notifications.ts, health.ts, liveActivity.ts (+ liveActivityProps.ts),
    blocking.ios.ts, blocking.android.ts (+ blockingTypes.ts, androidApps.ts,
    BlockingSelectionView.tsx, routineWindows.ts), orientation.ts, circle.ts,
    camera.ts (+ CameraScanner.tsx), keyStore.ts (el secreto de la llave, en el llavero)
    hooks/                useNotificationSync, useHealthSync, useLiveActivitySync,
                          useBlockingSync, useRoutineSync, useRoutineWindowsSync
    PlatformEffects.tsx   monta los seis hooks una vez, bajo el layout raíz
  widgets/FocusActivity.tsx   la Live Activity; no importa nada de la app
  dev/                    route.ts (banderas) y DevJump.tsx. Solo en __DEV__
modules/vesper-blocking/  módulo Expo local (Kotlin): servicio, vigilante, escudo, alarmas
targets/                  ActivityMonitorExtension, ShieldAction, ShieldConfiguration (iOS)
patches/                  react-native-health+1.19.0.patch
scripts/artPreview.ts     visor de las obras de arte de foco
```

`ios/` y `android/` no se versionan: `npx expo prebuild --clean` los regenera.

## Reglas de capas

```
app/ features/  →  data/index.ts (hooks)  →  data/stores/  →  db/repositories/  →  db/client
      ↓                                            ↓                  ↓
design/components                              domain/            domain/
      ↓
design/tokens (solo aquí)

platform/hooks/  →(subscribe)→  data/stores/        platform/*  →  módulos nativos
i18n/            ←  todos menos domain/ (que recibe el diccionario por parámetro)
```

- **Los componentes no ejecutan SQL.** Todo pasa por un repositorio, y las pantallas ni
  siquiera ven los repositorios: hablan con `src/data/index.ts`.
- **Los stores de `src/data/` son una caché de la base, nunca la fuente.** Cada acción
  escribe por su repositorio antes de tocar el estado; `hydrate()` los rellena al
  arrancar y tras "Borrar todo y reiniciar". Las estadísticas por día no se guardan: se
  derivan de `sessions` (`db/queries/dayStats.ts`).
- **`domain/` es puro.** Sin React, sin DB, sin plataforma, sin `i18n/index.ts`. Recibe
  datos, devuelve datos; cuando produce texto recibe la rebanada del diccionario por
  parámetro. No genera ids: el que llama pasa el id.
- **La plataforma se suscribe a los stores, nunca al revés** (ADR-0017). Cada módulo de
  `src/platform/` expone `status(): { available, reason }` y funciones que no hacen nada
  cuando no está disponible. Los módulos nativos se cargan con `require` dentro de
  `try/catch`, una sola vez. Ninguna pantalla importa un módulo nativo.
- **`i18n/` tiene toda palabra que ve el usuario** (ADR-0020). Pantallas: `useStrings()`.
  Stores y plataforma: `getStrings()` en el momento de la llamada, nunca cacheado.
  `Strings = typeof es` y `en` lo implementa, así que una clave que falte no compila.
- **`design/components` no conoce el dominio.** Recibe props primitivas. Los tokens se
  importan solo en `src/design/`; una pantalla que necesite uno delata un componente
  que falta.
- **Fechas en epoch ms.** La única excepción son las claves de día y semana
  (`habit_marks.day_key`, `member_weeks.week_key`…), justificadas en `DATA_MODEL.md`.

## Arranque

`app/_layout.tsx` llama `bootAndHydrate(now)` de forma síncrona dentro de un `useState`:
abre la base, corre las migraciones pendientes, siembra las actividades por defecto,
cierra huérfanas (`sessions.recoverOrphans`), siembra los datos de demostración si
`demo_seeded_at` no existe (en el idioma del teléfono), e hidrata los stores de idioma,
app, foco y círculo. Si algo falla, `FatalError` es la única pantalla. Nada renderiza
hasta que Outfit está cargada.

Luego el `Stack` con dos guardas: `onboarding` mientras `settings.onboardingDone` es
falso; `(tabs)` y el resto después. `DevJump` (solo dev) y `PlatformEffects` se montan
una vez; `SessionGate` también.

## Flujo de una sesión

```
usuario toca "Enfocarme 25 min" (o mantiene, si el modo es profundo)
  → InkFlood inunda la página de tinta desde el botón (lib/dissolve, motion.floodMs)
  → useFocusStore.start(modeId, plannedMs | null, now)
      → domain/session.createSession(uuidv7(now), config, now)   [puro]
      → db/repositories/sessions.insert(fila)                    [blockProfile = id del modo]
      → useSchemeStore.setScheme('dark')
  → router → /session/active
  → useBlockingSync ve la sesión y aplica el plan (domain/blocking.blockPlan) con PlanTiming
  → useLiveActivitySync arranca la actividad; useNotificationSync planifica el fin
  → lib/useNow entrega `now` cada segundo; el reloj es now - startedAt - pausas
```

Salidas (ADR-0025):

- **Vence el tiempo**: `SessionGate` cierra la sesión como `completed` (o `expired` si era
  sin límite y llegó al tope) esté o no montada su pantalla, y navega a
  `session/complete`.
- **Terminar** abre `session/exit`: respiración con el dedo (`domain/exitRitual`), una
  ronda en suave y dos más la frase en firme; confirmar corre el papel (`InkFlood
  tone="paper"`) y abre `session/closed`. Profundo no tiene esta salida.
- **Emergencia** (`session/emergency`): 10 s de espera, gasta uno de los cinco del mes
  (`settings.emergencyLeft`), termina en `session/closed`.
- **Pausa** (ADR-0022): `takeBreak` escribe `break_started_at`, el tema vuelve a claro,
  el bloqueo se levanta (`pausePlan`); `resume` a mano o `SessionGate` a los 15 min la
  cierra y el bloqueo vuelve (`resumePlan`).

Cerrar una sesión (`finish`) escribe la fila por el repositorio, deja `lastClosed` en el
store, vuelve el tema a claro y pide a `useAppStore.recordFocus` que rederive las stats.

El timer **nunca** se calcula sumando ticks: es `now - startedAt - breakMs - (pausa en
curso)`, para que sobreviva a que la app se vaya a background.

## Estado de la app en background y muerte del proceso

No hay `backgroundedAt`. Al volver al frente solo hace falta un `now` fresco:

- `lib/useNow` refresca `now` cuando `AppState` pasa a `active`.
- `SessionGate` programa el instante exacto del fin (o del fin de la pausa) con un
  `setTimeout` y vuelve a mirar el reloj en cada `active`, porque los timers duermen en
  segundo plano.
- En `firme` y `profundo`, salir de la app cuenta como interrupción (`interruptions`).
  No cancela la sesión.

Si el sistema mata la app, la sesión queda `running` en la DB. Al arrancar,
`sessions.recoverOrphans(now)` asienta cada sesión `running` con `domain/session.settle`:
una pausa que pasó sus 15 minutos termina en su fin, y una sesión cuyo
`started_at + planned_ms + break_ms` ya pasó se cierra en ese instante, no en `now`,
con su veredicto: `completed` si tenía duración elegida, `expired` solo si era sin límite
y tocó el tope de 12 h. `SessionGate` llama al mismo `settle` (`focus.settleNow`) al
volver al frente, así boot y primer plano nunca discrepan (ADR-0026). Una sesión todavía dentro de su ventana no se toca: el store la hidrata en
el mismo paso del boot (no en un efecto, para no renderizar Focus un frame antes de la
sesión) y `SessionGate` lleva la app a `/session/active`.

`expired` se distingue de `cancelled`: el usuario no se rindió, la sesión sin límite
simplemente llegó a su tope. En el libro mayor cuenta como tiempo invertido; en las
métricas de abandono, no.

## Rutinas

`domain/routines.ts` decide desde el reloj qué ventana está abierta (incluida la que
cruza la medianoche), cuál viene, y una decisión por tic: `start`, `wait` (hay una sesión
corriendo) o `none`. `useRoutineSync` la ejecuta cada 30 s, al volver al frente y cuando
termina una sesión; lo que arrancó queda en `settings.lastRoutineStart` para que una
ventana nunca arranque dos veces. Una rutina sin hora (`startMinutes` nulo) se arranca a
mano desde Rutinas y dura `durationMs`.

Fuera de la app la rutina la llevan dos cosas: el aviso de `expo-notifications` ("Empieza
X · Modo Y. Toca para empezar la sesión.": la sesión se crea al abrir la app, no antes,
porque el motor corre en JS) y, donde hay bloqueo, la ventana en el sistema
(`useRoutineWindowsSync` → `domain/routineWindows` → `scheduleWindow`): `DeviceActivity`
en iOS, `AlarmManager` en Android. Detalle en `PLATFORM_IOS.md` y `PLATFORM_ANDROID.md`.

## Bloqueo

`domain/blocking.blockPlan(mode, rules)` produce un `BlockPlan` (`block` | `allow` |
`none`, el token del modo y las tres reglas). `useBlockingSync` lo aplica al empezar la
sesión con un `PlanTiming` (`startedAt`, `endsAt`, `open`), lo libera al terminar, y
llama `pausePlan`/`resumePlan` en las pausas. Los dos backends exportan los mismos
nombres (`src/platform/blocking.ios.ts`, `blocking.android.ts`) y el hook no sabe cuál
responde. El token de selección (`Mode.selectionToken`) es opaco en iOS
(`FamilyActivitySelection`) y un JSON de nombres de paquete en Android
(`domain/packageSelection`); nunca se resuelve a nombres en iOS (ADR-0004).

## Notificaciones

`domain/reminders.plannedNotifications(state, strings)` devuelve la lista completa y
determinista de avisos que deberían existir ahora (fin de sesión, fin de pausa, una por
rutina y día, cierre semanal), con ids estables. `useNotificationSync` la recalcula en
cada cambio de store (con 300 ms de espera) y `platform/notifications.syncScheduled`
hace el diff contra lo que el SO ya tiene. Nunca "agrega una": el plan es una función
del estado.

## Cálculo del libro mayor

`domain/ledger.ts` recibe:

```ts
type LedgerInput = {
  dayStart: number;
  dayEnd: number;
  now: number;                     // acota el renglón `sin registrar`
  activities: Activity[];          // para etiquetar; el ledger no resuelve ids solo
  sessions: Session[];
  healthSamples: HealthSample[];   // vacío hoy: Salud marca hábitos, no renglones
  usageEstimateMs: number;         // el estimado de demo (data/seed USAGE)
}
```

Y devuelve renglones con su procedencia (`verified` | `declared` | `estimated` | `unknown`).
Cada renglón lleva una clave estable para la UI, con espacio de nombres para que una
actividad del usuario llamada `unknown` o `sleep` nunca choque: `activity:<key>`,
`health:<type>`, `usage`, `unknown`. Lo muestra `features/activity/TodaySection` en
Actividad › De por vida.

El renglón `sin registrar` es la parte del día transcurrido que **ningún intervalo cubre**:

```ts
const to = Math.min(now, dayEnd);
Math.max(0, (to - dayStart) - medidaDeLaUnion(sesiones ∪ muestras))
```

No es una suma: es el complemento de una unión de intervalos (ADR-0010). Tres detalles
que importan. **No es `86400000`**: en el día de cambio de horario el día local dura 23h
o 25h. **Se acota con `now`**: si no, a las 10:00 con 2h registradas reportaría 22h sin
registrar. **Y el estimado queda fuera de la resta**: no tiene intervalos y ADR-0004
prohíbe presentarlo como cifra exacta.

El intervalo de una sesión es `[startedAt, startedAt + served(session, now)]`, no
`[startedAt, endedAt]`. `served` es la única definición de "cuánto cuenta una sesión", y
la usan el libro mayor y la meta semanal.

## Testing

- **vitest sobre `src/**/*.test.ts`**: `domain/`, `lib/`, `db/` (con `testing/fakeDb.ts`,
  sin módulo nativo), `data/` (seed), `i18n/` (resolución de idioma), y las funciones
  puras de `features/` y `platform/` (`liveActivityProps`, `routineWindows`). Cobertura
  objetivo 80 % de líneas y funciones sobre `domain/`, `lib/`, `db/` y `data/seed.ts`;
  `npx vitest run --coverage` la mide (`vitest.config.mts`).
- Toda función que produce texto se prueba en `es` y en `en`.
- La zona horaria está fijada a `America/Bogota`; `TZ_OVERRIDE` permite una segunda
  corrida en una zona con horario de verano.
- `tsconfig.json` lleva `noUnusedLocals` y `noUnusedParameters`: código muerto es error
  de typecheck. Una clave de i18n que falte en un idioma también.
- **Migraciones, seed, recuperación de huérfanas, stores, pantallas, componentes y
  plataforma** se verifican corriendo la app. `app/_layout.tsx` loguea en dev cuántas
  actividades hay, cuántas huérfanas cerró y si sembró el demo. `docs/STATUS.md` dice
  qué se vio y dónde.

## Qué no está en la arquitectura y es a propósito

- La app no tiene capa de API ni red. El servidor del círculo (ADR-0033) vive en
  `server/`, fuera del bundle por `metro.config.js`, y todavía ningún archivo de `src/`
  lo llama: `platform/circle.status()` sigue diciendo que nada viaja.
- No hay sistema de eventos ni event bus: la plataforma se suscribe a los stores.
- No hay inyección de dependencias. Los repositorios se importan directo.
- No hay librería de i18n, de gráficos ni de animación. El QR se **codifica** a mano (`src/lib/qr.ts`); desde el ADR-0035 se **decodifica** con el lector nativo de `expo-camera`, que es la mitad que no se puede dibujar con `View` y SVG.
- No hay tests de UI.
- No quedan restos de la fase 1: `repositories/sessionConfig.ts`, `queries/week.ts` y las
  claves viejas de `settings` se borraron (ADR-0026).
