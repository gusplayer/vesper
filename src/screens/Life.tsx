import { Caption } from '../design/components/Caption';
import { Label } from '../design/components/Label';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';

/**
 * Placeholder. Weeks remaining, the week grid and the projection line are
 * docs/SPRINT_01.md task 5. Never the initial page, never a notification.
 */
export function Life() {
  return (
    <Screen>
      <ScreenHeader left="vida" />
      <Label>semanas restantes</Label>
      <Rule />
      <Caption>opt-in · se configura desde esta pantalla</Caption>
    </Screen>
  );
}
