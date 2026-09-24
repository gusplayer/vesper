import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { WEBSITES } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';
import { useStrings } from '../../i18n';

/** Hosts are not words: the catalogue is the same in every language. */
const ITEMS: readonly PickerItem[] = WEBSITES.map((site) => ({ id: site.id, label: site.host }));
const POPULAR = ITEMS.filter((item) => WEBSITES.find((site) => site.id === item.id)?.popular);

/** Picks the websites of the mode draft. Hosts only; the popular ones are listed first. */
export default function ModeWebsitesScreen() {
  const router = useRouter();
  const t = useStrings();
  const behavior = useModeDraftStore((state) => state.behavior);
  const websiteIds = useModeDraftStore((state) => state.websiteIds);
  const toggleWebsite = useModeDraftStore((state) => state.toggleWebsite);

  return (
    <SelectionPicker
      title={behavior === 'allow' ? t.modes.websites.allowed : t.modes.websites.blocked}
      searchPlaceholder={t.modes.websites.search}
      items={ITEMS}
      featured={POPULAR}
      selectedIds={websiteIds}
      selectedTitle={t.modes.websites.selected}
      listTitle={t.modes.websites.popular}
      onToggle={toggleWebsite}
      onBack={() => goBack(router)}
      onDone={() => goBack(router)}
    />
  );
}
