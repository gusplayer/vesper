import { useState } from 'react';

import {
  Button,
  Check,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SearchField,
  Section,
  Text,
} from '../../design/components';
import { AppRow } from '../../design/components';
import { MAX_SELECTION } from '../../data/modeDraft';
import { useStrings } from '../../i18n';

export type PickerItem = {
  id: string;
  label: string;
  /** The category under an app's name. Websites have none. */
  description?: string;
  /** An app tile on the left; without it the row is plain text. */
  tile?: { initial: string; color: string };
};

type SelectionPickerProps = {
  title: string;
  searchPlaceholder: string;
  /** Everything that can be picked; searched in full. */
  items: ReadonlyArray<PickerItem>;
  /** What the second section lists when not searching; defaults to every item. */
  featured?: ReadonlyArray<PickerItem>;
  selectedIds: ReadonlyArray<string>;
  /** 'Seleccionadas' / 'Seleccionados'. */
  selectedTitle: string;
  /** 'Todas' / 'Populares'. */
  listTitle: string;
  onToggle: (id: string) => void;
  onBack: () => void;
  onDone: () => void;
  /** Defaults to `common.done`. */
  doneLabel?: string;
};

function matches(item: PickerItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return (
    item.label.toLowerCase().includes(needle) ||
    (item.description?.toLowerCase().includes(needle) ?? false)
  );
}

/**
 * The picker behind modes/apps and modes/websites: a search, the chosen items on
 * top with a count against the cap, then the catalogue. Rows toggle on tap.
 */
export function SelectionPicker({
  title,
  searchPlaceholder,
  items,
  featured,
  selectedIds,
  selectedTitle,
  listTitle,
  onToggle,
  onBack,
  onDone,
  doneLabel,
}: SelectionPickerProps) {
  const t = useStrings();
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const results = items.filter((item) => matches(item, query));

  const row = (item: PickerItem) => {
    const checked = selectedIds.includes(item.id);
    const check = <Check checked={checked} shape="box" />;
    const toggle = () => onToggle(item.id);
    if (item.tile === undefined) {
      return <ListRow key={item.id} label={item.label} right={check} onPress={toggle} />;
    }
    return (
      <AppRow
        key={item.id}
        initial={item.tile.initial}
        color={item.tile.color}
        name={item.label}
        description={item.description}
        right={check}
        onPress={toggle}
      />
    );
  };

  return (
    <Screen scroll footer={<Button label={doneLabel ?? t.common.done} onPress={onDone} />}>
      <PageHeader onBack={onBack} title={title} />
      <SearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
      {searching ? (
        <Section title={t.modes.picker.results}>
          {results.length === 0 ? (
            <Text variant="label" tone="secondary">
              {t.modes.picker.noResults}
            </Text>
          ) : (
            <ListGroup>{results.map(row)}</ListGroup>
          )}
        </Section>
      ) : (
        <>
          <Section
            title={selectedTitle}
            right={
              <Text variant="label" tone="secondary">
                {`${selected.length} / ${MAX_SELECTION}`}
              </Text>
            }
          >
            {selected.length === 0 ? (
              <Text variant="label" tone="secondary">
                {t.modes.picker.nothingYet}
              </Text>
            ) : (
              <ListGroup>{selected.map(row)}</ListGroup>
            )}
          </Section>
          <Section title={listTitle}>
            <ListGroup>{(featured ?? items).map(row)}</ListGroup>
          </Section>
        </>
      )}
    </Screen>
  );
}
