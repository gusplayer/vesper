import { router } from 'expo-router';

import { useAppStore } from '../../data';
import { Button } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';

const BLOCKS: ReadonlyArray<PermissionBlock> = [
  {
    icon: 'activity',
    heading: 'Hábitos que se marcan solos',
    body: 'Gym, pasos y sueño se confirman con Salud. No tenés que tocar nada.',
  },
  {
    icon: 'lock',
    heading: 'Nunca sale del teléfono',
    body: 'Lo que Salud comparte se lee acá y no va a ningún servidor.',
  },
  {
    icon: 'heart',
    heading: 'Verificado, no declarado',
    body: 'Lo que Salud confirma vale distinto de lo que declarás. Nunca se suman.',
  },
];

/** Health. Optional: "Ahora no" moves on without flipping the flag. */
export default function HealthScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);

  const next = () => router.push('/onboarding/routine');

  const connect = () => {
    updateSettings({ healthConnected: true });
    next();
  };

  return (
    <PermissionPage
      title="Conectá Salud"
      blocks={BLOCKS}
      onBack={() => router.back()}
      footer={
        <>
          <Button label="Conectar Salud" onPress={connect} />
          <Button label="Ahora no" variant="ghost" onPress={next} />
        </>
      }
    />
  );
}
