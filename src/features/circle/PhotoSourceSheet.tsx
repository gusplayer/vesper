import { ListGroup, ListRow, Sheet, StatusNote } from '../../design/components';
import type { DayKey, PhotoOrigin } from '../../domain/types';
import { useStrings } from '../../i18n';
import { cameraStatus } from '../../platform/camera';
import { useAddPhoto } from './useAddPhoto';

type PhotoSourceSheetProps = {
  visible: boolean;
  onClose: () => void;
  challengeId: string;
  /** The day the photo is for, and whether it is today or yesterday for the title. */
  dayKey: DayKey;
  which: 'today' | 'yesterday';
};

/**
 * "Foto de hoy": the camera first, then the library (ADR-0051 §4). The camera asks for
 * its permission when it is tapped; where there is no camera (the simulator) its row
 * is off and the reason sits under the list, and the library still works (rule 8). A
 * refusal is said in the same place. Once the photo is prepared the sheet closes and
 * the preview opens; while it is being prepared, nothing else can start.
 */
export function PhotoSourceSheet({ visible, onClose, challengeId, dayKey, which }: PhotoSourceSheetProps) {
  const t = useStrings().photos;
  const adder = useAddPhoto({ challengeId, dayKey });
  const camera = cameraStatus();

  const close = () => {
    adder.clearProblem();
    onClose();
  };

  const choose = async (origin: PhotoOrigin) => {
    if (await adder.add(origin)) {
      close();
    }
  };

  return (
    <Sheet visible={visible} title={which === 'today' ? t.sheet.today : t.sheet.yesterday} onClose={close}>
      <ListGroup>
        <ListRow
          icon="camera"
          label={t.sheet.take}
          kind="action"
          disabled={!camera.available || adder.busy}
          onPress={() => void choose('camera')}
        />
        <ListRow
          icon="image"
          label={t.sheet.pick}
          kind="action"
          disabled={adder.busy}
          onPress={() => void choose('library')}
        />
      </ListGroup>
      {camera.available || camera.reason === null ? null : <StatusNote text={camera.reason} icon="info" />}
      {adder.preparing ? <StatusNote text={t.sheet.preparing} live /> : null}
      {adder.problem === null ? null : (
        <StatusNote text={adder.problem.text} tone={adder.problem.failed ? 'danger' : 'secondary'} live />
      )}
    </Sheet>
  );
}
