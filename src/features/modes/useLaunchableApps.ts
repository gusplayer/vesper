import { useEffect, useState } from 'react';

import { listLaunchableApps } from '../../platform/androidApps';
import type { PickerItem } from './SelectionPicker';

/**
 * The phone's launchable apps as picker rows, read once per mount (Android). Null
 * while the native list is on its way, so the picker can say it is loading; the ids
 * are package names, which is what the Android selection token holds
 * (domain/packageSelection). Empty on iOS and where the module is missing.
 */
export function useLaunchableApps(enabled: boolean): readonly PickerItem[] | null {
  const [items, setItems] = useState<readonly PickerItem[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let alive = true;
    void listLaunchableApps(true).then((apps) => {
      if (!alive) {
        return;
      }
      setItems(
        apps.map((app) => ({
          id: app.packageName,
          label: app.label,
          tile: { initial: app.label.slice(0, 1).toLocaleUpperCase(), color: null, icon: app.iconBase64 },
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return items;
}
