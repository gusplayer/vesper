import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  useAlbum,
  useAppStore,
  useSettings,
  useChallenge,
  useChallengePhotos,
  useChallengeStandings,
  useChallengeWeeks,
  useCircleMembers,
  useCircleStore,
  useMyChallengeWeeks,
  useMyPhotoSlot,
  useNudgesGivenToday,
  useNudgesReceivedToday,
  usePhotoAudience,
} from '../../data';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  NoticeCard,
  PageHeader,
  PhotoMosaic,
  PhotoTile,
  Screen,
  Section,
  Stack,
  StatusNote,
  Text,
} from '../../design/components';
import { challengeDays, challengeWeeksMet, weekDayKeys, weekdayIndex } from '../../domain/circle';
import { isMarkedByHealth } from '../../domain/habits';
import { thumbsToFetch, visiblePhotos as drawnPhotos } from '../../domain/photoSharing';
import { photoExpiresAt, weekPhotos } from '../../domain/photos';
import { ME } from '../../domain/types';
import { challengeStatusText, challengeSummaryText } from '../../features/circle/ChallengeCard';
import { useChallengeLink } from '../../features/circle/useChallengeLink';
import { ChallengeWeek } from '../../features/circle/ChallengeWeek';
import {
  photoDayNumber,
  photoDayText,
  photosUntilText,
  shownWeekKey,
} from '../../features/circle/challengePhotos';
import { challengeConsentText, challengeOutlookText } from '../../features/circle/challengeText';
import { PhotoSourceSheet } from '../../features/circle/PhotoSourceSheet';
import {
  isSharedPhoto,
  photoTermsAccepted,
  useChallengeThumbs,
  useHiddenMembers,
  usePhotoTermsAccepted,
} from '../../features/circle/photoSharing';
import { thumbUriOf } from '../../features/circle/photoUri';
import { StandingsList } from '../../features/circle/StandingsList';
import { healthMissingReason, useAskHealthToJoin } from '../../features/circle/useAskHealthToJoin';
import { useCircleSyncStatus } from '../../features/circle/useCircleSyncStatus';
import { leaveCircleChallenge } from '../../platform/hooks/useCircleSync';
import { useLocale, useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;

/**
 * One challenge. Your week is the page: seven days drawn, today breathing, and one
 * line that says what is missing and how much room is left (ADR-0031). Under it, the
 * others, with a nudge for whoever has not marked today — once a day per person,
 * delivered at the next sync and never during a session (ADR-0027, ADR-0037).
 *
 * The one button depends on where the user stands (`challengeLink`):
 * - **linked** and active: it marks today, which is the mark of the linked habit.
 * - **invited** — someone added them when creating it, or the habit behind it was
 *   archived — or **out**: it joins, which links (or creates) a habit, or says there is
 *   no slot. When Health can confirm the challenge, the line above the button says what
 *   joining shares, and joining asks for Health first (ADR-0042); where Health does not
 *   exist, the line says the user marks it.
 * Leaving keeps the habit. A challenge that ran out has no button: it has how it went,
 * the offer to run it again (if you took part), and the way to archive it.
 *
 * Photos (ADR-0051), where the challenge has "Fotos del día": your week is drawn large
 * and a marked day with a photo shows it and opens it. Under the week, a row offers the
 * photo of today (or of yesterday, if today is not marked and yesterday is) once the
 * day is marked, and replaces it once there is one; "Marcar hoy" stays the one button.
 *
 * Since the second step the photos go, encrypted, to the people who joined: while you
 * are in it, everyone's week is drawn large too, with their photos, and the page brings
 * down the thumbnails it is missing when it opens (never before, never in the
 * background); one still on its way holds its place. Nothing says "new" and nothing
 * counts them. The first photo that would leave the phone goes through
 * `circle/photo-terms` once. Someone invited sees the weeks without photos and one line
 * over "Unirme". A finished challenge adds the album: everyone's, with the date the
 * photos stay until, when they went out; yours alone otherwise. Your photos stay on this
 * phone until the challenge is archived, and archiving says it deletes them.
 */
export default function ChallengeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const strings = useStrings();
  const t = strings.circle;
  const now = useNow(CLOCK_MS);
  const view = useChallenge(id, now);
  const standings = useChallengeStandings(id, now);
  const weeks = useChallengeWeeks(id, now);
  const myWeek = useMyChallengeWeeks(now).find((week) => week.id === id) ?? null;
  const nudgesGiven = useNudgesGivenToday(now, id);
  const nudgesReceived = useNudgesReceivedToday(now, id);
  const members = useCircleMembers();
  const photos = useChallengePhotos(id);
  const photoSlot = useMyPhotoSlot(id, now);
  const album = useAlbum(id, now);
  const audience = usePhotoAudience(id);
  const hidden = useHiddenMembers();
  const termsAccepted = usePhotoTermsAccepted();
  const [photoSheet, setPhotoSheet] = useState(false);
  // The terms page was opened from here to add a photo: once it is accepted and the
  // page is back in view, the sheet opens as if the row had been tapped just now.
  const awaitingTerms = useRef(false);
  const account = useCircleStore((state) => state.account);
  const linkEndSupport = useCircleStore((state) => state.linkEndSupport);
  const createChallenge = useCircleStore((state) => state.createChallenge);
  const joinChallenge = useCircleStore((state) => state.joinChallenge);
  const leaveChallenge = useCircleStore((state) => state.leaveChallenge);
  const archiveChallenge = useCircleStore((state) => state.archiveChallenge);
  const nudge = useCircleStore((state) => state.nudge);
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const habits = useAppStore((state) => state.habits);
  const settings = useSettings();
  const link = useChallengeLink(view?.challenge ?? null);
  const [habitsFull, setHabitsFull] = useState(false);
  const [joining, setJoining] = useState(false);
  // What leaving could not finish on the server (ADR-0049), said once.
  const [leftLine, setLeftLine] = useState<string | null>(null);
  const askHealth = useAskHealthToJoin();
  const { tag } = useLocale();
  const sync = useCircleSyncStatus();
  const p = strings.photos;

  // The photos whose thumbnail is not on this phone yet (drawn, openable, on the server):
  // the page brings them down when it opens, and again when new ones arrive.
  const waitingKey =
    id === undefined
      ? ''
      : thumbsToFetch(photos, id, { hidden, now })
          .map((photo) => photo.id)
          .join(',');
  useChallengeThumbs(
    view !== null && view.challenge.photos && view.joined && view.challenge.habitId !== null ? id : undefined,
    waitingKey,
  );

  useFocusEffect(
    useCallback(() => {
      if (!awaitingTerms.current) {
        return;
      }
      awaitingTerms.current = false;
      if (photoTermsAccepted()) {
        setPhotoSheet(true);
      }
    }, [setPhotoSheet]),
  );

  if (view === null) {
    return (
      <Screen>
        <PageHeader onBack={() => goBack(router, BACK_FALLBACK.circle)} title={t.list.challenges} />
        <NoticeCard
          title={t.challenge.goneTitle}
          body={t.challenge.goneDescription}
          trailing="chevron"
          onPress={() => router.replace('/circle')}
        />
      </Screen>
    );
  }

  const { challenge } = view;
  const todayIndex = weekdayIndex(now);
  const active = view.status === 'active';
  const ended = view.status === 'ended';
  const linked = link === 'linked';
  const others = standings.filter((standing) => !standing.isMe);
  // The week the page draws is the one the standings are on: while it runs that is this
  // week, and once it is over it is the challenge's last one. Reading "0 de 4" over a
  // week the challenge was not running in is worse than saying nothing.
  const mine = standings.find((standing) => standing.isMe) ?? null;
  const markedToday = myWeek?.markedToday ?? false;
  // Only an active habit counts: an archived one is not in the five any more, and a
  // challenge "marked" on it would be a sixth commitment (rule 11).
  const habit = linked ? (habits.find((candidate) => candidate.id === challenge.habitId) ?? null) : null;
  // Health marks a verified habit on its own; a tap would be a declared mark in its place.
  const byHealth = habit !== null && isMarkedByHealth(habit, settings.healthConnected);
  const canMark = habit !== null && active && !byHealth;
  // A nudge is between people who share the challenge, while it runs, and only from
  // someone whose own marks count in it.
  const canNudge = linked && active;
  const canJoin = !linked && !ended;
  const duration = t.challenge.duration(challengeDays(challenge));
  // Photos only where the challenge takes them, and only on marked days (`weekPhotos`).
  const photosOn = challenge.photos;
  const weekKeys = weekDayKeys(shownWeekKey(challenge, now));
  const minePhotos = photosOn && mine !== null ? weekPhotos(photos, ME, weekKeys, mine.days) : undefined;
  const slot = photosOn && linked ? photoSlot : null;
  const openPhoto = (photoId: string) => router.push({ pathname: '/circle/photo', params: { id: photoId } });
  // Everyone's photos, for someone who joined it (a habit of theirs is or was behind it);
  // never for someone only invited (ADR-0051 §5), and hidden people's never (only for you).
  const joinedOnce = view.joined && challenge.habitId !== null;
  const visiblePhotos = drawnPhotos(photos, { hidden, now });
  const othersPhotos = photosOn && joinedOnce;
  // A photo that leaves the phone asks for the terms first, once (ADR-0051 §19).
  const needsTerms = photosOn && audience.length > 0 && !termsAccepted;
  const addPhoto = () => {
    if (needsTerms) {
      awaitingTerms.current = true;
      router.push('/circle/photo-terms');
      return;
    }
    setPhotoSheet(true);
  };
  // The album at the close: everyone's once there is more than yours, yours alone before.
  const albumRows =
    photosOn && ended ? album.filter((row) => row.isMe || (othersPhotos && !hidden.has(row.id))) : [];
  const groupAlbum = albumRows.some((row) => !row.isMe);
  const albumShared = groupAlbum || photos.some((photo) => photo.memberId === ME && isSharedPhoto(photo));
  // The server keeps them until a fixed date, said as a date; past it, only yours are
  // left, on this phone, until you archive it.
  const albumUntil = ended ? photoExpiresAt(challenge, now) : null;
  const albumLive = albumShared && albumUntil !== null && now < albumUntil;
  // Why the user is in it with nothing to mark: the habit behind it was archived, or
  // someone added them when creating it — say who, and what joining costs.
  const creator = members.find((member) => member.id === challenge.createdBy)?.name ?? null;
  const invitedLine =
    link !== 'invited' || ended
      ? null
      : challenge.habitId !== null
        ? t.challenge.relink
        : creator === null
          ? t.challenge.invitedAnon
          : t.challenge.invited(creator);

  const join = async () => {
    setJoining(true);
    await askHealth(challenge.name);
    setJoining(false);
    setHabitsFull(joinChallenge(challenge.id, Date.now()) === 'habitsFull');
  };
  const consent = canJoin ? challengeConsentText(challenge.name, t, tag, healthMissingReason()) : null;

  const confirmLeave = () => {
    // Somebody else's challenge, on a server that predates ADR-0049: it cannot take
    // anyone out, so once it has said so the alert says what leaving really does today.
    // The user's own challenge leaves through the sync, which every server has.
    const stuck = account !== null && challenge.createdBy !== ME && linkEndSupport === 'no';
    Alert.alert(t.challenge.leaveQuestion, stuck ? t.challenge.leaveMessageTheirs : t.challenge.leaveMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.challenge.leaveConfirm,
        style: 'destructive',
        onPress: () => {
          leaveChallenge(challenge.id, Date.now());
          setLeftLine(null);
          void leaveCircleChallenge(challenge.id).then((outcome) => {
            const theirs = challenge.createdBy !== ME;
            setLeftLine(
              outcome === 'unsupported' && theirs
                ? t.challenge.leaveUnsupported
                : outcome === 'queued'
                  ? t.invite.endQueued
                  : null,
            );
          });
        },
      },
    ]);
  };

  const confirmArchive = () => {
    // Archiving deletes the photos (ADR-0051 §13): the question says so when there are any.
    const hasPhotos = photos.some((photo) => photo.memberId === ME);
    const message = hasPhotos ? p.album.archiveMessage : t.challenge.ended.archiveMessage;
    Alert.alert(t.challenge.ended.archiveQuestion, message, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.challenge.ended.archiveConfirm,
        style: 'destructive',
        onPress: () => {
          archiveChallenge(challenge.id, Date.now());
          goBack(router, BACK_FALLBACK.circle);
        },
      },
    ]);
  };

  // Running it again is the same promise with the same people, starting this Monday.
  // The old one is archived: it is over, and two of the same name would be one too many.
  const repeat = () => {
    const outcome = createChallenge(
      {
        name: challenge.name,
        weeklyTarget: challenge.weeklyTarget,
        days: challengeDays(challenge),
        participantIds: challenge.participantIds.filter((participantId) => participantId !== ME),
        join: true,
        photos: challenge.photos,
      },
      Date.now(),
    );
    if (outcome === 'habitsFull') {
      setHabitsFull(true);
      return;
    }
    archiveChallenge(challenge.id, Date.now());
    router.replace({ pathname: '/circle/challenge', params: { id: outcome.id } });
  };

  const seeHabits = () => router.push({ pathname: '/activity', params: { view: 'lifetime' } });

  const primary = canMark ? (
    <Button
      label={markedToday ? t.challenge.unmarkToday : t.challenge.markToday}
      onPress={() => {
        if (habit !== null) {
          toggleHabitToday(habit.id, Date.now());
        }
      }}
    />
  ) : linked && active && byHealth ? (
    <StatusNote text={t.challenge.markedByHealth} icon="heart" align="center" />
  ) : canJoin ? (
    <>
      {consent === null ? null : <StatusNote text={consent} align="center" />}
      {/* Said before joining, never as bait: no "join to see" (ADR-0051 §5). */}
      {photosOn ? <StatusNote text={p.invited} align="center" /> : null}
      <Button label={t.challenge.join} onPress={() => void join()} busy={joining} />
    </>
  ) : null;
  const canLeave = view.joined && !ended;
  const hasFooter = primary !== null || canLeave || habitsFull;

  return (
    <Screen
      scroll
      footer={
        hasFooter ? (
          <>
            {primary}
            {habitsFull ? (
              <>
                <StatusNote text={t.challenge.habitsFull} tone="danger" align="center" live />
                <Button label={t.challenge.seeHabits} variant="ghost" onPress={seeHabits} />
              </>
            ) : null}
            {canLeave ? (
              <Button label={t.challenge.leave} variant="ghost" tone="danger" onPress={confirmLeave} />
            ) : null}
          </>
        ) : undefined
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.circle)} title={challenge.name} />

      <Stack gap="xs">
        <Text variant="heading">{challengeStatusText(view, t)}</Text>
        <Text variant="label" tone="secondary">
          {challengeSummaryText(view, t)}
        </Text>
        {invitedLine === null ? null : (
          <Text variant="label" tone="secondary">
            {invitedLine}
          </Text>
        )}
        {leftLine === null ? null : <StatusNote text={leftLine} live />}
      </Stack>

      {!linked || mine === null || myWeek === null ? null : (
        <Stack align="center" gap="sm">
          <ChallengeWeek
            days={mine.days}
            todayIndex={active ? todayIndex : null}
            labels={strings.format.weekdayInitials}
            size="lg"
            photos={minePhotos}
            onOpenPhoto={openPhoto}
          />
          <Stack align="center" gap="xs">
            <Text variant="heading">{t.challenge.progress(mine.done, mine.target)}</Text>
            <Text variant="label" tone="secondary">
              {active
                ? challengeOutlookText(myWeek.outlook, t)
                : ended
                  ? t.challenge.ended.lastWeek
                  : t.challenge.outlook.notStarted}
            </Text>
          </Stack>
        </Stack>
      )}

      {slot === null ? null : (
        <ListGroup>
          <ListRow
            leading={
              slot.existing === null ? (
                <PhotoTile variant="add" />
              ) : (
                <PhotoTile uri={thumbUriOf(slot.existing)} muted />
              )
            }
            label={
              slot.existing === null
                ? slot.which === 'today'
                  ? p.row.addToday
                  : p.row.addYesterday
                : slot.which === 'today'
                  ? p.row.changeToday
                  : p.row.changeYesterday
            }
            description={slot.existing === null ? p.row.optional : undefined}
            kind="action"
            onPress={addPhoto}
          />
        </ListGroup>
      )}

      {ended ? (
        <Section title={t.challenge.ended.title}>
          {weeks.length === 0 ? null : (
            <Card>
              <Stack gap="sm">
                <Text variant="body" weight="medium">
                  {t.challenge.ended.weeks(challengeWeeksMet(weeks).met, weeks.length)}
                </Text>
                <ChallengeWeek days={weeks.map((week) => week.met)} todayIndex={null} />
              </Stack>
            </Card>
          )}
          {albumRows.length === 0 ? null : (
            <Section title={groupAlbum ? p.album.groupTitle : p.album.title}>
              <PhotoMosaic
                rows={albumRows.map((row) => ({
                  key: row.id,
                  // Whose row, once there is more than one person's; no counts, no order but theirs.
                  label: groupAlbum ? (row.isMe ? t.member.me : row.name) : undefined,
                  photos: row.photos.map((photo) => ({
                    key: photo.id,
                    uri: thumbUriOf(photo),
                    label: photoDayNumber(photo.dayKey),
                    accessibilityLabel: row.isMe
                      ? p.viewer.mineA11y(photoDayText(photo.dayKey, tag, p))
                      : p.viewer.theirsA11y(row.name, photoDayText(photo.dayKey, tag, p)),
                    onPress: () => openPhoto(photo.id),
                  })),
                }))}
              />
              <StatusNote
                text={albumLive && albumUntil !== null ? p.album.until(photosUntilText(albumUntil, tag)) : p.album.note}
              />
            </Section>
          )}
          <ListGroup>
            {/* Running it again is for someone who took part; archiving is for everyone. */}
            {weeks.length === 0 ? null : (
              <ListRow icon="repeat" label={t.challenge.ended.repeat(duration)} onPress={repeat} />
            )}
            <ListRow
              icon="archive"
              label={t.challenge.ended.archive}
              tone="danger"
              kind="action"
              onPress={confirmArchive}
            />
          </ListGroup>
        </Section>
      ) : null}

      <Section title={t.challenge.thisWeek}>
        {nudgesReceived.names.length > 0 ? (
          <Text variant="label" tone="secondary">
            {t.challenge.nudgedYou(nudgesReceived.names)}
          </Text>
        ) : null}
        {others.length === 0 ? (
          <>
            <StatusNote kind="empty" text={t.challengeNew.noMembers} />
            <ListGroup>
              <ListRow icon="user-plus" label={t.list.invite} onPress={() => router.push('/circle/invite')} />
            </ListGroup>
          </>
        ) : (
          <StandingsList
            standings={others}
            todayIndex={todayIndex}
            nudge={
              canNudge
                ? { todayIndex, givenTo: nudgesGiven, onNudge: (toId) => nudge(toId, challenge.id, Date.now()) }
                : undefined
            }
            photos={
              othersPhotos
                ? {
                    of: (standing) => weekPhotos(visiblePhotos, standing.id, weekKeys, standing.days),
                    onOpen: openPhoto,
                  }
                : undefined
            }
          />
        )}
        {canNudge && others.length > 0 ? <StatusNote text={t.challenge.nudgeHint} /> : null}
        {link === 'invited' ? null : (
          <StatusNote text={linked ? t.challenge.countsAsHabit : t.challenge.notJoined} />
        )}
      </Section>

      <StatusNote text={sync.reason} align="center" />

      {slot === null ? null : (
        <PhotoSourceSheet
          visible={photoSheet}
          onClose={() => setPhotoSheet(false)}
          challengeId={challenge.id}
          dayKey={slot.dayKey}
          which={slot.which}
        />
      )}
    </Screen>
  );
}
