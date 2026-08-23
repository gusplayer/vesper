import { Caption } from '../design/components/Caption';
import { Label } from '../design/components/Label';
import { Rule } from '../design/components/Rule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';

/**
 * Active session. A route, not a pager page: the three depth levels decide how a
 * session ends, and a swipe must not be one of the ways. See ADR-0009.
 *
 * Placeholder. Timer, intention, progress rule and HoldToConfirm are
 * docs/SPRINT_01.md tasks 5 and 6. The timer is computed as `now - startedAt`,
 * never by accumulating ticks.
 */
export default function SessionScreen() {
  return (
    <Screen>
      <ScreenHeader left="sesión" right="1 de 1" />
      <Label>timer</Label>
      <Rule />
      <Caption>mantén pulsado para terminar</Caption>
    </Screen>
  );
}
