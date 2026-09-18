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
Hoy hay seis: `001_init.ts` (fase 1), `002_modes_schedules.ts` (ADR-0017),
`003_routines.ts` (duración de rutinas, ADR-0019), `004_circle.ts` (ADR-0021),
`005_open_sessions_breaks.ts` (sesiones sin límite y pausas, ADR-0022) y
`006_schedule_stamps.ts` (`schedules.updated_at`: una ventana ya abierta al guardar o
encender la rutina no arranca sesión, ADR-0026). El índice está
en `src/db/migrations/index.ts`; se aplican en orden y solo se agrega al final.

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
  -- más las cuatro columnas de 005, abajo
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
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL DEFAULT 0  -- 006: último guardado o encendido
);
CREATE INDEX idx_schedules_mode ON schedules(mode_id);
```

```sql
-- 003_routines.ts (ADR-0019)

-- Duración de una rutina sin hora ("cuando quieras"), y tope de una ventana abierta
-- (end_minutes NULL). NULL deja los valores del motor (8 h para la ventana abierta).
-- Una rutina sin hora guarda start_minutes = -1 (la columna es NOT NULL); el
-- repositorio lo lee como null.
ALTER TABLE schedules ADD COLUMN duration_ms INTEGER;
```

```sql
-- 005_open_sessions_breaks.ts (ADR-0022)

-- open: 1 = sin límite. planned_ms guarda entonces el tope de 12 h, no una elección.
ALTER TABLE sessions ADD COLUMN open INTEGER NOT NULL DEFAULT 0;
-- break_ms: tiempo en pausas terminadas. Nunca es foco; el reloj lo salta.
ALTER TABLE sessions ADD COLUMN break_ms INTEGER NOT NULL DEFAULT 0;
-- break_started_at: la pausa en curso, NULL si no hay.
ALTER TABLE sessions ADD COLUMN break_started_at INTEGER;
-- next_break_at_ms: foco acumulado al que se habilita la próxima pausa (25 min al empezar).
ALTER TABLE sessions ADD COLUMN next_break_at_ms INTEGER NOT NULL DEFAULT 1500000;
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
  Salud reporta ahora; las manuales no se tocan. Solo en iOS: en Android Salud no existe.
- **Datos de demostración.** `bootDatabase` los siembra una sola vez (modos, horarios,
  hábitos, marcas de la semana y ~10 semanas de sesiones completadas generadas por
  `seedDemoSessions` en `src/data/seed.ts`). La guarda es la clave `demo_seeded_at`,
  no "la tabla está vacía": un usuario que borra todos sus modos no los recupera al
  relanzar. "Borrar todo y reiniciar" (`resetDatabase`) vacía todas las tablas —el
  esquema queda—, vuelve a sembrar y los stores se rehidratan.

### Círculo (ADR-0021)

Cinco tablas en `004_circle.ts` y una sexta, `nudges`, en `007_streak_nudges.ts`
(ADR-0027). Ninguna es fuente de verdad de nada que el usuario haga solo: son lo que un servidor entregaría cuando exista. Hoy las llena el seed de
demostración (`src/data/circleSeed.ts`) y las acciones del store (`src/data/stores/circle.ts`);
mañana las llenará el sync y nada más cambia.

`week_key` y `day_key` son `'YYYY-MM-DD'` en local del usuario, la misma excepción que
`habit_marks.day_key` y por la misma razón: una semana y un día son del calendario de
quien los vive. `week_key` es siempre el lunes.

```sql
-- 004_circle.ts

-- status: 'member' (está en el círculo), 'invited' (el usuario lo invitó y no ha
-- respondido), 'pending' (invitó al usuario y espera respuesta). joined_at es NULL
-- hasta que alguien acepta, del lado que sea.
CREATE TABLE circle_members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  handle     TEXT NOT NULL,             -- alias corto en minúsculas: 'ana'
  status     TEXT NOT NULL,
  joined_at  INTEGER,
  created_at INTEGER NOT NULL
);

-- Una fila por persona y semana: lo que el servidor entregará. social_ms NULL es
-- "no lo comparte"; cuando existe es un piso estimado y va en su propia línea,
-- nunca sumado con el foco (ADR-0005).
CREATE TABLE member_weeks (
  member_id     TEXT NOT NULL,
  week_key      TEXT NOT NULL,          -- lunes de esa semana, 'YYYY-MM-DD' local
  focus_ms      INTEGER NOT NULL DEFAULT 0,
  social_ms     INTEGER,
  habits_done   INTEGER NOT NULL DEFAULT 0,
  habits_target INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (member_id, week_key)
);

-- Ánimo de una persona a otra, una vez al día: el índice UNIQUE es la regla y el
-- INSERT OR IGNORE hace que un doble toque no sea dos filas. Cualquiera de los dos
-- lados puede ser 'me', el id que representa al usuario en estas tablas.
CREATE TABLE kudos (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(from_id, to_id, day_key)
);
CREATE INDEX idx_kudos_day ON kudos(day_key);

-- Un hábito con testigos. participant_ids es un array JSON de 'me' y de ids de
-- circle_members. start_week_key es el lunes de la primera semana. end_day_key
-- (007, ADR-0027) es el último día, inclusive, o NULL para un reto sin límite: un
-- reto de 21 días desde un lunes termina el domingo de la tercera semana.
-- end_week_key es heredado de 004: sigue NOT NULL, se escribe derivado (el lunes de
-- la semana de end_day_key, o start_week_key si no hay fin) y nadie lo lee.
-- habit_id es el hábito del usuario que cuenta; NULL mientras no se haya unido.
-- Un reto se archiva, nunca se borra: sus marcas son historia.
CREATE TABLE challenges (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  weekly_target   INTEGER NOT NULL,     -- veces por semana
  start_week_key  TEXT NOT NULL,
  end_week_key    TEXT NOT NULL,        -- heredado; derivado al escribir, nadie lo lee
  end_day_key     TEXT,                 -- 007: último día inclusive, NULL = sin límite
  created_by      TEXT NOT NULL,        -- 'me' o un id de circle_members
  participant_ids TEXT NOT NULL DEFAULT '[]',
  habit_id        TEXT,
  created_at      INTEGER NOT NULL,
  archived_at     INTEGER
);

-- Las marcas de los demás participantes. Nunca 'me': las del usuario son sus
-- habit_marks de siempre, contadas contra habit_id.
CREATE TABLE challenge_marks (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  day_key      TEXT NOT NULL,
  marked_at    INTEGER NOT NULL,
  UNIQUE(challenge_id, member_id, day_key)
);
CREATE INDEX idx_challenge_marks_challenge ON challenge_marks(challenge_id);

-- 007_streak_nudges.ts (ADR-0027)

-- Un empujón: una persona empuja a otra que no marcó hoy un reto que comparten,
-- una vez al día por persona y reto. Cualquiera de los dos lados puede ser 'me'. La
-- regla de "una vez al día" la aplica el store, no un UNIQUE: las filas de los demás
-- llegarán del servidor tal cual. Mientras no hay backend, el empujón se guarda aquí
-- y se muestra como enviado; entregarlo es trabajo del servidor.
CREATE TABLE nudges (
  id            TEXT PRIMARY KEY,
  from_id       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  challenge_id  TEXT NOT NULL,
  day_key       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX nudges_to_day ON nudges(to_id, day_key);
```

Sin foreign keys a propósito: `'me'` participa y da ánimo sin ser fila de
`circle_members`, las filas de personas llegarán de la red y se reemplazarán enteras, y
archivar un hábito nunca debe rechazar un DELETE. Quién borra qué lo decide el
repositorio (`src/db/repositories/circle.ts`) y el store: sacar a alguien del círculo
borra sus semanas, sus kudos, sus empujones y sus marcas y lo quita de
`participant_ids`; "salir del círculo" vacía las cinco tablas de personas y archiva
todos los retos, pero conserva el perfil y las preferencias de compartir.

El perfil propio y qué se comparte no son tablas: son dos claves JSON en `settings`
(ver la tabla de abajo). El perfil **no** se siembra con el demo: crearlo es parte del
flujo. Todo lo demás del círculo (cuatro personas, dos semanas, dos kudos, un reto de
21 días, un empujón de hoy y una invitación pendiente) se siembra con el resto y se
borra con "Borrar todo y reiniciar".

### Racha (ADR-0027)

La racha **no se guarda**: `src/db/queries/streak.ts` pliega `sessions` por día local
(`loadDayFocus(now, days)`, una sesión cuenta entera en el día en que empezó, la que
corre queda fuera) y `domain/streak.ts` cuenta los días seguidos que llegan a diez
minutos. Lo único persistido son los **días de gracia** aplicados, en `007_streak_nudges.ts`:

```sql
-- Un día que la racha puenteó sola. day_key es 'YYYY-MM-DD' local, la misma excepción
-- que habit_marks.day_key; month_key es su 'YYYY-MM', para que el cupo de tres por mes
-- sea un COUNT. Se escribe con INSERT OR IGNORE: aplicar gracia dos veces al mismo
-- día no hace nada.
CREATE TABLE grace_days (
  day_key     TEXT PRIMARY KEY,
  month_key   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX grace_days_month ON grace_days(month_key);
```

Escribe solo el store (`settleStreak`, en `src/data/stores/app.ts`) a través de
`repositories/graceDays.ts`, al arrancar y en cada vuelta al primer plano: los días
sin foco entre ayer y el último día que contó reciben gracia mientras a su mes le quede
cupo; si el hueco es más largo que el cupo, la racha se rompe y no se gasta nada. Un
día con fila en `grace_days` cuenta como si hubiera tenido foco. La tabla se vacía con
"Borrar todo y reiniciar".

### Previsto y sin migración: salud, bloqueo y uso

Las tres tablas que siguen **no existen** en `src/db/migrations/`. Quedan como diseño
para cuando hagan falta. Hoy Salud no guarda muestras: `useHealthSync` lee la semana de
HealthKit y `domain/healthMarks` la convierte en `habit_marks` con `source = 'health'`
(ids deterministas `hm-<hábito>-<día>`, reemplazadas enteras en cada lectura). Y el
bloqueo no tiene perfiles: el modo es el perfil, su selección vive en
`modes.selection_token` y la sesión guarda el id del modo en `sessions.block_profile`.

```sql
-- No existe. Diseño previsto para muestras de Salud.
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

```sql
-- No existen. Diseño previsto para perfiles de bloqueo y eventos de uso (fase 3).
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
| `prototype_settings` | JSON | El objeto `Settings` completo de `src/data/types.ts`: `onboardingDone`, los tres permisos tal como el usuario los aceptó en la app (`screenTimeConnected`, `healthConnected`, `notificationsAllowed`; la disponibilidad real la dice `platform/*.status()`), `liveActivities`, desbloqueos de emergencia (`emergencyLeft`/`emergencyTotal`), `rules`, `notifications` (`coaching`, `updates`, `sessionEnd`, `weeklyClose` y, desde ADR-0027, `streak`, `noFocus`, `reactivation`, `nudges` y `reminderMinutes`, el minuto del día local del aviso diario, 1200 por defecto), `birthDate`, `country`, `sex`, `lifeExpectancyYears`, `weeklyTargetMs`, `pendingBanner`, `healthSyncedAt`, `lastRoutineStart` (la última ventana de rutina que arrancó, para no arrancarla dos veces) y `lastOpenedAt` (la última vez que la app se abrió o volvió al primer plano, epoch ms o `null`; los avisos de reactivación del ADR-0027 cuentan desde ahí). Se valida **campo por campo** al leer (`settings.parseSettings`): un campo ausente o corrupto vuelve al default de `seed.SETTINGS` sin arrastrar al resto |
| `active_mode_id` | id | el modo que muestra la portada. Si ya no existe, se toma el primero |
| `demo_seeded_at` | epoch ms | escrita al sembrar los datos de demostración; su ausencia es lo único que dispara la siembra |
| `language` | `auto` \| `es` \| `en` | Ajustes › Idioma (ADR-0020). Ausente o inválida se lee como `auto`, que sigue el idioma del teléfono. Se borra con todo lo demás en "Borrar todo y reiniciar" |
| `circle_profile` | JSON | La identidad del usuario en el círculo (ADR-0021): `{id, name, handle, createdAt}`. `id` es UUID v7, `handle` va en minúsculas. Ausente hasta que el usuario crea su perfil; un valor corrupto o incompleto se lee como `null` y el flujo de crear perfil vuelve a correr (`settings.getProfile`). No se siembra. `codeGeneration` (entero, 0 si falta) entra en el código de invitación: subirlo invalida el anterior |
| `circle_share` | JSON | Qué comparte el usuario con el círculo: `{focus, habits, social}`. Se valida interruptor por interruptor (`settings.getSharePrefs`); ausente o corrupto vuelve a `{focus: true, habits: true, social: false}`. Lo que está en `false` no sale del teléfono |
Las claves de la fase 1 `last_session_config`, `birth_date`, `life_expectancy_years`,
`weekly_focus_target_ms` y `onboarding_completed_at` **ya no existen en el código**
(ADR-0026): sus valores viven en `prototype_settings` desde ADR-0017 y sus accesores se
borraron con `repositories/sessionConfig.ts`. Una base vieja puede conservar la fila;
nadie la lee y "Borrar todo y reiniciar" la vacía.

Todo valor se escribe desde el flujo que lo usa (ADR-0007 en su fondo: Ajustes muestra,
el flujo escribe). `life_screen_enabled` existió en el papel y se eliminó del código: las
semanas de vida viven en Actividad › De por vida y la fecha en Ajustes › Vida; sin fecha,
la tarjeta invita y no cuenta.

## Invariantes

1. Solo puede existir **una** sesión con `outcome = 'running'` a la vez.
2. `actual_ms <= planned_ms` siempre. Una sesión nunca excede lo planeado. En una sesión
   sin límite `planned_ms` es el tope de 12 horas. Las pausas no entran en `actual_ms`:
   el reloj es `now - started_at - break_ms - (pausa en curso)`.
3. Máximo 5 filas en `habits` con `archived_at IS NULL`.
4. El tope de 6h declarables (21600000 ms) es una **advertencia**, no una resta: desde
   ADR-0010 el renglón `sin registrar` es una partición del reloj y no hay suma que romper.
   `domain/ledger.ts` expone `declaredCapped` para que la UI lo diga en voz alta.
5. `habit_marks` con `source = 'health'` no se pueden borrar manualmente. Son verificadas.
6. Un hábito admite **una sola marca manual por día**. Lo garantiza
   `UNIQUE(habit_id, day_key, source_ref)` con `source_ref TEXT NOT NULL DEFAULT ''`.
   Con `source_ref` nullable no funcionaría: en SQLite los NULL son distintos entre sí
   dentro de un índice UNIQUE, y se podrían insertar N marcas manuales el mismo día.
7. Al arrancar la app y al volver al frente, la sesión con `outcome = 'running'` se
   asienta (`domain/session.settle`): una pausa que pasó sus 15 minutos termina en su
   fin, y una sesión cuyo `started_at + planned_ms + break_ms` ya pasó se cierra en ese
   instante con su veredicto: `completed` si tenía duración elegida, `expired` solo si
   era sin límite y tocó el tope de 12 h (ADR-0026). `SessionGate` usa el mismo
   `settle` al volver al frente. Sin esa recuperación el invariante 1 bloquea la app para
   siempre si el proceso muere en medio de una sesión. Una sesión todavía dentro de su
   ventana se retoma: el store de foco la hidrata y vuelve a poner el tema oscuro.
8. Una sesión sin límite nunca es `deep`: se crea como `firm`. Una pausa solo existe con
   `depth` distinto de `deep`, dura 15 minutos como máximo, y hay una nueva cada 25
   minutos de foco (ADR-0022).
9. Los stores de `src/data/` son una caché de la base, nunca la fuente. Cada acción
   escribe por su repositorio **antes** de tocar el estado; `hydrate()` los rellena al
   arrancar y después de un reinicio.
