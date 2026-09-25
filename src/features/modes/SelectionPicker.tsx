import { useState } from 'react';

import {
  AppRow,
  Button,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SearchField,
  Section,
  StatusNote,
  Text,
  useTooltip,
} from '../../design/components';
import { MAX_SELECTION } from '../../data/modeDraft';
import { useStrings } from '../../i18n';

export type PickerItem = {
  id: string;
  label: string;
  /** The category under an app's name. Websites have none. */
  description?: string;
  /**
   * An app tile on the left; without it the row is plain text. A catalogue app has a
   * letter on its color; a real Android app has its own icon and no color.
   */
  tile?: { initial: string; color?: string | null; icon?: string | null };
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
  /** Why a tap at the cap does nothing, in the gender of what is listed. */
  fullTip: string;
  /** The list is still being read (the phone's apps): the sections say so. */
  loading?: boolean;
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
  notice,
  fullTip,
  loading = false,
}: SelectionPickerProps) {
  const t = useStrings();
  const [query, setQuery] = useState('');
  const tooltip = useTooltip();
  const searching = query.trim() !== '';
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const results = items.filter((item) => matches(item, query));

  const row = (item: PickerItem) => {
    const checked = selectedIds.includes(item.id);
    // Removing is always allowed; only adding past the cap has to explain itself,
    // because until now the tap simply did nothing and said nothing.
    const toggle = () => {
      if (!checked && selectedIds.length >= MAX_SELECTION) {
        tooltip.show(fullTip);
        return;
      }
      onToggle(item.id);
    };
    if (item.tile === undefined) {
      return <ListRow key={item.id} label={item.label} selection="checkbox" selected={checked} onPress={toggle} />;
    }
    return (
      <AppRow
        key={item.id}
        icon={item.tile.icon ?? null}
        initial={item.tile.initial}
        color={item.tile.color ?? null}
        name={item.label}
        description={item.description}
        selection="checkbox"
        selected={checked}
        onPress={toggle}
      />
    );
  };

  return (
    <Screen scroll footer={<Button label={doneLabel ?? t.common.done} onPress={onDone} />}>
      <PageHeader onBack={onBack} title={title} />
      <SearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
      {notice === undefined ? null : <StatusNote text={notice} />}
      {tooltip.element}
      {loading ? (
        <StatusNote text={t.modes.picker.loading} kind="empty" align="center" live />
      ) : searching ? (
        <Section title={t.modes.picker.results}>
          {results.length === 0 ? (
            <StatusNote text={t.modes.picker.noResults} kind="empty" />
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
              <StatusNote text={t.modes.picker.nothingYet} kind="empty" />
            ) : (
              <ListGroup>{selected.map(row)}</ListGroup>
            )}
          </Section>
          <Section title={listTitle}>
            {(featured ?? items).length === 0 ? (
              <StatusNote text={t.modes.picker.noResults} kind="empty" />
            ) : (
              <ListGroup>{(featured ?? items).map(row)}</ListGroup>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}
