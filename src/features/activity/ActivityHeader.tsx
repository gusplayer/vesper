import { useState } from 'react';

import { Check, ListGroup, ListRow, Sheet } from '../../design/components';
import { DropdownTitle } from '../../design/components';

export type ActivityView = 'week' | 'month' | 'lifetime';

const TITLE: Record<ActivityView, string> = {
  week: 'Actividad semanal',
  month: 'Actividad mensual',
  lifetime: 'Actividad de por vida',
};

const OPTIONS: ReadonlyArray<{ key: ActivityView; label: string }> = [
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensual' },
  { key: 'lifetime', label: 'De por vida' },
];

type ActivityHeaderProps = {
  view: ActivityView;
  onChangeView: (view: ActivityView) => void;
};

/** The tab's title with a chevron, and the 'Ver' sheet it opens. */
export function ActivityHeader({ view, onChangeView }: ActivityHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownTitle
        label={TITLE[view]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Elegir qué actividad ver"
      />
      <Sheet visible={open} title="Ver" onClose={() => setOpen(false)}>
        <ListGroup>
          {OPTIONS.map((option) => (
            <ListRow
              key={option.key}
              label={option.label}
              right={<Check checked={option.key === view} />}
              onPress={() => {
                onChangeView(option.key);
                setOpen(false);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </>
  );
}
