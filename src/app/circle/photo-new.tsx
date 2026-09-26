import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAppStore, useChallenge, usePhotoDraftStore, usePhotoStore } from '../../data';
import { Button, FieldRow, PageHeader, PhotoCard, Screen, StatusNote } from '../../design/components';
import { dayKeyOf } from '../../domain/day';
import { cleanCaption, PHOTO_CAPTION_MAX, photoSlot } from '../../domain/photos';
import { fullUriOf } from '../../features/circle/photoUri';
import { useAddPhoto } from '../../features/circle/useAddPhoto';
import { useChallengeLink } from '../../features/circle/useChallengeLink';
import { useStrings } from '../../i18n';
import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;

/**
 * The photo before it is saved (ADR-0051): in color, at the width of its card, with an
 * optional caption of one line and the promise that holds in this first step — only
 * you see it. "Guardar" pins it to the day; "Tomar otra" or "Elegir otra" (the way it
 * came) replaces it here without leaving.
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

  const save = () => {
    if (saved) {
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
          <Button label={t.preview.save} onPress={save} disabled={!canSave || adder.busy || saved} />
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
        lines={[t.preview.onlyYou]}
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
