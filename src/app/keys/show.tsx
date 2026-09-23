import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useKeys } from '../../data';
import { useKeysStore } from '../../data/stores/keys';
import { Button, FieldRow, KeyPattern, ListGroup, ListRow, PageHeader, Screen, Stack, Text, Toggle } from '../../design/components';
import { KEY_STEP_MS } from '../../domain/key';
import { useLocale, useStrings } from '../../i18n';

/**
 * A key, up close (ADR-0035). If this phone *is* the key, the page draws the code the
 * other phone scans, redrawn when its 30 s window turns over. If the key is one that
 * *opens* this phone, there is no code here: drawing it would be a lock with its key
 * taped to the inside of the door, so the page only renames and removes.
 *
 * The redraw is a clock, not an animation: nothing fades, nothing moves, and any single
 * frame is a whole code — which is what a camera needs and what "Reducir movimiento"
 * requires.
 */
export default function ShowKeyScreen() {
  const router = useRouter();
  const t = useStrings();
  const { tag } = useLocale();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const keys = useKeys();
  const codeFor = useKeysStore((state) => state.codeFor);
  const typedCodeFor = useKeysStore((state) => state.typedCodeFor);
  const setTypedEnabled = useKeysStore((state) => state.setTypedEnabled);
  const rename = useKeysStore((state) => state.rename);
  const remove = useKeysStore((state) => state.remove);
  const [code, setCode] = useState<string | null>(null);
  // Null until the user types: the field shows the stored name without an effect
  // copying it into state on every render of a row that may not exist yet.
  const [draftName, setDraftName] = useState<string | null>(null);
  // The dictated code stays hidden until asked for: eight characters are legible from
  // across a room, and a dot field is not (ADR-0037).
  const [typed, setTyped] = useState<string | null>(null);

  const key = keys.find((entry) => entry.id === id) ?? null;
  const shows = key?.role === 'shows';
  const name = draftName ?? key?.name ?? '';

  useEffect(() => {
    if (key === null || !shows) {
      return;
    }
    let alive = true;
    const draw = () => {
      void codeFor(key.id, Date.now()).then((next) => {
        if (alive) {
          setCode(next);
        }
      });
    };
    draw();
    // Wake on the boundary itself, then every step, so the code on screen is never
    // one the scanner has already moved past.
    const toBoundary = KEY_STEP_MS - (Date.now() % KEY_STEP_MS);
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      draw();
      interval = setInterval(draw, KEY_STEP_MS);
    }, toBoundary);
    return () => {
      alive = false;
      clearTimeout(timeout);
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [key, shows, codeFor]);

  const showTyped = async () => {
    if (key === null) {
      return;
    }
    setTyped(await typedCodeFor(key.id, Date.now()));
  };

  const confirmRemove = () => {
    if (key === null) {
      return;
    }
    Alert.alert(key.name, t.keys.removeConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.keys.remove,
        style: 'destructive',
        onPress: () => {
          void remove(key.id).then(() => router.back());
        },
      },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        key === null ? undefined : (
          <>
            <Button
              label={t.keys.show.done}
              onPress={() => {
                const trimmed = name.trim();
                if (trimmed !== '' && trimmed !== key.name) {
                  rename(key.id, trimmed);
                }
                router.back();
              }}
            />
            <Button variant="ghost" label={t.keys.remove} onPress={confirmRemove} />
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={key?.name ?? t.keys.title} />

      {key === null ? (
        <Text variant="label" tone="secondary" align="center">
          {t.keys.show.gone}
        </Text>
      ) : (
        <Stack gap="md">
          <FieldRow
            label={t.keys.nameLabel}
            value={name}
            onChangeText={setDraftName}
            placeholder={t.keys.namePlaceholder}
          />
          <Text variant="caption" tone="tertiary">
            {t.keys.pairedOn(new Date(key.pairedAt).toLocaleDateString(tag))}
          </Text>

          {shows ? (
            <ListGroup>
              <ListRow
                label={t.keys.typed.enable}
                description={t.keys.typed.enableHint}
                right={
                  <Toggle
                    value={key.typedEnabled}
                    onValueChange={(next) => {
                      setTypedEnabled(key.id, next);
                      setTyped(null);
                    }}
                    accessibilityLabel={t.keys.typed.enable}
                  />
                }
              />
            </ListGroup>
          ) : null}

          {shows && key.typedEnabled ? (
            typed === null ? (
              <Button
                variant="ghost"
                label={t.keys.typed.reveal}
                onPress={() => {
                  void showTyped();
                }}
              />
            ) : (
              <Stack gap="xs">
                <Text variant="label" tone="secondary">
                  {t.keys.typed.title}
                </Text>
                <Text variant="title" align="center">
                  {typed}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {t.keys.typed.hint}
                </Text>
                <Button variant="ghost" label={t.keys.typed.hide} onPress={() => setTyped(null)} />
              </Stack>
            )
          ) : null}

          {shows ? (
            code === null ? (
              <Text variant="label" tone="secondary" align="center">
                {t.keys.show.gone}
              </Text>
            ) : (
              <>
                <Text variant="title">{t.keys.show.codeTitle}</Text>
                <KeyPattern value={code} accessibilityLabel={t.keys.show.codeTitle} />
                <Text variant="label" tone="secondary" align="center">
                  {t.keys.show.codeHint}
                </Text>
              </>
            )
          ) : (
            <Text variant="label" tone="secondary">
              {t.keys.role.scans}
            </Text>
          )}

        </Stack>
      )}
    </Screen>
  );
}
