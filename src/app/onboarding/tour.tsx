import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { useAppStore } from '../../data';
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
} from '../../design/components';
import { ThemeScope } from '../../design/components';

type Step = {
  preview: ReactNode;
  title: string;
  body: string;
};

const STEPS: ReadonlyArray<Step> = [
  {
    preview: (
      <Stack align="center" gap="md">
        <HeroObject size="md" />
        <Text variant="caption" tone="secondary">
          Toca para enfocar
        </Text>
      </Stack>
    ),
    title: 'Toca para enfocar. Toca de nuevo para volver.',
    body: 'Elige un modo, toca el botón y las apps que elegiste quedan en pausa hasta que termines.',
  },
  {
    preview: (
      <ListGroup>
        <ListRow label="Mis reglas" />
        <ListRow label="Desbloqueo de emergencia" value="5" />
      </ListGroup>
    ),
    title: 'Estás cubierto en una emergencia',
    body: 'Tienes 5 desbloqueos de emergencia. Suficientes para cuando de verdad los necesitas. Los encuentras en Ajustes.',
  },
  {
    preview: (
      <Stack align="center" gap="md">
        <HeroObject size="md" />
        <Text variant="caption" tone="secondary">
          Todo en tu teléfono
        </Text>
      </Stack>
    ),
    title: 'Nada sale de tu teléfono',
    body: 'Sin cuenta ni nube. Lo que inviertes, lo que Salud confirma y lo que consumes se cuentan aparte y nunca se suman.',
  },
];

/** Three dark pages with a preview each. The last one ends the onboarding. */
export default function TourScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [index, setIndex] = useState(0);

  const step = STEPS[index] ?? STEPS[0];
  const last = index === STEPS.length - 1;

  const next = () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    // The root guard swaps to the tabs on its own; the replace is there for safety.
    updateSettings({ onboardingDone: true });
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
                name="arrow-left"
                tone="card"
                onPress={() => setIndex(index - 1)}
                accessibilityLabel="anterior"
              />
            ) : null}
            <Stack grow>
              <Button label={last ? 'Listo' : 'Continuar'} onPress={next} />
            </Stack>
          </Stack>
        }
      >
        <Stack grow justify="center" gap="xxl">
          <Card tone="muted">{step.preview}</Card>
          <Stack gap="sm">
            <Text variant="title">{step.title}</Text>
            <Text variant="label" tone="secondary">
              {step.body}
            </Text>
          </Stack>
        </Stack>
        <ProgressDots count={STEPS.length} index={index} />
      </Screen>
    </ThemeScope>
  );
}
