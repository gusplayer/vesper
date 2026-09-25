import { useState } from 'react';

import { DropdownTitle, ListGroup, ListRow, Sheet, StatusNote, Text } from '../../design/components';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';
import { blockingLineText, blockingReasonText } from '../session/blockingReach';
import { blockingReachOf } from '../session/blockingReachOf';

type ModePickerProps = {
  /** The active mode. */
  mode: Mode;
  modes: readonly Mode[];
  /** During a session the mode is read-only: the heading is plain text and no sheet opens. */
  readOnly: boolean;
  onSelect: (id: string) => void;
  /** 'Gestionar modos', the last row of the sheet. */
  onManage: () => void;
};

/**
 * The mode name on the home page, as a picker: tapping the heading opens a sheet that
 * lists every mode with a radio on the active one. Choosing one makes it active and
 * closes the sheet. Managing modes lives at the bottom of the same sheet, so the page
 * itself keeps a single line for the mode. Each row says what the mode really blocks,
 * or plainly that it blocks no apps (ADR-0047 §1).
 */
export function ModePicker({ mode, modes, readOnly, onSelect, onManage }: ModePickerProps) {
  const strings = useStrings();
  const t = strings.focus.modePicker;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const cannotBlock = blockingReasonText(blockingReachOf(mode), strings.focus.blocking);

  // Read-only is plain words, not a dimmed button: nothing here can be changed now.
  if (readOnly) {
    return <Text variant="heading">{mode.name}</Text>;
  }

  return (
    <>
      <DropdownTitle label={mode.name} size="heading" onPress={() => setOpen(true)} accessibilityLabel={t.hint} />

      <Sheet visible={open} title={t.title} onClose={close}>
        {/* A phone that cannot block is said once, above the list, not on every row. */}
        {cannotBlock === null ? null : <StatusNote icon="info" text={cannotBlock} />}
        <ListGroup>
          {modes.map((item) => (
            <ListRow
              key={item.id}
              label={item.name}
              description={blockingLineText(blockingReachOf(item), item.behavior, strings.focus.blocking)}
              selection="radio"
              selected={item.id === mode.id}
              checkTone="success"
              onPress={() => {
                onSelect(item.id);
                close();
              }}
            />
          ))}
        </ListGroup>
        <ListGroup>
          <ListRow
            label={t.manage}
            onPress={() => {
              close();
              onManage();
            }}
          />
        </ListGroup>
      </Sheet>
    </>
  );
}
