import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

import { useActiveMode, useSettings } from '../../data';
import type { Mode } from '../../data/types';
import {
  Button,
  Card,
  HeroObject,
  IconCircle,
  ListGroup,
  ListRow,
  ProgressDots,
  Screen,
  Stack,
  Text,
  ThemeScope,
} from '../../design/components';
import { finishOnboarding } from '../../features/onboarding/commit';
import { useStrings, type Strings } from '../../i18n';

type Step = {
  preview: ReactNode;
  /** The object sits on a card; a list is its own card and is not framed twice. */
  framed: boolean;
  title: string;
  body: string;
};

/**
 * The three pages, built from the dictionary so they follow a language change, and
 * from the mode the onboarding just made: a deep mode starts with a hold and has no
 * way out, and the first page says so instead of promising a tap.
 */
function tourSteps(t: Strings['onboarding']['tour'], mode: Mode | null, emergencyTotal: number): readonly Step[] {
  const deep = mode?.depth === 'deep';
  return [
    {
      preview: (
        <Stack align="center" gap="md">
          <HeroObject size="md" />
          <Text variant="caption" tone="secondary">
            {mode?.name ?? t.focus.caption}
          </Text>
        </Stack>
      ),
      framed: true,
      title: deep ? t.focus.deepTitle : t.focus.title,
      body: deep && mode !== null ? t.focus.deepBody(mode.name) : t.focus.body,
    },
    {
      preview: (
        <ListGroup>
          <ListRow label={t.emergency.rules} />
          <ListRow label={t.emergency.unlocks} value={String(emergencyTotal)} />
        </ListGroup>
      ),
      framed: false,
      title: t.emergency.title,
      body: t.emergency.body(emergencyTotal),
    },
    {
      // The three currencies the body names, one row each: what the page is about.
      preview: (
        <ListGroup>
          <ListRow label={t.local.invested} value={t.local.investedValue} />
          <ListRow label={t.local.verified} value={t.local.verifiedValue} />
          <ListRow label={t.local.consumed} value={t.local.consumedValue} />
        </ListGroup>
      ),
      framed: false,
      title: t.local.title,
      body: t.local.body,
    },
  ];
}

/**
 * Three dark pages with a preview each. The last one ends the onboarding. Back —
 * Android's button, the iOS edge swipe — goes one page back, like the arrow, and only
 * leaves the tour from its first page.
 */
export default function TourScreen() {
  const t = useStrings();
  const navigation = useNavigation();
  const mode = useActiveMode();
  const emergencyTotal = useSettings().emergencyTotal;
  const [index, setIndex] = useState(0);

  const steps = tourSteps(t.onboarding.tour, mode, emergencyTotal);
  const step = steps[index] ?? steps[0];
  const last = index === steps.length - 1;

  // The edge swipe would pop the whole tour; past the first page it is off and the
  // arrow (or Android's back, below) turns the page instead.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: index === 0 });
  }, [navigation, index]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (index === 0) {
          return false;
        }
        setIndex(index - 1);
        return true;
      });
      return () => subscription.remove();
    }, [index]),
  );

  const next = () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    // The root guard swaps to the tabs on its own; the replace is there for safety.
    finishOnboarding(Date.now());
    router.replace('/(tabs)');
  };

  if (step === undefined) {
    return null;
  }

  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <Stack direction="row" align="center" gap="md">
            {index > 0 ? (
              <IconCircle
                name="chevron-left"
                tone="card"
                onPress={() => setIndex(index - 1)}
                accessibilityLabel={t.onboarding.tour.previous}
              />
            ) : null}
            <Stack grow>
              <Button label={last ? t.common.done : t.common.continue} onPress={next} />
            </Stack>
          </Stack>
        }
      >
        <Stack grow justify="center" gap="xxl">
          {step.framed ? <Card tone="muted">{step.preview}</Card> : step.preview}
          <Stack gap="sm">
            <Text variant="title">{step.title}</Text>
            <Text variant="label" tone="secondary">
              {step.body}
            </Text>
          </Stack>
        </Stack>
        <ProgressDots
          count={steps.length}
          index={index}
          accessibilityLabel={t.onboarding.progress(index + 1, steps.length)}
        />
      </Screen>
    </ThemeScope>
  );
}
