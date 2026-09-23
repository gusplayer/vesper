/**
 * One routine start mark per routine, inside `prototype_settings`.
 *
 * Until now the engine kept a single `lastRoutineStart` ({ routineId, windowStart }):
 * the one window it started last. Two routines that overlap broke it. "Trabajo"
 * 09:00–18:00 and "Lectura" 13:00–13:30: Trabajo starts at 09:00 and marks, the user
 * ends its session at 09:30; at 13:00 Lectura is the due one and its mark overwrites
 * Trabajo's; at 13:30 Lectura is over, Trabajo's window is still open and now reads as
 * never started, so the engine opens a four-and-a-half-hour session with the blocking
 * on that nobody asked for. `routineStarts` is a map from routine id to the start of
 * the window it last ran, so one routine's mark can never erase another's.
 *
 * The mark that exists is kept: it becomes the one entry of the new map. A settings
 * row that never had one, or whose value is not JSON, is left alone — `parseSettings`
 * falls back to the empty map field by field.
 *
 * A shipped migration is never edited. Add 009_*.ts instead.
 */
export const ROUTINE_STARTS_SQL = `
UPDATE settings
   SET value = json_set(
         json_remove(value, '$.lastRoutineStart'),
         '$.routineStarts',
         json_object(
           json_extract(value, '$.lastRoutineStart.routineId'),
           json_extract(value, '$.lastRoutineStart.windowStart')
         )
       )
 WHERE key = 'prototype_settings'
   AND json_valid(value)
   AND json_type(value, '$.lastRoutineStart.routineId') = 'text'
   AND json_extract(value, '$.lastRoutineStart.windowStart') IS NOT NULL;

UPDATE settings
   SET value = json_remove(value, '$.lastRoutineStart')
 WHERE key = 'prototype_settings'
   AND json_valid(value)
   AND json_type(value, '$.lastRoutineStart') IS NOT NULL;
`;
