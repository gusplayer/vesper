-- The circle's tables (ADR-0033). One row, one owner: every write checks that the
-- caller owns the row, so a sync is last-write-wins per row and never loses anything.
--
-- Shapes mirror src/db/migrations/004_circle.ts on the phone, minus everything that
-- never leaves it in the clear: sessions, intentions, modes, apps, Screen Time, Health.
-- All of it but Screen Time does travel inside `backups`, encrypted on the phone with a
-- key the server never holds (ADR-0048 §7).

create table if not exists accounts (
  id            text primary key,
  -- SHA-256 of the device secret. The secret itself never touches the server's disk.
  secret_hash   text        not null,
  -- Null until the person enters the circle: the account is born as a bare identity on
  -- the phone's first launch (ADR-0048), and name and handle arrive together later.
  name          text,
  -- Unique, lowercase: two @gus in one challenge is impersonation (ADR-0032). Null is
  -- not a claim, and Postgres counts nulls as distinct, so identities coexist.
  handle        text        unique,
  -- The invite code the device derives from its profile (domain/circle.inviteCodeFor).
  -- Unique: a code is a claim, and the first account to make it keeps it. Two rows with
  -- the same code let whoever saw it on a screen or in a link answer for its owner.
  -- Null is not a claim, and Postgres counts nulls as distinct, so accounts without a
  -- code coexist.
  invite_code   text        unique,
  -- Expo push token, null until the phone registers one or the user turns notices off.
  push_token    text,
  -- IANA name, for the end-of-day grouping of cheers. Null until the phone says.
  time_zone     text,
  nudges_on     boolean     not null default true,
  -- What the server knows of someone who does not use the circle (ADR-0048 §3): which
  -- system, which version of the app, and when it last saw them — within the hour.
  -- 'ios' or 'android', checked by the API; no CHECK here, see below.
  platform      text,
  app_version   text,
  last_seen_at  bigint,
  created_at    bigint      not null,
  updated_at    bigint      not null
);

-- Databases created before the identity (ADR-0048). Dropping NOT NULL and adding a
-- column `if not exists` are both idempotent, so this runs clean on every boot. The
-- accounts already there keep their name and handle; only new ones may lack them.
alter table accounts alter column name drop not null;
alter table accounts alter column handle drop not null;
-- No constraint rides on an `add column if not exists`: some Postgres versions add the
-- constraint again on every run even when the column is already there.
alter table accounts add column if not exists platform text;
alter table accounts add column if not exists app_version text;
alter table accounts add column if not exists last_seen_at bigint;

-- Databases created before the code was unique. Postgres has no
-- `add constraint if not exists`, so the whole thing runs inside a guard, which makes it
-- safe on every boot: if the constraint is already there (a fresh database gets it from
-- `create table` above), nothing happens.
--
-- Duplicates left by the old schema are cleared first, or the `alter` would fail and the
-- server would not boot: the oldest account keeps the code and the rest lose it. Losing
-- it is not losing anything — the phone derives the next one by bumping its generation.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'accounts'::regclass and conname = 'accounts_invite_code_key'
  ) then
    update accounts set invite_code = null where id in (
      select id from (
        select id, row_number() over (
          partition by invite_code order by created_at asc, id asc
        ) as seat
        from accounts where invite_code is not null
      ) ranked where seat > 1
    );
    alter table accounts add constraint accounts_invite_code_key unique (invite_code);
  end if;
end
$$;

-- The unique constraint brings its own index; the plain one it replaces is dead weight.
drop index if exists accounts_invite_code;

-- Who is in whose circle. One row per direction: A sees B when (A, B) is 'member'.
-- A code redeemed by B writes (A, B, 'pending'); A accepting writes both directions.
create table if not exists links (
  owner_id   text   not null references accounts (id) on delete cascade,
  member_id  text   not null references accounts (id) on delete cascade,
  status     text   not null check (status in ('pending', 'member')),
  created_at bigint not null,
  updated_at bigint not null,
  primary key (owner_id, member_id)
);

create index if not exists links_member on links (member_id);

-- A link that ended (ADR-0049): Rechazar, Quitar, Salir del círculo. Both rows of
-- `links` are deleted, and the pair stays here so the other phone learns it at its next
-- sync — a cursor over `updated_at` never sees a row that is gone. One row per pair,
-- ordered (a_id < b_id) so it is the same row whoever ended it. A new link between the
-- two deletes it: the new one supersedes the end.
create table if not exists ended_links (
  a_id     text   not null references accounts (id) on delete cascade,
  b_id     text   not null references accounts (id) on delete cascade,
  ended_at bigint not null,
  primary key (a_id, b_id),
  check (a_id < b_id)
);

create index if not exists ended_links_b on ended_links (b_id, ended_at);

-- What ADR-0021 called "what a server would deliver": one row per person and week.
--
-- Every metric is nullable, and null means "this person does not share it" — never
-- zero, which reads as "did nothing this week". The three switches of Ajustes › Círculo
-- (focus, habits, social) each reach here as a null.
create table if not exists weeks (
  account_id    text   not null references accounts (id) on delete cascade,
  week_key      text   not null,
  focus_ms      bigint,
  -- An estimated floor, shown on its own line and never summed (ADR-0005).
  social_ms     bigint,
  habits_done   int,
  habits_target int,
  updated_at    bigint not null,
  primary key (account_id, week_key)
);

-- Databases created before the switches reached the server: dropping NOT NULL is
-- idempotent, so this runs clean on every boot, old database or new.
alter table weeks alter column focus_ms drop not null;
alter table weeks alter column habits_done drop not null;
alter table weeks alter column habits_target drop not null;

create table if not exists challenges (
  id              text    primary key,
  created_by      text    not null references accounts (id) on delete cascade,
  name            text    not null,
  weekly_target   int     not null,
  start_week_key  text    not null,
  end_day_key     text,
  -- Account ids. The phone keeps its own participation as ME plus a habit of its own.
  participant_ids jsonb   not null,
  archived_at     bigint,
  created_at      bigint  not null,
  updated_at      bigint  not null
);

create table if not exists challenge_marks (
  challenge_id text   not null references challenges (id) on delete cascade,
  account_id   text   not null references accounts (id) on delete cascade,
  day_key      text   not null,
  updated_at   bigint not null,
  primary key (challenge_id, account_id, day_key)
);

-- How the mark was counted on its owner's phone (ADR-0042): 'health', 'session' or
-- 'manual', the phone's own MarkSource. Shown next to the person, never summed.
alter table challenge_marks add column if not exists source text not null default 'manual';

create table if not exists kudos (
  id         text   primary key,
  from_id    text   not null references accounts (id) on delete cascade,
  to_id      text   not null references accounts (id) on delete cascade,
  day_key    text   not null,
  created_at bigint not null,
  updated_at bigint not null,
  unique (from_id, to_id, day_key)
);

create table if not exists nudges (
  id           text   primary key,
  from_id      text   not null references accounts (id) on delete cascade,
  to_id        text   not null references accounts (id) on delete cascade,
  challenge_id text   not null references challenges (id) on delete cascade,
  day_key      text   not null,
  created_at   bigint not null,
  updated_at   bigint not null,
  unique (from_id, to_id, challenge_id, day_key)
);

create index if not exists kudos_to on kudos (to_id, updated_at);
create index if not exists nudges_to on nudges (to_id, updated_at);
create index if not exists weeks_updated on weeks (updated_at);
create index if not exists marks_updated on challenge_marks (updated_at);

-- One encrypted copy of the phone's database per account (ADR-0048 §7), replaced on
-- every upload. The bytes are ciphertext the phone made with a key derived from its
-- secret: the server stores them and cannot read them, and nothing here tries to.
-- `format`, `schema` and `platform` are what the phone sends beside the bytes so a new
-- phone can tell, before it downloads anything, whether it can open them. The size is
-- capped by the API (5 MB), and the row goes with the account.
create table if not exists backups (
  account_id text    primary key references accounts (id) on delete cascade,
  data       bytea   not null,
  format     int     not null,
  schema     int     not null,
  platform   text    not null,
  size       int     not null,
  updated_at bigint  not null
);
