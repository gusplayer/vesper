import { useState } from 'react';

import { useStrings } from '../../i18n';
import { shareFile, type ShareMime } from '../../platform/share';

/**
 * The system's share sheet for a file of yours (ADR-0051 §13): a photo from the viewer,
 * the album's image from its sheet. One at a time: while a sheet is up, `open` holds the
 * control that opened it (expo-sharing refuses a second). It only says when the sheet
 * would not open; what the person did in it is theirs, and nothing records it.
 */
export function useShareFile(): {
  open: boolean;
  problem: string | null;
  share: (uri: string, mimeType: ShareMime) => Promise<void>;
} {
  const t = useStrings().photos.share;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const share = async (uri: string, mimeType: ShareMime): Promise<void> => {
    if (open) {
      return;
    }
    setOpen(true);
    setFailed(false);
    const outcome = await shareFile(uri, mimeType);
    setOpen(false);
    setFailed(outcome !== 'closed');
  };

  return { open, problem: failed ? t.shareFailed : null, share };
}
