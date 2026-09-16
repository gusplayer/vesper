import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Check, Icon, ListGroup, ListRow, Sheet, Stack, Text } from '../../design/components';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';

type ModePickerProps = {
  /** The active mode. */
  mode: Mode;
  modes: ReadonlyArray<Mode>;
  /** During a session the mode is read-only: the heading is plain text and no sheet opens. */
  readOnly: boolean;
  onSelect: (id: string) => void;
  /** 'Manage modes ›', the last row of the sheet. */
  onManage: () => void;
};

/**
 * The mode name on the home page, as a picker: tapping the heading opens a sheet that
 * lists every mode with a radio on the active one. Choosing one makes it active and
 * closes the sheet. Managing modes lives at the bottom of the same sheet, so the page
 * itself keeps a single line for the mode.
 */
export function ModePicker({ mode, modes, readOnly, onSelect, onManage }: ModePickerProps) {
  const strings = useStrings();
  const t = strings.focus.modePicker;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const heading = <Text variant="heading">{mode.name}</Text>;

  if (readOnly) {
    return heading;
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t.label(mode.name)}
      >
        <Stack direction="row" align="center" gap="xs">
          {heading}
          <Icon name="chevron-down" size="sm" tone="secondary" />
        </Stack>
      </Pressable>

      <Sheet visible={open} title={t.title} onClose={close}>
        <ListGroup>
          {modes.map((item) => (
            <ListRow
              key={item.id}
              label={item.name}
              description={modeSummaryText(item, strings.modes)}
              right={<Check checked={item.id === mode.id} tone="success" />}
              onPress={() => {
                onSelect(item.id);
                close();
              }}
            />
          ))}
        </ListGroup>
        <Button
          variant="ghost"
          label={t.manage}
          onPress={() => {
            close();
            onManage();
          }}
        />
      </Sheet>
    </>
  );
}
