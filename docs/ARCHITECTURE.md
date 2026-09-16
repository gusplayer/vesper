# Arquitectura — Vesper

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Runtime | Expo SDK + dev client | Módulos nativos obligatorios en fase 2 (ADR-0001) |
| Lenguaje | TypeScript estricto | `strict: true`, sin `any` |
| Navegación | expo-router + react-native-pager-view | 6 rutas de `Stack` y un pager de dos páginas. Ver ADR-0009 |
| Persistencia | op-sqlite | Rápido, síncrono, sin ORM |
| Ids | UUID v7 propio sobre `expo-crypto` | 20 líneas. Evita `uuid` + `react-native-get-random-values` |
| Estado UI | Zustand | Solo estado efímero. La verdad vive en SQLite |
| Salud | react-native-health (iOS) / react-native-health-connect (Android) | Fase 1.5 |
| Bloqueo | react-native-device-activity (iOS) / módulo propio (Android) | Fase 2 |

Sin backend en fase 1. Sin cuenta de usuario. Sin sync.

Las seis rutas son `index` (host del pager: inicio + vida), `session` y cuatro de
configuración: `config/session`, `config/habit`, `config/week`, `config/habit-edit`.
Las de configuración son rutas con fade de 120ms, no modales nativos: un modal sube
deslizándose y el lenguaje visual no lo permite.

## Estructura

```
src/
  app/                    expo-router. Todo archivo aquí es una ruta
    _layout.tsx           Stack de 6 rutas, fuentes, boot de la DB, log de dev
    index.tsx             host del pager: inicio + vida
    session.tsx           sesión activa, sin swipe ni gesto de volver
    config/
      session.tsx         configuración de sesión
      habit.tsx           crear hábito
      week.tsx            meta semanal y cierre del domingo (ADR-0013)
      habit-edit.tsx      editar o archivar un hábito
  screens/                páginas del pager. No son rutas, por eso no viven en app/
    Home.tsx
    Life.tsx
  design/
    tokens.ts             color, font, space, radius, rule, layout
    navigation.ts         opciones del Stack: fade 120ms, fondo papel
    components/           23 componentes escritos a mano
  domain/                 puro: sin React, sin DB
    types.ts              tipos de dominio, fuente de verdad
    time.ts               SECOND, MINUTE, HOUR, DAY, WEEK
    activities.ts         clave de una actividad a partir de su nombre
    session.ts            crear, cerrar, expirar, interrumpir; config validada
    day.ts                límites del día local, day_key, inicio de semana
    week.ts               meta semanal y ventana de la semana
    habits.ts             progreso semanal de hábitos, pistas de salud por nombre
    life.ts               semanas vividas, restantes, filas de la cuadrícula
    ledger.ts             libro mayor del día
    fixtures.ts           fábricas para los tests. Ningún código de app la importa
  lib/                    capa de presentación y utilidades con React o nativo
    format.ts             cómo se lee un número: timer, duración, fecha, meta
    tone.ts               qué tan fuerte habla un renglón
    text.ts               reglas sobre texto tecleado: vacío, dígitos, minutos
    birthDate.ts          'aaaa-mm-dd' ↔ epoch ms
    uuid.ts               UUID v7 sobre expo-crypto
    useNow.ts             reloj de 1 s que se refresca al volver a foreground
    useRevision.ts        contador que dice "la DB cambió debajo tuyo"
  db/
    client.ts             instancia de op-sqlite, pragmas y runner de migraciones
    sql.ts                helpers de texto SQL, puros y testeables
    boot.ts               abre, migra, siembra y recupera huérfanas
    migrations/           001_init.ts, 002_... en TypeScript, no .sql
    repositories/         toda escritura pasa por acá
      activities.ts
      habits.ts           hábitos y sus marcas
      sessions.ts
      settings.ts
      sessionConfig.ts    la última configuración de sesión, en settings
    queries/              modelos de lectura: componen repositorios para una pantalla
      week.ts             la semana: foco contra la meta, cada hábito contra la suya
  store/
    session.ts            la sesión en curso, caché de una fila de SQLite
  health/                 fase 1.5, no existe todavía
  blocking/               fase 2, no existe todavía
```

Las migraciones son `.ts` y no `.sql` porque Metro no empaqueta `.sql` sin configurar
el resolver, y mantener las dos cosas sería tener dos fuentes de verdad del esquema.
Una migración publicada no se edita: se agrega la siguiente.

`db/queries/` es la capa nueva. Una query compone repositorios en lo que una pantalla
necesita para renderizar, así la pantalla hace una pregunta en vez de cinco. Las queries
**nunca escriben**. `queries/week.ts` la comparten inicio y la ruta de la meta, que antes
tenían dos copias a mano del mismo cálculo.

## Reglas de capas

```
app/ screens/  →  db/queries/  →  db/repositories/  →  db/client
      ↓               ↓                 ↓
   lib/            domain/           domain/
      ↓
design/components
```

- **Los componentes no ejecutan SQL.** Nunca. Todo pasa por un repositorio.
- **`domain/` es puro.** Sin imports de React, sin imports de la base de datos.
  Recibe datos, devuelve datos. No genera ids: el que llama pasa el id.
- **`i18n/` tiene toda palabra que ve el usuario**, en español y en inglés, un archivo por
  área; `Strings = typeof es` y `en` lo implementa (ADR-0020). Las pantallas leen
  `useStrings()`; los stores y `platform/`, `getStrings()`. El dominio habla en
  identificadores (`soft`, `verified`) y, cuando produce texto, recibe la rebanada del
  diccionario por parámetro: nunca importa `i18n/index.ts` ni el store. `lib/format.ts`
  y `lib/tone.ts` siguen siendo la capa de presentación, ya sin español dentro.
- **`design/components` no conoce el dominio.** Recibe props primitivas.
  `<LedgerRow label="gym" value="hecho" />`, no `<LedgerRow habit={habit} />`.
- **Los tokens no se importan en `app/` ni en `screens/`.** Solo en `design/`. Si una
  pantalla necesita un token, falta un componente.
- **Las pantallas leen SQLite de forma síncrona dentro de `useMemo`** y vuelven a leer
  cuando una revisión (`lib/useRevision`) sube. Una escritura solo tiene que subir la
  revisión; no hay caché ni suscripción a la DB.

## Flujo de una sesión

```
usuario toca "empezar"
  → store/session.start(config, now)
  → domain/session.createSession(uuidv7(now), config, now)  [puro; el id viene de lib/uuid]
  → db/repositories/sessions.insert(session)
  → navega a /session
  → lib/useNow entrega `now` cada 1 s; el store no tiene reloj
  → la intención se escribe en la ruta de sesión: store.setIntention(texto)
  → al terminar o rendirse:
      domain/session.close(session, now, outcome)  [puro]
      db/repositories/sessions.update(...)
```

`SessionConfig` son cuatro campos —`activityId`, `plannedMs`, `depth`, `blockProfile`—
y no incluye la intención: se escribe en la sesión, donde también se muestra.

El timer **nunca** se calcula sumando ticks. Se calcula como `now - startedAt`,
para que sobreviva a que la app se vaya a background.

## Estado de la app en background

No hay `backgroundedAt` ni nada parecido. El timer es `now - startedAt`, así que lo único
que hace falta al volver es un `now` fresco:

- `lib/useNow` refresca `now` cuando el `AppState` pasa a `active`, para que el reloj
  no muestre un tick congelado.
- Si el tiempo venció mientras la ruta de sesión estaba montada, la ruta cierra la
  sesión como `completed` con `actualMs = plannedMs` y **se queda** en el estado de
  cierre (ADR-0015).
- Si la sesión venció mientras nadie la miraba —se hidrató tras un relanzamiento y el
  usuario se quedó en inicio— `Home` llama a `store.expireUnwatched()`, que la cierra
  como `expired`. Es el mismo veredicto que una huérfana en el arranque: nadie presenció
  ese foco.
- En nivel `firme` y `profundo`, salir de la app cuenta como interrupción
  y se incrementa `interruptions`. No cancela la sesión.

## Muerte del proceso

Background no es lo mismo que muerte del proceso. Si el sistema mata la app —o el usuario la
cierra desde el multitarea— la sesión queda `running` en la DB y nadie la cierra.

Al arrancar, antes de renderizar la primera pantalla, `sessions.recoverOrphans(now)` cierra
como `expired` las sesiones `running` **cuyo tiempo planeado ya venció**, usando
`domain/session.expire()`: la fila termina en `startedAt + plannedMs`, no en `now`.

Una sesión que todavía está dentro de su ventana no se toca: el timer es `now - startedAt`,
así que sobrevive a que el proceso muera. Volver a abrir la app a los dos minutos de una
sesión de 25 debe continuarla, no anularla. El store la hidrata en el mismo paso del boot
—no en un efecto, para no renderizar `empezar` un frame antes de `seguir`— y la sesión sigue.

`expired` existe precisamente para esto y se distingue de `cancelled`: el usuario no se rindió,
solo no sabemos qué pasó. Tampoco es `completed`, que afirmaría un foco que nadie presenció.
En el libro mayor cuenta como tiempo invertido; en las métricas de abandono, no.

## Cálculo del libro mayor

`domain/ledger.ts` recibe:

```ts
type LedgerInput = {
  dayStart: number;
  dayEnd: number;
  now: number;                     // acota el renglón `sin registrar`
  activities: Activity[];          // para etiquetar; el ledger no resuelve ids solo
  sessions: Session[];
  healthSamples: HealthSample[];   // vacío en fase 1
  usageEstimateMs: number;         // 0 en fase 1
}
```

Y devuelve renglones con su procedencia (`verified` | `declared` | `estimated` | `unknown`).
Cada renglón lleva una clave estable para la UI, con espacio de nombres para que una
actividad del usuario llamada `unknown` o `sleep` nunca choque: `activity:<key>`,
`health:<type>`, `usage`, `unknown`.

El renglón `sin registrar` es la parte del día transcurrido que **ningún intervalo cubre**:

```ts
const to = Math.min(now, dayEnd);
Math.max(0, (to - dayStart) - medidaDeLaUnion(sesiones ∪ muestras))
```

No es una suma: es el complemento de una unión de intervalos. Esa distinción es la que hace
que la regla 9 se cumpla literalmente y que un entrenamiento verificado dentro de una sesión
declarada ocupe el reloj una sola vez. Ver ADR-0010.

Tres detalles que importan. **No es `86400000`**: en el día de cambio de horario el día local
dura 23h o 25h. **Se acota con `now`**: si no, a las 10:00 con 2h registradas reportaría 22h
sin registrar, contando el futuro como tiempo perdido. **Y el estimado queda fuera de la
resta**: no tiene intervalos y ADR-0004 prohíbe presentarlo como cifra exacta, así que no
puede entrar en una partición exacta.

El intervalo de una sesión es `[startedAt, startedAt + served(session, now)]`, no
`[startedAt, endedAt]`: una sesión cerrada al volver de background tiene `endedAt` más allá
de su fin planeado y nunca recibe crédito por tiempo que no sirvió. `served` es la única
definición de "cuánto cuenta una sesión", y la usan el libro mayor y la meta semanal.

## Testing

- **`domain/`, `lib/`, `db/` y `store/`** — unit tests con vitest. Cobertura objetivo
  80% de líneas y funciones, y `npx vitest run --coverage` la mide de verdad (proveedor
  v8 instalado, umbrales en `vitest.config.mts`).
  - `domain/` y `lib/` son puros o casi: no importan React Native ni op-sqlite.
  - `db/` se testea en tres niveles: `sql.ts` es puro; los repositorios y las queries
    corren contra un handle falso de base de datos en `src/db/testing/fakeDb.ts`, sin
    módulo nativo.
  - `store/` se testea con los repositorios simulados.
  - La zona horaria está fijada a `America/Bogota`: los límites de día y semana son
    locales y un test que pasa acá tiene que pasar en CI. `TZ_OVERRIDE` permite una
    segunda corrida en una zona con horario de verano.
- `tsconfig.json` lleva `noUnusedLocals` y `noUnusedParameters`: código muerto es error
  de typecheck.
- **Migraciones, seed y recuperación de huérfanas** — se verifican corriendo la app.
  `app/_layout.tsx` loguea en dev cuántas actividades hay y cuántas sesiones huérfanas
  cerró, que es la señal de que corrieron de verdad.
- UI — sin tests en fase 1. El prototipo se valida usándolo.

## Qué no está en la arquitectura y es a propósito

- No hay capa de API. No hay red.
- No hay sistema de eventos ni event bus. 3 pantallas no lo justifican.
- No hay inyección de dependencias. Los repositorios se importan directo.
- No hay librería de i18n. Dos diccionarios tipados a mano bastan para dos idiomas (ADR-0020).
