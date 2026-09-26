import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  useAppStore,
  useChallenge,
  useCircleMembers,
  useCircleStore,
  useKudosGivenToday,
  usePhoto,
  usePhotoAudience,
  usePhotoStore,
} from '../../data';
import {
  Button,
  IconCircle,
  NoticeCard,
  PageHeader,
  PhotoCard,
  Screen,
  StatusNote,
} from '../../design/components';
import { photoVisible } from '../../domain/photoSharing';
import { ME, type MarkSource } from '../../domain/types';
import { photoDayText, photoMarkText, photoOriginText } from '../../features/circle/challengePhotos';
import { CheerButton } from '../../features/circle/CheerButton';
import { PhotoOptionsSheet, type ReportSent } from '../../features/circle/PhotoOptionsSheet';
import {
  hideMemberPhotos,
  isQueuedPhoto,
  isSharedPhoto,
  sendPhotoReport,
  useBlockMember,
  useFullPhoto,
  useHiddenMembers,
} from '../../features/circle/photoSharing';
import { fullUriOf, thumbUriOf } from '../../features/circle/photoUri';
import { useLocale, useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;

/** What the page says once the photo left it from here: the viewer has no photo to show. */
type Left =
  | { kind: 'removed' }
  | { kind: 'reported'; sent: ReportSent }
  | { kind: 'hidden'; name: string }
  | { kind: 'blocked' };

/**
 * One photo, opened from a square of a week or from the album (ADR-0051): in color, in
 * its card, with whose it is and the day ('Ana · martes 24'), the caption, where it came
 * from ('Con la cámara · 18:40', 'De la galería') and how the day's mark was counted.
 * The photo never changes the mark, and the page says both as facts.
 *
 * It does not swipe to the next one and nothing zooms: going back to the grid is the
 * only way through the photos (rule 6). No reactions, no counts, no "seen by".
 *
 * **Someone else's photo** comes down in full only now, when it is opened; until then
 * the card holds the thumbnail (or its empty frame), and without a connection a line
 * says why. The one gesture is "Dar ánimo" — the daily cheer, to the person and not to
 * the photo, "Enviado" once given today. The "…" reports the photo (it is gone from here
 * at once), hides that person's photos for you, or blocks them after a question.
 *
 * **Your own** says who sees it: "Solo la ves tú." while it stays here, the names once
 * it goes out, and that it waits for a connection while it is queued. Removing it asks
 * first, and once it went out the question says it is deleted for everyone.
 */
export default function PhotoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const strings = useStrings();
  const t = strings.photos;
  const { tag } = useLocale();
  const now = useNow(CLOCK_MS);
  const photo = usePhoto(id);
  const view = useChallenge(photo?.challengeId, now);
  const members = useCircleMembers();
  const habitMarks = useAppStore((state) => state.habitMarks);
  const challengeMarks = useCircleStore((state) => state.challengeMarks);
  const kudosGiven = useKudosGivenToday(now);
  const removePhoto = usePhotoStore((state) => state.removePhoto);
  const audience = usePhotoAudience(photo?.challengeId);
  const hidden = useHiddenMembers();
  const full = useFullPhoto(photo);
  const block = useBlockMember();
  const [options, setOptions] = useState(false);
  // Once the photo left the page from here, the page says why instead of "ya no está".
  const [left, setLeft] = useState<Left | null>(null);
  // Kept from the moment the photo was open: after it is gone, going back still knows where.
  const [challengeId] = useState(() => photo?.challengeId ?? null);
  const back = challengeId === null ? BACK_FALLBACK.circle : `/circle/challenge?id=${challengeId}`;
  const goToChallenge = () => goBack(router, back);

  // Hidden, without a key this phone can open, or past the day the server keeps it: gone.
  if (left !== null || photo === null || !photoVisible(photo, { hidden, now })) {
    const notice =
      left === null || left.kind === 'blocked'
        ? { title: t.viewer.goneTitle, body: t.viewer.goneDescription }
        : left.kind === 'reported'
          ? { title: left.sent === 'sent' ? t.viewer.reported : t.viewer.reportedQueued, body: t.viewer.goneDescription }
          : left.kind === 'hidden'
            ? { title: t.viewer.hidden(left.name), body: t.viewer.hiddenBody }
            : null;
    return (
      <Screen>
        <PageHeader onBack={goToChallenge} />
        {notice === null ? null : (
          <NoticeCard title={notice.title} body={notice.body} trailing="chevron" onPress={goToChallenge} />
        )}
      </Screen>
    );
  }

  const mine = photo.memberId === ME;
  const member = mine ? null : (members.find((candidate) => candidate.id === photo.memberId) ?? null);
  const name = mine ? strings.circle.member.me : (member?.name ?? '');
  const day = photoDayText(photo.dayKey, tag, t);
  const habitId = view?.challenge.habitId ?? null;
  // The day's mark, as it was counted: the user's habit, or the member's challenge mark.
  const source: MarkSource | null = mine
    ? habitId === null
      ? null
      : (habitMarks.find((mark) => mark.habitId === habitId && mark.dayKey === photo.dayKey)?.source ?? null)
    : (challengeMarks.find(
        (mark) =>
          mark.challengeId === photo.challengeId && mark.memberId === photo.memberId && mark.dayKey === photo.dayKey,
      )?.source ?? null);
  const markLine = photoMarkText(source, t);
  const lines = [photoOriginText(photo, tag, t), ...(markLine === null ? [] : [markLine])];
  const shared = mine && isSharedPhoto(photo);
  if (mine) {
    // Who sees it: nobody else while it stays here; the people who joined once it goes.
    lines.push(shared && audience.length > 0 ? t.preview.audience(audience) : t.preview.onlyYou);
    if (isQueuedPhoto(photo)) {
      lines.push(t.preview.queued);
    }
  }
  // While the full photo comes down, the thumbnail holds the frame.
  const uri = fullUriOf(photo) ?? thumbUriOf(photo);
  // The cheer goes to someone still in the circle, once a day (ADR-0021 §5).
  const cheerTo = member !== null && member.status === 'member' ? member : null;
  const cheered = cheerTo !== null && kudosGiven.has(cheerTo.id);

  const confirmRemove = () => {
    Alert.alert(t.viewer.removeQuestion, shared ? t.viewer.removeSharedMessage : t.viewer.removeMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.viewer.removeConfirm,
        style: 'destructive',
        onPress: () => {
          setLeft({ kind: 'removed' });
          removePhoto(photo.id, Date.now());
          goToChallenge();
        },
      },
    ]);
  };

  const hide = () => {
    setOptions(false);
    hideMemberPhotos(photo.memberId, Date.now());
    setLeft({ kind: 'hidden', name });
  };

  // The question rises over the sheet; confirmed, the person is gone and so is the photo.
  const confirmBlock = () => {
    if (member === null) {
      return;
    }
    block.confirmBlock({ id: member.id, name: member.name }, () => {
      setOptions(false);
      setLeft({ kind: 'blocked' });
      goToChallenge();
    });
  };

  return (
    <Screen
      scroll
      footer={
        mine ? <Button label={t.viewer.remove} variant="ghost" tone="danger" onPress={confirmRemove} /> : undefined
      }
    >
      <PageHeader
        onBack={goToChallenge}
        title={view?.challenge.name}
        right={
          mine ? undefined : (
            <IconCircle name="more-horizontal" onPress={() => setOptions(true)} accessibilityLabel={t.viewer.moreA11y} />
          )
        }
      />
      <PhotoCard
        uri={uri}
        width={photo.width}
        height={photo.height}
        title={t.viewer.whoDay(name, day)}
        caption={photo.caption === null ? null : t.viewer.caption(photo.caption)}
        lines={lines}
        accessibilityLabel={mine ? t.viewer.mineA11y(day) : t.viewer.theirsA11y(name, day)}
      />
      {full.downloading ? <StatusNote text={t.viewer.downloading} live /> : null}
      {full.failure === null ? null : <StatusNote text={t.viewer.downloadProblem[full.failure]} live />}
      {cheerTo === null ? null : <CheerButton member={cheerTo} given={cheered} />}

      {mine ? null : (
        <PhotoOptionsSheet
          visible={options}
          onClose={() => setOptions(false)}
          name={name}
          onReport={(reason, note) => sendPhotoReport(photo.id, reason, note)}
          onReported={(sent) => setLeft({ kind: 'reported', sent })}
          onHide={member === null ? undefined : hide}
          onBlock={member === null ? undefined : confirmBlock}
        />
      )}
    </Screen>
  );
}
