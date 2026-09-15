import { useRouter } from 'expo-router';

import { WEBSITES } from '../../data';
import { useModeDraftStore } from '../../data/modeDraft';
import { SelectionPicker, type PickerItem } from '../../features/modes/SelectionPicker';

const ITEMS: ReadonlyArray<PickerItem> = WEBSITES.map((site) => ({ id: site.id, label: site.host }));
const POPULAR = ITEMS.filter((item) => WEBSITES.find((site) => site.id === item.id)?.popular);

/** Picks the websites of the mode draft. Hosts only; the popular ones are listed first. */
export default function ModeWebsitesScreen() {
  const router = useRouter();
  const behavior = useModeDraftStore((state) => state.behavior);
  const websiteIds = useModeDraftStore((state) => state.websiteIds);
  const toggleWebsite = useModeDraftStore((state) => state.toggleWebsite);

  return (
    <SelectionPicker
      title={behavior === 'allow' ? 'Sitios permitidos' : 'Sitios bloqueados'}
      searchPlaceholder="Buscar sitios"
      items={ITEMS}
      featured={POPULAR}
      selectedIds={websiteIds}
      selectedTitle="Seleccionados"
      listTitle="Populares"
      onToggle={toggleWebsite}
      onBack={() => router.back()}
      onDone={() => router.back()}
    />
  );
}
