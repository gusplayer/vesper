# Arquitectura — Vesper

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Runtime | Expo SDK + dev client | Módulos nativos obligatorios en fase 2 (ADR-0001) |
| Lenguaje | TypeScript estricto | `strict: true`, sin `any` |
| Navegación | expo-router + react-native-pager-view | 2 rutas y un pager. Ver ADR-0009 |
| Persistencia | op-sqlite | Rápido, síncrono, sin ORM |
| Ids | UUID v7 propio sobre `expo-crypto` | 20 líneas. Evita `uuid` + `react-native-get-random-values` |
| Estado UI | Zustand | Solo estado efímero. La verdad vive en SQLite |
| Salud | react-native-health (iOS) / react-native-health-connect (Android) | Fase 1.5 |
| Bloqueo | react-native-device-activity (iOS) / módulo propio (Android) | Fase 2 |

Sin backend en fase 1. Sin cuenta de usuario. Sin sync.

## Estructura

```
src/
  app/                    expo-router. Todo archivo aquí es una ruta
    _layout.tsx
    index.tsx             host del pager: inicio + vida
    session.tsx           ruta de sesión activa, sin swipe
    config/
      session.tsx         modal de configuración de sesión
      habit.tsx           modal de hábito
  screens/                páginas del pager. No son rutas, por eso no viven en app/
    Home.tsx
    Life.tsx
  design/
    tokens.ts             color, font, space, radius, rule
    components/           ~15 componentes
  domain/
    types.ts              tipos de dominio, fuente de verdad
    session.ts            lógica de sesión (pura, testeable)
    ledger.ts             cálculo del libro mayor del día
    life.ts               cálculo de semanas y proyección
  db/
    client.ts             instancia de op-sqlite y runner de migraciones
    sql.ts                helpers de texto SQL, puros y testeables
    boot.ts               abre, migra, siembra y recupera huérfanas
    migrations/           001_init.ts, 002_... en TypeScript, no .sql
    repositories/
      sessions.ts
      habits.ts
      activities.ts
      settings.ts
  health/                 fase 1.5
  blocking/               fase 2
    ios/
    android/
  lib/
    uuid.ts               UUID v7 sobre expo-crypto
  store/
    session.ts            estado de la sesión en curso
```

Las migraciones son `.ts` y no `.sql` porque Metro no empaqueta `.sql` sin configurar
el resolver, y mantener las dos cosas sería tener dos fuentes de verdad del esquema.
Una migración publicada no se edita: se agrega la siguiente.

## Reglas de capas

```
app/ screens/  →  domain/  →  db/repositories/  →  db/client
  ↓
design/components
```

- **Los componentes no ejecutan SQL.** Nunca. Todo pasa por un repositorio.
- **`domain/` es puro.** Sin imports de React, sin imports de la base de datos.
  Recibe datos, devuelve datos. Es lo único que se testea con unit tests.
- **`design/components` no conoce el dominio.** Recibe props primitivas.
  `<LedgerRow label="gym" value="hecho" />`, no `<LedgerRow habit={habit} />`.
- **Los tokens no se importan en `app/` ni en `screens/`.** Solo en `design/`. Si una
  pantalla necesita un token, falta un componente.

## Flujo de una sesión

```
usuario toca "empezar"
  → store/session.start(config)
  → domain/session.createSession(config, now)  [puro]
  → db/repositories/sessions.insert(session)
  → navega a /session
  → tick local cada 1s desde el store (no desde la DB)
  → al terminar o rendirse:
      domain/session.close(session, now, outcome)  [puro]
      db/repositories/sessions.update(...)
```

El timer **nunca** se calcula sumando ticks. Se calcula como `now - startedAt`,
para que sobreviva a que la app se vaya a background.

## Estado de la app en background

- Al ir a background durante una sesión: se registra `backgroundedAt`.
- Al volver: si el tiempo transcurrido supera `plannedMs`, la sesión se cierra
  como `completed` con `actualMs = plannedMs`.
- En nivel `firme` y `profundo`, salir de la app cuenta como interrupción
  y se incrementa `interruptions`. No cancela la sesión.

## Muerte del proceso

Background no es lo mismo que muerte del proceso. Si el sistema mata la app —o el usuario la
cierra desde el multitarea— la sesión queda `running` en la DB y nadie la cierra.

Al arrancar, antes de renderizar la primera pantalla, `sessions.recoverOrphans(now)` cierra
toda sesión `running` como `expired` con `actual_ms = min(now - started_at, planned_ms)`.

`expired` existe precisamente para esto y se distingue de `cancelled`: el usuario no se rindió,
solo no sabemos qué pasó. En el libro mayor cuenta como tiempo invertido; en las métricas de
abandono, no.

## Cálculo del libro mayor

`domain/ledger.ts` recibe:

```ts
type LedgerInput = {
  dayStart: number;
  dayEnd: number;
  now: number;                     // acota el renglón `sin registrar`
  sessions: Session[];
  healthSamples: HealthSample[];   // vacío en fase 1
  usageEstimateMs: number;         // 0 en fase 1
}
```

Y devuelve renglones con su procedencia (`verified` | `declared` | `estimated` | `unknown`).

El renglón `sin registrar` es:

```ts
Math.max(0, Math.min(now, dayEnd) - dayStart - sumaDelResto)
```

Dos detalles que importan. **No es `86400000`**: en el día de cambio de horario el día local
dura 23h o 25h, y `dayStart`/`dayEnd` ya vienen en el input justo para eso. **Y se acota con
`now`**: si no, a las 10:00 con 2h registradas el libro mayor reportaría 22h sin registrar,
contando el futuro como tiempo perdido.

## Testing

- `domain/` y `db/sql.ts` — unit tests con vitest. Cobertura objetivo 80%.
  Son los módulos puros: no importan React ni op-sqlite, así que no necesitan
  transform de React Native.
- `db/repositories/` — se verifican corriendo la app. `boot.ts` loguea en dev cuántas
  actividades hay y cuántas sesiones huérfanas cerró, que es la señal de que las
  migraciones y la recuperación corrieron de verdad.
- UI — sin tests en fase 1. El prototipo se valida usándolo.

## Qué no está en la arquitectura y es a propósito

- No hay capa de API. No hay red.
- No hay sistema de eventos ni event bus. 3 pantallas no lo justifican.
- No hay inyección de dependencias. Los repositorios se importan directo.
- No hay i18n en fase 1. Español hardcodeado, extraído en fase 2.
