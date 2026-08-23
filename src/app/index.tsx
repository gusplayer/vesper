import { Caption } from '../design/components/Caption';
import { Label } from '../design/components/Label';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';

/**
 * Scaffold placeholder, not the real home screen. It exists to prove on device
 * that Literata loads and the four tones render as paper and ink.
 *
 * The real screen — duration, context line, `empezar`, day ledger — is
 * docs/SPRINT_01.md task 5, and needs the components from task 2 first.
 */
export default function HomeScreen() {
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen>
      <ScreenHeader left={today} right="meta semanal" />
      <Label>vesper</Label>
      <Rule />
      <Caption>fase 1 · sin permisos, sin bloqueo</Caption>
    </Screen>
  );
}
