import { router } from 'expo-router';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';

const BLOCKS: ReadonlyArray<PermissionBlock> = [
  {
    icon: 'settings',
    heading: 'Cómo lo vas a usar',
    body: 'Con el acceso elegís qué apps bloquear en tus modos. Tiempo de uso las pausa mientras estás enfocado.',
  },
  {
    icon: 'lock',
    heading: 'Cómo lo usamos',
    body: 'Nunca vemos qué apps bloqueás ni tu historial. Todo queda en tu teléfono.',
  },
  {
    icon: 'zap',
    heading: 'Por qué importa',
    body: 'Así Vesper te ayuda a crear tiempo con intención, sin borrar apps.',
  },
];

/** Screen Time. In the prototype the button only flips `screenTimeConnected`. */
export default function ScreenTimeScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);

  const allow = () => {
    updateSettings({ screenTimeConnected: true });
    router.push('/onboarding/health');
  };

  return (
    <PermissionPage
      title="Conectá Vesper a Tiempo de uso"
      blocks={BLOCKS}
      onBack={() => router.back()}
      footer={
        <>
          <Button label="Permitir acceso" onPress={allow} />
          <Text variant="caption" tone="tertiary" align="center">
            En el prototipo esto no pide permiso de verdad. ¿No podés conectar?
          </Text>
        </>
      }
    />
  );
}
