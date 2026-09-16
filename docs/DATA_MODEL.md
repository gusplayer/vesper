# Modelo de datos — Vesper

SQLite local. Sin sync en fase 1, pero todo id es un UUID v7 para que el sync futuro
no requiera migración.

Todas las fechas son epoch ms (`INTEGER`). Nunca strings, nunca zonas horarias en la DB.

**Única excepción:** `habit_marks.day_key` es `'YYYY-MM-DD'` en la zona local del usuario.
Es deliberado: la meta semanal de un hábito se cuenta en días del calendario del usuario, no
en instantes. Un epoch ms obligaría a recalcular el día local en cada query. No agregues otras
columnas de fecha en texto.

## Esquema

Vive en `src/db/migrations/`, como template literals de TypeScript: Metro no
empaqueta `.sql` sin configurar el resolver, y mantener las dos cosas sería tener dos
fuentes de verdad. Una migración publicada no se edita: se agrega la siguiente.
Hoy hay dos: `001_init.ts` (fase 1) y `002_modes_schedules.ts` (ADR-0017).

Al abrir la base, `src/db/client.ts` fija dos pragmas antes de migrar:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

Y lleva el registro de migraciones aplicadas en una tabla propia, que no es parte del
esquema de producto:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  INTEGER NOT NULL
);
```

Cada migración corre en su propia transacción: si falla a mitad, la base queda en la
última versión buena.

```sql
-- 001_init.ts

CREATE TABLE activities (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,   -- 'trabajo', 'lectura', 'gym'
  label        TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE TABLE habits (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,            -- texto libre del usuario. Ver ADR-0008
  activity_id   TEXT REFERENCES activities(id),  -- categoria opcional, autovinculada por nombre
  weekly_target INTEGER NOT NULL,         -- veces por semana
  count_mode    TEXT NOT NULL,            -- 'verified' | 'declared'
  health_type   TEXT,                     -- 'workout' | 'steps' | 'sleep' | NULL
  archived_at   INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  activity_id   TEXT NOT NULL REFERENCES activities(id),
  planned_ms    INTEGER NOT NULL,
  actual_ms     INTEGER NOT NULL DEFAULT 0,
  outcome       TEXT NOT NULL,            -- 'running' | 'completed' | 'cancelled' | 'expired'
                                          -- 'expired': sesion huerfana, el proceso murio corriendo
  depth         TEXT NOT NULL,            -- 'soft' | 'firm' | 'deep'
  block_profile TEXT,                     -- id de perfil, NULL en fase 1
  intention     TEXT,
  exit_reason   TEXT,                     -- texto escrito al rendirse en modo firme
  interruptions INTEGER NOT NULL DEFAULT 0,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX idx_sessions_started ON sessions(started_at);

CREATE TABLE habit_marks (
  id          TEXT PRIMARY KEY,
  habit_id    TEXT NOT NULL REFERENCES habits(id),
  day_key     TEXT NOT NULL,              -- 'YYYY-MM-DD' en local del usuario
  source      TEXT NOT NULL,              -- 'health' | 'manual' | 'session'
  source_ref  TEXT NOT NULL DEFAULT '',   -- uuid del sample o de la sesión, '' si es manual
  duration_ms INTEGER,
  marked_at   INTEGER NOT NULL,
  UNIQUE(habit_id, day_key, source_ref)
);
CREATE INDEX idx_marks_day ON habit_marks(day_key);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
```

```sql
-- 002_modes_schedules.ts

-- app_ids y website_ids son arrays JSON de ids del catálogo del prototipo, nunca
-- bundle ids reales (ADR-0004). La selección real vive en selection_token, opaca.
-- activity_id guarda la *clave* de la actividad ('trabajo'), no el id de la fila:
-- el editor de modos habla en claves. Se resuelve a id de fila al arrancar la sesión.
CREATE TABLE modes (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  behavior        TEXT NOT NULL,            -- 'block' | 'allow'
  app_ids         TEXT NOT NULL DEFAULT '[]',
  website_ids     TEXT NOT NULL DEFAULT '[]',
  depth           TEXT NOT NULL,            -- 'soft' | 'firm' | 'deep'
  activity_id     TEXT NOT NULL,
  selection_token TEXT,                     -- FamilyActivitySelection opaco, NULL sin entitlement
  created_at      INTEGER NOT NULL
);

-- days es un array JSON de siete booleanos, lunes primero. end_minutes NULL es
-- "hasta que lo termines". mode_id no es foreign key a propósito: borrar un modo
-- apaga sus horarios en vez de borrarlos, y RESTRICT rechazaría el DELETE.
CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  mode_id       TEXT NOT NULL,
  start_minutes INTEGER NOT NULL,           -- minutos desde medianoche
  end_minutes   INTEGER,
  days          TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_schedules_mode ON schedules(mode_id);
```

### Cómo usa las tablas el prototipo (ADR-0017)

- **Sesiones.** El store de foco (`src/data/stores/focus.ts`) inserta la fila al
  arrancar y la actualiza al terminar, al escribir la intención y en cada interrupción.
  `sessions.block_profile` guarda el **id del modo** que corrió la sesión: el modo es
  lo que decide qué se bloquea, que es exactamente para lo que se reservó la columna.
  `sessions.activity_id` es el id de fila de `activities`, resuelto desde la clave del
  modo con `resolveActivityId` (`src/db/boot.ts`).
- **Estadísticas por día.** No se guardan. `src/db/queries/dayStats.ts` pliega la
  tabla `sessions` por día local (`loadDayStats(now, days)`): foco, cantidad de
  sesiones y segmentos como fracciones del día. Una sesión cuenta en el día en que
  empezó y se recorta a él. La sesión en curso queda fuera: el contador de la portada
  la suma en vivo desde el store de foco.
- **Hábitos y marcas.** `habits` y `habit_marks` tal cual. El editor de hábitos habla
  en claves de actividad; `habits.activity_id` recibe el id de fila resuelto.
  `replaceHealthMarks` borra todas las marcas `source = 'health'` y escribe las que
  Salud reporta ahora; las manuales no se tocan.
- **Datos de demostración.** `bootDatabase` los siembra una sola vez (modos, horarios,
  hábitos, marcas de la semana y ~10 semanas de sesiones completadas generadas por
  `seedDemoSessions` en `src/data/seed.ts`). La guarda es la clave `demo_seeded_at`,
  no "la tabla está vacía": un usuario que borra todos sus modos no los recupera al
  relanzar. "Borrar todo y reiniciar" (`resetDatabase`) vacía todas las tablas —el
  esquema queda—, vuelve a sembrar y los stores se rehidratan.

### Fase 1.5 — salud

```sql
CREATE TABLE health_samples (
  id           TEXT PRIMARY KEY,
  external_id  TEXT UNIQUE,               -- uuid de HealthKit / Health Connect
  type         TEXT NOT NULL,             -- 'workout' | 'steps' | 'sleep' | 'exercise_time'
  value        REAL NOT NULL,
  unit         TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER NOT NULL,
  source_name  TEXT,
  synced_at    INTEGER NOT NULL
);
CREATE INDEX idx_health_started ON health_samples(started_at);
```

`external_id` con `UNIQUE` es lo que hace idempotente el sync incremental.

### Fase 2 — bloqueo y uso

```sql
CREATE TABLE block_profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  mode        TEXT NOT NULL,              -- 'blocklist' | 'allowlist'
  created_at  INTEGER NOT NULL
);

CREATE TABLE blocked_apps (
  id           TEXT PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES block_profiles(id),
  platform     TEXT NOT NULL,             -- 'ios' | 'android'
  token        TEXT NOT NULL,             -- token opaco (iOS) o package name (Android)
  user_label   TEXT,                      -- nombre que el usuario le puso. Ver ADR-0004
  created_at   INTEGER NOT NULL
);

CREATE TABLE usage_events (
  id           TEXT PRIMARY KEY,
  platform     TEXT NOT NULL,
  kind         TEXT NOT NULL,             -- 'threshold' | 'shield_hit' | 'unlock_requested'
                                          -- 'unlock_granted' | 'backed_off' | 'foreground'
  token        TEXT,
  minute_mark  INTEGER,                   -- solo para 'threshold' en iOS
  duration_ms  INTEGER,                   -- solo para 'foreground' en Android
  session_id   TEXT REFERENCES sessions(id),
  fired_at     INTEGER NOT NULL
);
CREATE INDEX idx_usage_fired ON usage_events(fired_at);
```

**Nota crítica:** `usage_events` nunca contiene datos provenientes de
`DeviceActivityReport`. Solo eventos de `DeviceActivityMonitor`,
`ShieldActionExtension` y `UsageStatsManager`. Ver ADR-0004.

## Settings conocidos

| key | valor | notas |
|---|---|---|
| `prototype_settings` | JSON | El objeto `Settings` completo de `src/data/types.ts`: onboarding, permisos "concedidos", reglas, notificaciones, desbloqueos de emergencia, fecha de nacimiento, expectativa de vida, meta semanal, banner pendiente y última sincronización de Salud. Se valida **campo por campo** al leer (`settings.parseSettings`): un campo ausente o corrupto vuelve al default de `seed.SETTINGS` sin arrastrar al resto |
| `active_mode_id` | id | el modo que muestra la portada. Si ya no existe, se toma el primero |
| `demo_seeded_at` | epoch ms | escrita al sembrar los datos de demostración; su ausencia es lo único que dispara la siembra |
| `language` | `auto` \| `es` \| `en` | Ajustes › Idioma (ADR-0020). Ausente o inválida se lee como `auto`, que sigue el idioma del teléfono. Se borra con todo lo demás en "Borrar todo y reiniciar" |
| `last_session_config` | JSON | fase 1. `{activityId, plannedMs, depth, blockProfile}`. Se valida al leer con `domain/session.resolveSessionConfig`. El prototipo no la usa: la duración elegida vive en memoria |
| `birth_date` | epoch ms | **superseded** por `prototype_settings.birthDate` desde ADR-0017 |
| `life_expectancy_years` | número | **superseded** por `prototype_settings.lifeExpectancyYears` |
| `weekly_focus_target_ms` | número | **superseded** por `prototype_settings.weeklyTargetMs` (`null` para "ninguna"). `settings.getWeeklyTargetMs` sigue leyendo la clave vieja para la query de fase 1 |
| `onboarding_completed_at` | epoch ms | **superseded** por `prototype_settings.onboardingDone`, que el tour escribe al terminar |

Las cuatro claves marcadas como superseded no se escriben ni se leen desde el prototipo:
una sola fuente de verdad (el JSON) evita mantener dos copias en sincronía. Sus
accesores en `settings.ts` quedan para la capa de fase 1 y sus tests.

Todo valor se escribe desde el flujo que lo usa (ADR-0007). `life_screen_enabled` existió
en el papel y se eliminó del código: la página de vida siempre está en el pager y no hay
onboarding donde declinarla.

## Invariantes

1. Solo puede existir **una** sesión con `outcome = 'running'` a la vez.
2. `actual_ms <= planned_ms` siempre. Una sesión nunca excede lo planeado.
3. Máximo 5 filas en `habits` con `archived_at IS NULL`.
4. El tope de 6h declarables (21600000 ms) es una **advertencia**, no una resta: desde
   ADR-0010 el renglón `sin registrar` es una partición del reloj y no hay suma que romper.
   `domain/ledger.ts` expone `declaredCapped` para que la UI lo diga en voz alta.
5. `habit_marks` con `source = 'health'` no se pueden borrar manualmente. Son verificadas.
6. Un hábito admite **una sola marca manual por día**. Lo garantiza
   `UNIQUE(habit_id, day_key, source_ref)` con `source_ref TEXT NOT NULL DEFAULT ''`.
   Con `source_ref` nullable no funcionaría: en SQLite los NULL son distintos entre sí
   dentro de un índice UNIQUE, y se podrían insertar N marcas manuales el mismo día.
7. Al arrancar la app, toda sesión con `outcome = 'running'` cuyo `started_at + planned_ms`
   ya pasó se cierra como `expired`. Sin esa recuperación el invariante 1 bloquea la app
   para siempre si el proceso muere en medio de una sesión. Una sesión todavía dentro de
   su ventana se retoma: el store de foco la hidrata y vuelve a poner el tema oscuro.
8. Los stores de `src/data/` son una caché de la base, nunca la fuente. Cada acción
   escribe por su repositorio **antes** de tocar el estado; `hydrate()` los rellena al
   arrancar y después de un reinicio.
