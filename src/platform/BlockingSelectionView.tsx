import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Check } from '../design/components/Check';
import { AppImage } from '../design/components/AppImage';
import { ListGroup } from '../design/components/ListGroup';
import { ListRow } from '../design/components/ListRow';
import { SearchField } from '../design/components/SearchField';
import { Text } from '../design/components/Text';
import { packageNamesFromToken, tokenFromPackageNames } from '../domain/packageSelection';
import { useStrings } from '../i18n';
import { listLaunchableApps } from './androidApps';
import type { LaunchableApp } from '../../modules/vesper-blocking';
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
 * On Android there is no system picker: AndroidSelectionView lists the launchable
 * apps of the phone and speaks the same prop shape, so this function does not fork.
 */
export function SelectionPicker({ token, onChange }: SelectionPickerProps) {
  const mod = nativeModule();
  if (mod === null || !status().available) {
    return null;
  }
  if (isAndroid) {
    return (
      <AndroidSelectionView
        style={StyleSheet.absoluteFill}
        familyActivitySelection={token}
        onSelectionChange={(event) => onChange(event.nativeEvent.familyActivitySelection)}
      />
    );
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

type AndroidSelectionViewProps = {
  style?: StyleProp<ViewStyle>;
  /** A JSON array of package names, or null. Same prop name as the iOS view. */
  familyActivitySelection: string | null;
  onSelectionChange: (event: { nativeEvent: { familyActivitySelection: string | null } }) => void;
};

/**
 * The Android picker: a search and a checklist of every launchable app with its real
 * icon. The token it emits is JSON (src/domain/packageSelection), stored in the same
 * column as the iOS token. Built from the design system, one row per app.
 */
function AndroidSelectionView({ style, familyActivitySelection, onSelectionChange }: AndroidSelectionViewProps) {
  const t = useStrings();
  const [apps, setApps] = useState<LaunchableApp[] | null>(null);
  const [query, setQuery] = useState('');
  const selected = useMemo(() => packageNamesFromToken(familyActivitySelection), [familyActivitySelection]);

  useEffect(() => {
    let alive = true;
    void listLaunchableApps(true).then((list) => {
      if (alive) {
        setApps(list);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (packageName: string) => {
    const next = selected.includes(packageName)
      ? selected.filter((name) => name !== packageName)
      : [...selected, packageName];
    onSelectionChange({ nativeEvent: { familyActivitySelection: tokenFromPackageNames(next) } });
  };

  const needle = query.trim().toLowerCase();
  const visible = (apps ?? []).filter(
    (app) => needle === '' || app.label.toLowerCase().includes(needle) || app.packageName.toLowerCase().includes(needle),
  );

  return (
    <View style={[styles.android, style]}>
      <View style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t.modes.apps.search} />
      </View>
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {apps === null ? (
          <Text variant="label" tone="secondary" align="center">
            {t.modes.picker.loading}
          </Text>
        ) : visible.length === 0 ? (
          <Text variant="label" tone="secondary" align="center">
            {t.modes.picker.noResults}
          </Text>
        ) : (
          <ListGroup>
            {visible.map((app) => (
              <ListRow
                key={app.packageName}
                label={app.label}
                leading={<AppImage base64={app.iconBase64} />}
                right={<Check checked={selected.includes(app.packageName)} shape="box" />}
                onPress={() => toggle(app.packageName)}
                kind="action"
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  android: {
    // The host is a fixed-height box; the list scrolls inside it.
    flex: 1,
  },
  search: {
    padding: 12,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
