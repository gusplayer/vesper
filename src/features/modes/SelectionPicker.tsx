import { useEffect, useRef, useState } from 'react';

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
  Tooltip,
 AppRow } from '../../design/components';
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
  items: readonly PickerItem[];
  /** What the second section lists when not searching; defaults to every item. */
  featured?: readonly PickerItem[];
  selectedIds: readonly string[];
  /** 'Seleccionadas' / 'Seleccionados'. */
  selectedTitle: string;
  /** 'Todas' / 'Populares'. */
  listTitle: string;
  onToggle: (id: string) => void;
  onBack: () => void;
  onDone: () => void;
  /** Defaults to `common.done`. */
  doneLabel?: string;
  /** A line under the search, for what this list cannot do here: real blocking is off. */
  notice?: string;
};

/** How long the "already picked 50" bubble stays, like the habits one. */
const TOOLTIP_MS = 2500;

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
  notice,
}: SelectionPickerProps) {
  const t = useStrings();
  const [query, setQuery] = useState('');
  const [tipVisible, setTipVisible] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searching = query.trim() !== '';
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const results = items.filter((item) => matches(item, query));

  useEffect(
    () => () => {
      if (tipTimer.current !== null) {
        clearTimeout(tipTimer.current);
      }
    },
    [],
  );

  const row = (item: PickerItem) => {
    const checked = selectedIds.includes(item.id);
    const check = <Check checked={checked} shape="box" />;
    // Removing is always allowed; only adding past the cap has to explain itself,
    // because until now the tap simply did nothing and said nothing.
    const toggle = () => {
      if (!checked && selectedIds.length >= MAX_SELECTION) {
        setTipVisible(true);
        if (tipTimer.current !== null) {
          clearTimeout(tipTimer.current);
        }
        tipTimer.current = setTimeout(() => setTipVisible(false), TOOLTIP_MS);
        return;
      }
      onToggle(item.id);
    };
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
      {notice === undefined ? null : (
        <Text variant="caption" tone="secondary">
          {notice}
        </Text>
      )}
      {tipVisible ? <Tooltip message={t.modes.picker.fullTip} /> : null}
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
                {t.modes.picker.count(selected.length, MAX_SELECTION)}
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
