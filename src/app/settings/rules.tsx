import { useRouter } from 'expo-router';

import { useAppStore, useSettings } from '../../data';
import { PageHeader, Screen, Stack, Text } from '../../design/components';
import { ToggleCard } from '../../features/settings/ToggleCard';

/** Mis reglas: four switches that make a session harder to leave. Nothing real yet. */
export default function RulesScreen() {
  const router = useRouter();
  const { rules } = useSettings();
  const updateRules = useAppStore((state) => state.updateRules);

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title="Mis reglas" />

      <Stack gap="md">
        <ToggleCard
          title="Modo estricto"
          description="Impide terminar una sesión borrando la app"
          value={rules.strictMode}
          onValueChange={(strictMode) => updateRules({ strictMode })}
        />
        <ToggleCard
          title="Bloquear instalaciones"
          description="Evita instalar apps durante una sesión"
          value={rules.blockInstalls}
          onValueChange={(blockInstalls) => updateRules({ blockInstalls })}
        />
        <ToggleCard
          title="Bloquear compras dentro de apps"
          description="Limita compras durante una sesión"
          value={rules.blockPurchases}
          onValueChange={(blockPurchases) => updateRules({ blockPurchases })}
        />
        <ToggleCard
          title="Bloquear contenido adulto"
          description="Limita contenido adulto en apps y sitios durante una sesión"
          value={rules.blockMature}
          onValueChange={(blockMature) => updateRules({ blockMature })}
        />
      </Stack>

      <Text variant="caption" tone="tertiary" align="center">
        En el prototipo esto no bloquea nada de verdad.
      </Text>
    </Screen>
  );
}
