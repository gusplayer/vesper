import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  useAppStore,
  useChallenge,
  useCircleStore,
  usePhotoAudience,
  usePhotoDraftStore,
  usePhotoStore,
} from '../../data';
import { Button, FieldRow, PageHeader, PhotoCard, Screen, StatusNote } from '../../design/components';
import { dayKeyOf } from '../../domain/day';
import { cleanCaption, PHOTO_CAPTION_MAX, photoSlot } from '../../domain/photos';
import { isQueuedPhoto, usePhotoTermsAccepted } from '../../features/circle/photoSharing';
import { fullUriOf } from '../../features/circle/photoUri';
import { useAddPhoto } from '../../features/circle/useAddPhoto';
import { useChallengeLink } from '../../features/circle/useChallengeLink';
import { useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;

/**
 * The photo before it is saved (ADR-0051): in color, at the width of its card, with an
 * optional caption of one line and who will see it, by name — "La ven Ana y Luis, solo
 * en este reto." — or "Solo la ves tú." when nobody else will (photos off, nobody else
 * joined, or no account to send it with). Shared, the one button says where it goes,
 * "Agregar al reto", and a line says it waits for a connection when the last sync did
 * not reach the server or other photos are still queued; kept here, it says "Guardar".
 * "Tomar otra" or "Elegir otra" (the way it came) replaces it here without leaving.
 *
 * A shared photo whose terms were never accepted (somebody joined after the row was
 * tapped) goes through `circle/photo-terms` first and comes back here, draft intact.
 *
 * The draft lives in `usePhotoDraftStore` and its files are already written. Leaving
 * without saving — the chevron, the gesture, Android's back — deletes them when the
 * page goes; saving hands them to the photo. Reached with no draft (a cold launch), the
 * page goes back at once. If the day stops taking a photo while it is open (unmarked,
 * or two midnights went by), the line says so and nothing can be saved.
 */
export default function NewPhotoScreen() {
  const router = useRouter();
  const t = useStrings().photos;
  const now = useNow(CLOCK_MS);
  const draft = usePhotoDraftStore((state) => state.draft);
  const savePhoto = usePhotoStore((state) => state.savePhoto);
  const habitMarks = useAppStore((state) => state.habitMarks);
  const view = useChallenge(draft?.challengeId, now);
  const link = useChallengeLink(view?.challenge ?? null);
  const [caption, setCaption] = useState('');
  // Saved once: a second tap must not save again or go back twice.
  const [saved, setSaved] = useState(false);
  const adder = useAddPhoto(draft === null ? null : { challengeId: draft.challengeId, dayKey: draft.dayKey }, false);
  const audience = usePhotoAudience(draft?.challengeId);
  const termsAccepted = usePhotoTermsAccepted();
  const syncFailed = useCircleStore((state) => state.syncFailed);
  const queueWaits = usePhotoStore((state) => state.photos.some(isQueuedPhoto));

  // Nothing to show: this page only exists between taking a photo and saving it.
  useEffect(() => {
    if (usePhotoDraftStore.getState().draft === null) {
      goBack(router, BACK_FALLBACK.circle);
    }
  }, [router]);

  // Leaving unsaved deletes the draft's files. After "Guardar" the draft is already
  // gone (the photo took it), and this does nothing.
  useEffect(() => () => usePhotoDraftStore.getState().discard(), []);

  if (draft === null || view === null) {
    return (
      <Screen>
        <PageHeader onBack={() => goBack(router, BACK_FALLBACK.circle)} />
      </Screen>
    );
  }

  const { challenge } = view;
  const todayKey = dayKeyOf(now);
  const marked =
    challenge.habitId !== null &&
    habitMarks.some((mark) => mark.habitId === challenge.habitId && mark.dayKey === draft.dayKey);
  const canSave =
    photoSlot({
      challenge,
      linked: link === 'linked',
      active: view.status === 'active',
      marked,
      dayKey: draft.dayKey,
      todayKey,
    }) === 'ok';
  const back = `/circle/challenge?id=${challenge.id}`;
  // Who will see it: the people who joined and can open it, never whoever joins later.
  const shared = challenge.photos && audience.length > 0;
  const lines = shared
    ? [t.preview.audience(audience), ...(syncFailed || queueWaits ? [t.preview.queued] : [])]
    : [t.preview.onlyYou];

  const save = () => {
    if (saved) {
      return;
    }
    if (shared && !termsAccepted) {
      router.push('/circle/photo-terms');
      return;
    }
    setSaved(true);
    savePhoto(
      {
        challengeId: draft.challengeId,
        dayKey: draft.dayKey,
        prepared: draft.prepared,
        origin: draft.picked.origin,
        caption: cleanCaption(caption),
        id: draft.id,
      },
      Date.now(),
    );
    goBack(router, back);
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={
        <>
          {canSave || saved ? null : <StatusNote text={t.preview.slotGone} align="center" live />}
          <Button
            label={shared ? t.preview.add : t.preview.save}
            onPress={save}
            disabled={!canSave || adder.busy || saved}
          />
          {adder.preparing ? <StatusNote text={t.sheet.preparing} align="center" live /> : null}
          {adder.problem === null ? null : (
            <StatusNote
              text={adder.problem.text}
              tone={adder.problem.failed ? 'danger' : 'secondary'}
              align="center"
              live
            />
          )}
          <Button
            label={draft.picked.origin === 'camera' ? t.preview.retake : t.preview.repick}
            variant="ghost"
            disabled={adder.busy || saved}
            onPress={() => void adder.add(draft.picked.origin)}
          />
        </>
      }
    >
      <PageHeader
        onBack={() => goBack(router, back)}
        title={draft.dayKey === todayKey ? t.sheet.today : t.sheet.yesterday}
      />
      <PhotoCard
        uri={fullUriOf(draft.prepared)}
        width={draft.prepared.width}
        height={draft.prepared.height}
        lines={lines}
        frame="preview"
        accessibilityLabel={t.preview.photoA11y}
      />
      <FieldRow
        label={t.preview.caption}
        value={caption}
        onChangeText={setCaption}
        placeholder={t.preview.captionPlaceholder}
        maxLength={PHOTO_CAPTION_MAX}
        returnKeyType="done"
      />
    </Screen>
  );
}
