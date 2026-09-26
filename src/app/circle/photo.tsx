import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAppStore, useChallenge, useCircleMembers, useCircleStore, usePhoto, usePhotoStore } from '../../data';
import { Button, NoticeCard, PageHeader, PhotoCard, Screen } from '../../design/components';
import { ME, type MarkSource } from '../../domain/types';
import { photoDayText, photoMarkText, photoOriginText } from '../../features/circle/challengePhotos';
import { fullUriOf } from '../../features/circle/photoUri';
import { useLocale, useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;

/**
 * One photo, opened from a square of the week or from the album (ADR-0051): in color,
 * in its card, with whose it is and the day ('Tú · martes 24'), the caption, where it
 * came from ('Con la cámara · 18:40', 'De la galería') and how the day's mark was
 * counted. The photo never changes the mark, and the page says both as facts.
 *
 * It does not swipe to the next one and nothing zooms: going back to the grid is the
 * only way through the photos (rule 6). No reactions, no counts. Your own photo can
 * be removed, after a question that says the mark stays.
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
  const removePhoto = usePhotoStore((state) => state.removePhoto);
  // Removed from here: the page is on its way out and has nothing left to say.
  const [removed, setRemoved] = useState(false);
  const back = view === null ? BACK_FALLBACK.circle : `/circle/challenge?id=${view.challenge.id}`;

  if (photo === null) {
    return (
      <Screen>
        <PageHeader onBack={() => goBack(router, back)} />
        {removed ? null : (
          <NoticeCard
            title={t.viewer.goneTitle}
            body={t.viewer.goneDescription}
            trailing="chevron"
            onPress={() => goBack(router, back)}
          />
        )}
      </Screen>
    );
  }

  const mine = photo.memberId === ME;
  const name = mine ? strings.circle.member.me : (members.find((member) => member.id === photo.memberId)?.name ?? '');
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
  if (mine) {
    // Tanda 1: nothing leaves the phone, and the viewer says it where the photo is.
    lines.push(t.preview.onlyYou);
  }

  const confirmRemove = () => {
    Alert.alert(t.viewer.removeQuestion, t.viewer.removeMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.viewer.removeConfirm,
        style: 'destructive',
        onPress: () => {
          setRemoved(true);
          removePhoto(photo.id, Date.now());
          goBack(router, back);
        },
      },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        mine ? <Button label={t.viewer.remove} variant="ghost" tone="danger" onPress={confirmRemove} /> : undefined
      }
    >
      <PageHeader onBack={() => goBack(router, back)} title={view?.challenge.name} />
      <PhotoCard
        uri={fullUriOf(photo)}
        width={photo.width}
        height={photo.height}
        title={t.viewer.whoDay(name, day)}
        caption={photo.caption === null ? null : t.viewer.caption(photo.caption)}
        lines={lines}
        accessibilityLabel={mine ? t.viewer.mineA11y(day) : t.viewer.theirsA11y(name, day)}
      />
    </Screen>
  );
}
