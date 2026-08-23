import { Caption } from '../design/components/Caption';
import { Label } from '../design/components/Label';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';

/**
 * Placeholder. The real screen — duration, context line, `empezar`, day ledger —
 * is docs/SPRINT_01.md task 5 and needs the components from task 2 first.
 */
export function Home() {
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <ScreenHeader left={today} right="meta semanal" />
      <Label>inicio</Label>
      <Rule />
      <Caption>fase 1 · sin permisos, sin bloqueo</Caption>
    </Screen>
  );
}
