import { StyleSheet } from 'react-native';

import { nativeModule, status } from './blocking';
import { isAndroid } from './capabilities';

type SelectionPickerProps = {
  /** The current FamilyActivitySelection token, or null for an empty selection. */
  token: string | null;
  /** Fires with the new token on every change the user makes in the native picker. */
  onChange: (token: string | null) => void;
};

/**
 * Apple's FamilyActivityPicker, inline. Renders nothing where Screen Time is missing,
 * so a screen can drop it in and let `status()` explain the gap. The view fills its
 * parent: the parent gives it a size (NativeHost in the design system).
 *
 * The picker is SwiftUI under the hood and can crash on large categories; that is
 * outside our reach. What is in our reach is never letting a JS error out of here.
 *
 * iOS only. Android has no system picker: modes/apps lists the phone's launchable apps
 * in the same full-page picker as the catalogue (features/modes/useLaunchableApps), so
 * this renders nothing there.
 */
export function SelectionPicker({ token, onChange }: SelectionPickerProps) {
  const mod = nativeModule();
  if (isAndroid || mod === null || !status().available) {
    return null;
  }
  const NativeView = mod.DeviceActivitySelectionView;
  return (
    <NativeView
      style={StyleSheet.absoluteFill}
      familyActivitySelection={token}
      onSelectionChange={(event) => onChange(event.nativeEvent.familyActivitySelection)}
    />
  );
}
