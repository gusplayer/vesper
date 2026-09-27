import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useCircleStore, usePhotoFetch, usePhotoStore, type PhotoFetchFailure } from '../../data';
import type { ChallengePhoto, PhotoShare } from '../../domain/types';
import { useStrings } from '../../i18n';
import { blockCircleMember } from '../../platform/hooks/useCircleSync';
import { ensureChallengeThumbs, ensureFullPhoto, reportPhoto } from '../../platform/photoSync';
import type { ReportReason, ReportSent } from './PhotoOptionsSheet';

/**
 * What the photo screens ask of the shared photos (ADR-0051, tanda 2), in one place:
 * downloads that start only when a challenge or a photo is opened, the report, the block,
 * hiding a person's photos and the terms of the first shared photo. The sync behind them
 * lives in `platform/photoSync` and the stores; the screens only see these names.
 */

/** Whether the photo went, or is going, to the challenge: removing it deletes it for everyone. */
export function isSharedPhoto(photo: Pick<PhotoShare, 'remoteState'>): boolean {
  return photo.remoteState !== 'local';
}

/**
 * The user's photo still has to reach the server — queued, or its row there and its
 * files not yet: no connection, or the queue has not run since.
 */
export function isQueuedPhoto(photo: Pick<PhotoShare, 'remoteState'>): boolean {
  return photo.remoteState === 'queued' || photo.remoteState === 'posted';
}

/** The people whose photos the user hid, only on this phone (Ajustes › Círculo shows them). */
export function useHiddenMembers(): ReadonlySet<string> {
  const hidden = usePhotoStore((state) => state.hiddenMembers);
  return new Set(hidden);
}

/** Whether "Entendido" was ever tapped on `circle/photo-terms`. */
export function usePhotoTermsAccepted(): boolean {
  return usePhotoStore((state) => state.termsAcceptedAt !== null);
}

/** The same, read once, outside a render (the challenge's page coming back into view). */
export function photoTermsAccepted(): boolean {
  return usePhotoStore.getState().termsAcceptedAt !== null;
}

/** "Entendido": kept once, for every challenge after. */
export function acceptPhotoTerms(now: number): void {
  usePhotoStore.getState().acceptTerms(now);
}

/** "Ocultar las fotos de Ana" and its way back in Ajustes › Círculo. Only on this phone. */
export function hideMemberPhotos(memberId: string, now: number): void {
  usePhotoStore.getState().hideMember(memberId, now);
}

export function showMemberPhotos(memberId: string, now: number): void {
  usePhotoStore.getState().showMember(memberId, now);
}

/**
 * The thumbnails of the challenge's photos that are not on this phone yet, downloaded
 * when the page comes into view and again when new ones arrive while it is open.
 * `waitingKey` names the ones still missing (their ids, joined); empty, there is nothing
 * to ask for. Never in the background, never by push (ADR-0051 §8). A failed download
 * is tried again the next time the page opens.
 */
export function useChallengeThumbs(challengeId: string | undefined, waitingKey: string): void {
  useFocusEffect(
    useCallback(() => {
      if (challengeId !== undefined && waitingKey !== '') {
        void ensureChallengeThumbs(challengeId);
      }
    }, [challengeId, waitingKey]),
  );
}

export type FullPhotoState = {
  /** The full photo is on its way: the card holds its frame (with the thumbnail, if any). */
  downloading: boolean;
  /** Why the last try did not bring it: no connection, gone from the server, no key, or failed. */
  failure: PhotoFetchFailure | null;
};

/**
 * The full photo, downloaded when the viewer opens it and not before (ADR-0051). Your
 * own photos are already here; someone else's, or yours after a restore, come down now.
 * Opening it again tries again.
 */
export function useFullPhoto(photo: Pick<ChallengePhoto, 'id' | 'fullFile'> | null): FullPhotoState {
  const id = photo?.id;
  const missing = photo !== null && photo.fullFile === null;
  const fetch = usePhotoFetch(id, 'full');

  useEffect(() => {
    if (id !== undefined && missing) {
      void ensureFullPhoto(id);
    }
  }, [id, missing]);

  return {
    downloading: missing && (fetch.loading || fetch.failure === null),
    failure: missing && !fetch.loading ? fetch.failure : null,
  };
}

/**
 * "Reportar la foto": the reason, the note and the key of that one photo go to the
 * server, which checks the key opens it and never says who reported. The photo is
 * hidden here at once. Null when nothing could be sent or kept to send.
 */
export async function sendPhotoReport(
  photoId: string,
  reason: ReportReason,
  note: string | null,
): Promise<ReportSent | null> {
  const outcome = await reportPhoto(photoId, reason, note);
  return outcome === 'sent' || outcome === 'queued' ? outcome : null;
}

/**
 * "Bloquear a Ana", from the photo's "…" or next to "Quitar": a destructive question
 * first, then the link ends here and on the server, and the person cannot ask to come
 * back (ADR-0051 §18). `line` is what did not reach the server yet, said once.
 */
export function useBlockMember(): {
  confirmBlock: (member: { id: string; name: string }, onBlocked?: () => void) => void;
  line: string | null;
} {
  const strings = useStrings();
  const t = strings.photos.block;
  const [line, setLine] = useState<string | null>(null);

  const confirmBlock = (member: { id: string; name: string }, onBlocked?: () => void) => {
    Alert.alert(t.question(member.name), t.message, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.confirm,
        style: 'destructive',
        onPress: () => {
          setLine(null);
          useCircleStore.getState().blockMember(member.id, Date.now());
          onBlocked?.();
          void blockCircleMember(member.id).then((outcome) => {
            setLine(outcome === 'queued' ? t.queued : null);
          });
        },
      },
    ]);
  };

  return { confirmBlock, line };
}
