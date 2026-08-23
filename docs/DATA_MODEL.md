# Modelo de datos — Vesper

SQLite local. Sin sync en fase 1, pero todo id es un UUID v7 para que el sync futuro
no requiera migración.

Todas las fechas son epoch ms (`INTEGER`). Nunca strings, nunca zonas horarias en la DB.

**Única excepción:** `habit_marks.day_key` es `'YYYY-MM-DD'` en la zona local del usuario.
Es deliberado: la meta semanal de un hábito se cuenta en días del calendario del usuario, no
en instantes. Un epoch ms obligaría a recalcular el día local en cada query. No agregues otras
columnas de fecha en texto.

## Esquema

```sql
-- 001_init.sql

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
| `last_session_config` | JSON | duración, actividad, profundidad, perfil |
| `birth_date` | epoch ms | opt-in |
| `life_expectancy_years` | número | default 77.6, editable |
| `life_screen_enabled` | `'true'` / `'false'` | default `'false'` |
| `weekly_focus_target_ms` | número | meta semanal |
| `onboarding_completed_at` | epoch ms | |

## Invariantes

1. Solo puede existir **una** sesión con `outcome = 'running'` a la vez.
2. `actual_ms <= planned_ms` siempre. Una sesión nunca excede lo planeado.
3. Máximo 5 filas en `habits` con `archived_at IS NULL`.
4. La suma de tiempo declarado por día tiene tope de 6h (21600000 ms). Se aplica en `domain/ledger.ts`, no en la DB.
5. `habit_marks` con `source = 'health'` no se pueden borrar manualmente. Son verificadas.
6. Un hábito admite **una sola marca manual por día**. Lo garantiza
   `UNIQUE(habit_id, day_key, source_ref)` con `source_ref TEXT NOT NULL DEFAULT ''`.
   Con `source_ref` nullable no funcionaría: en SQLite los NULL son distintos entre sí
   dentro de un índice UNIQUE, y se podrían insertar N marcas manuales el mismo día.
7. Al arrancar la app, toda sesión con `outcome = 'running'` cuyo `started_at + planned_ms`
   ya pasó se cierra como `expired`. Sin esa recuperación el invariante 1 bloquea la app
   para siempre si el proceso muere en medio de una sesión.
