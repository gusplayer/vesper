import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

import { AlbumCard, Button, Sheet, StatusNote } from '../../design/components';
import { albumDays } from '../../domain/photos';
import type { Challenge, ChallengePhoto } from '../../domain/types';
import { useStrings } from '../../i18n';
import { captureView, cardStatus, releaseCapture } from '../../platform/share';
import { fullUriOf, thumbUriOf } from './photoUri';
import { useShareFile } from './useShareFile';

/** How long "Compartir" waits for the photos of the hidden card before capturing anyway. */
const READY_WAIT_MS = 2000;

type AlbumShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  challenge: Challenge;
  /** Your photos in its album, as "Tu álbum" draws them (on marked days). Nobody else's. */
  photos: readonly ChallengePhoto[];
};

/**
 * "Compartir tu álbum" (ADR-0051 §13, ADR-0030): the image your photos of a finished
 * challenge make, previewed as it will go out, and one button that makes it and hands it
 * to the system's sheet, where you save it or send it. Only your photos, whatever the
 * album of the group holds, and the line under the preview says so. The sheet never
 * opens on its own, and nothing counts what happens in it.
 *
 * The image is taken from a second card, the same one at 1080 × 1920 pixels, mounted
 * under the sheet while it is up (`Sheet.under`). "Compartir" waits for its photos to
 * load (or a moment, if one never answers), captures it once, and reuses that file until
 * the sheet closes, which deletes it.
 */
export function AlbumShareSheet({ visible, onClose, challenge, photos }: AlbumShareSheetProps) {
  const t = useStrings().photos.share;
  const card = cardStatus();
  const sheet = useShareFile();
  const cardRef = useRef<View>(null);
  const captured = useRef<string | null>(null);
  const ready = useRef(false);
  const waiting = useRef<(() => void)[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [failed, setFailed] = useState(false);

  const days = albumDays(challenge, photos).map((day) => ({
    key: day.dayKey,
    uri: day.photo === null ? null : (thumbUriOf(day.photo) ?? fullUriOf(day.photo)),
  }));
  const line = t.cardLine(days.length);

  const onReady = useCallback(() => {
    ready.current = true;
    for (const resolve of waiting.current.splice(0)) {
      resolve();
    }
  }, []);

  const whenReady = (): Promise<void> =>
    ready.current
      ? Promise.resolve()
      : new Promise((resolve) => {
          waiting.current.push(resolve);
          setTimeout(resolve, READY_WAIT_MS);
        });

  const share = async () => {
    setFailed(false);
    let uri = captured.current;
    if (uri === null) {
      setCapturing(true);
      await whenReady();
      uri = await captureView(cardRef);
      setCapturing(false);
      if (uri === null) {
        setFailed(true);
        return;
      }
      captured.current = uri;
    }
    await sheet.share(uri, 'image/png');
  };

  const close = () => {
    if (captured.current !== null) {
      releaseCapture(captured.current);
      captured.current = null;
    }
    ready.current = false;
    setFailed(false);
    onClose();
  };

  const cardProps = { title: challenge.name, line, wordmark: t.wordmark, days };

  return (
    <Sheet
      visible={visible}
      title={t.title}
      onClose={close}
      under={card.available ? <AlbumCard {...cardProps} purpose="capture" ref={cardRef} onReady={onReady} /> : null}
    >
      <AlbumCard {...cardProps} purpose="preview" accessibilityLabel={t.previewA11y(challenge.name)} />
      <StatusNote text={t.onlyYours} align="center" />
      <Button
        label={t.button}
        onPress={() => void share()}
        disabled={!card.available || sheet.open}
        busy={capturing}
        busyLabel={t.preparing}
      />
      {card.available || card.reason === null ? null : <StatusNote text={card.reason} icon="info" />}
      {failed ? <StatusNote text={t.failed} tone="danger" live /> : null}
      {sheet.problem === null ? null : <StatusNote text={sheet.problem} tone="danger" live />}
    </Sheet>
  );
}
