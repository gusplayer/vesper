import { ListGroup, ListRow, Sheet } from '../../design/components';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';
import { appsSource } from './realBlocking';

type ModeSheetProps = {
  visible: boolean;
  title: string;
  modes: readonly Mode[];
  /** The chosen mode, or null when none is (or it was deleted). */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** With no modes to choose, the one row: make one. */
  onCreate: () => void;
  createLabel: string;
};

/**
 * Choosing a mode for something else (a routine): every mode with what it really
 * blocks and the green check of the chosen one, like the mode sheet on Focus. With no
 * modes at all the sheet is not an empty card: it offers to create one.
 */
export function ModeSheet({ visible, title, modes, selectedId, onSelect, onClose, onCreate, createLabel }: ModeSheetProps) {
  const t = useStrings();
  const blocking = blockingStatus();
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ListGroup>
        {modes.length === 0 ? (
          <ListRow label={createLabel} icon="plus" onPress={onCreate} />
        ) : (
          modes.map((mode) => {
            return (
              <ListRow
                key={mode.id}
                label={mode.name}
                description={modeSummaryText(mode, t.modes, appsSource(mode, blocking))}
                selection="radio"
                selected={mode.id === selectedId}
                checkTone="success"
                onPress={() => onSelect(mode.id)}
              />
            );
          })
        )}
      </ListGroup>
    </Sheet>
  );
}
