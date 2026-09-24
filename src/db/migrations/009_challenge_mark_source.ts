/**
 * Where a challenge mark came from (ADR-0042): 'health' when Health confirmed the day
 * on that person's phone, 'session' when a focus session did, 'manual' when they
 * tapped it. The same three values a habit mark already carries, so the user's own
 * side and everyone else's read alike. Existing rows are the seed's and were never
 * confirmed by anything: they stay 'manual'.
 *
 * A shipped migration is never edited. Add 010_*.ts instead.
 */
export const CHALLENGE_MARK_SOURCE_SQL = `
ALTER TABLE challenge_marks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
`;
