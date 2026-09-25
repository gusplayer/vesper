import { useState } from 'react';

import { DropdownTitle, ListGroup, ListRow, Sheet } from '../../design/components';
import { useStrings } from '../../i18n';

export type ActivityView = 'week' | 'month' | 'lifetime';

const VIEWS: readonly ActivityView[] = ['week', 'month', 'lifetime'];

type ActivityHeaderProps = {
  view: ActivityView;
  onChangeView: (view: ActivityView) => void;
};

/** The tab's title with a chevron, and the 'Ver' sheet it opens. */
export function ActivityHeader({ view, onChangeView }: ActivityHeaderProps) {
  const t = useStrings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownTitle
        label={t.activity.header.title[view]}
        onPress={() => setOpen(true)}
        accessibilityLabel={t.activity.header.chooseView}
      />
      <Sheet visible={open} title={t.activity.header.sheetTitle} onClose={() => setOpen(false)}>
        <ListGroup>
          {VIEWS.map((option) => (
            <ListRow
              key={option}
              label={t.activity.header.option[option]}
              selection="radio"
              selected={option === view}
              onPress={() => {
                onChangeView(option);
                setOpen(false);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </>
  );
}
