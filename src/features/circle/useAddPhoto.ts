import { useRouter } from 'expo-router';
import { useState } from 'react';

import { usePhotoDraftStore } from '../../data';
import type { DayKey, PhotoOrigin } from '../../domain/types';
import { useStrings } from '../../i18n';
import { uuidv7 } from '../../lib/uuid';
import { cameraStatus, pickPhoto, preparePhoto, status, takePhoto } from '../../platform/camera';

/** The day of a challenge the photo is for: today or yesterday, marked (`useMyPhotoSlot`). */
export type PhotoTarget = { challengeId: string; dayKey: DayKey };

export type AddPhoto = {
  /** The system picker is up, or the photo is being prepared: nothing else should start. */
  busy: boolean;
  /** Resizing and writing the files, which can take a beat on a big photo. */
  preparing: boolean;
  /**
   * Why the last try gave nothing, in one line: denied or unavailable (a state, said
   * plainly) or failed (said in the danger tone). Null otherwise.
   */
  problem: { text: string; failed: boolean } | null;
  /** Takes or picks, prepares, and leaves the draft in the store. True once it is there. */
  add: (origin: PhotoOrigin) => Promise<boolean>;
  clearProblem: () => void;
};

type Phase = 'idle' | 'picking' | 'preparing';

/**
 * The road from "Tomar una foto" or "Elegir de tu galería" to the preview (ADR-0051):
 * the camera asks for its permission right here, when it is tapped (rule 8); the
 * library goes through the system picker, which asks for nothing. The photo is
 * resized, stripped of its metadata and written under a fresh id, and becomes the
 * draft `circle/photo-new` shows. A cancelled picker leaves everything as it was.
 *
 * `open` pushes the preview once the draft is ready; the preview itself passes false
 * when it replaces its photo ("Tomar otra"), and the draft it held is deleted then,
 * not before, so cancelling the second try keeps the first.
 */
export function useAddPhoto(target: PhotoTarget | null, open = true): AddPhoto {
  const router = useRouter();
  const t = useStrings().photos;
  const [phase, setPhase] = useState<Phase>('idle');
  const [problem, setProblem] = useState<AddPhoto['problem']>(null);

  const add = async (origin: PhotoOrigin): Promise<boolean> => {
    if (target === null || phase !== 'idle') {
      return false;
    }
    setProblem(null);
    setPhase('picking');
    const outcome = await (origin === 'camera' ? takePhoto() : pickPhoto());
    if (outcome === 'cancelled') {
      setPhase('idle');
      return false;
    }
    if (outcome === 'denied') {
      setPhase('idle');
      setProblem({ text: origin === 'camera' ? t.sheet.cameraDenied : t.sheet.libraryDenied, failed: false });
      return false;
    }
    if (outcome === 'unavailable') {
      setPhase('idle');
      const reason = (origin === 'camera' ? cameraStatus() : status()).reason;
      setProblem({ text: reason ?? (origin === 'camera' ? t.cameraUnavailable : t.pickerUnavailable), failed: false });
      return false;
    }

    setPhase('preparing');
    const id = uuidv7();
    try {
      const prepared = await preparePhoto(outcome, id);
      // A draft that was showing loses its files only now, when there is a new one.
      usePhotoDraftStore
        .getState()
        .setDraft({ id, challengeId: target.challengeId, dayKey: target.dayKey, picked: outcome, prepared });
    } catch {
      setPhase('idle');
      setProblem({ text: t.sheet.failed, failed: true });
      return false;
    }
    setPhase('idle');
    if (open) {
      router.push('/circle/photo-new');
    }
    return true;
  };

  return {
    busy: phase !== 'idle',
    preparing: phase === 'preparing',
    problem,
    add,
    clearProblem: () => setProblem(null),
  };
}
