/**
 * ADR-0021 §4, hecho verdad en la tabla: "lo que no compartes no sale del teléfono".
 *
 * member_weeks nació con focus_ms, habits_done y habits_target NOT NULL DEFAULT 0, que
 * solo sabe decir "cero horas". Una persona que apaga un interruptor no comparte cero:
 * no comparte nada, y la diferencia importa porque cero se lee como "no hizo nada esta
 * semana". Las tres columnas pasan a admitir NULL, como social_ms desde el principio.
 *
 * SQLite no quita un NOT NULL con ALTER, así que la tabla se reconstruye. Las filas que
 * había son de la siembra de demostración y todas traen números, así que la copia no
 * pierde nada.
 *
 * A shipped migration is never edited. Add 012_*.ts instead.
 */
export const UNSHARED_METRICS_SQL = `
CREATE TABLE member_weeks_new (
  member_id     TEXT NOT NULL,
  week_key      TEXT NOT NULL,
  focus_ms      INTEGER,
  social_ms     INTEGER,
  habits_done   INTEGER,
  habits_target INTEGER,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (member_id, week_key)
);
INSERT INTO member_weeks_new
  SELECT member_id, week_key, focus_ms, social_ms, habits_done, habits_target, updated_at
    FROM member_weeks;
DROP TABLE member_weeks;
ALTER TABLE member_weeks_new RENAME TO member_weeks;
`;
