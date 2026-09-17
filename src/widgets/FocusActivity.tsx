import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityLayout } from 'expo-widgets';

/**
 * The Live Activity for a running session: the timer on the lock screen and in the
 * Dynamic Island, shaped like Brick's. Dark whatever the system scheme is, because the
 * session screen behind it is dark too (ADR-0016).
 *
 * The function below is not run by the app. Babel stringifies everything marked
 * `'widget'` and the widget extension evaluates it against its own globals (the
 * @expo/ui components and modifiers imported here). Two rules follow from that:
 * nothing from the app may be imported into it, and every value it uses must be
 * declared inside the function body, since module-level constants do not survive the
 * stringification. Props cross as JSON, so dates travel as epoch ms. The same rule
 * keeps words out: the widget cannot read the dictionary, so any text it shows is
 * formatted by src/platform/liveActivity.ts in the current language and sent as a prop.
 */

export type FocusActivityProps = {
  modeName: string;
  startedAt: number;
  endsAt: number;
  /** An open session shows the time served, not the time left. */
  countsUp: boolean;
  /** '21m', already formatted by the app, refreshed every minute while it runs. */
  remainingText: string;
  /** 'Enfocado · quedan 21m' or 'Focused · 21m left', in the app's language. */
  statusText: string;
};

function FocusActivityLayout(props: FocusActivityProps): LiveActivityLayout {
  'widget';

  // Copied from the dark scheme in src/design/tokens.ts: bg = ink, text = ink,
  // secondary = inkSecondary. The widget cannot import the tokens, so keep them in sync.
  const ink = {
    bg: '#1C1B1A',
    text: '#F2F1EE',
    textSecondary: '#A9A7A2',
  };

  // SwiftUI counts this down on its own; the app only has to set it once.
  const interval = { lower: new Date(props.startedAt), upper: new Date(props.endsAt) };

  // Mode name and status on the left, the big clock on the right. Built by a function
  // rather than shared as one element, since two regions must not hold the same node.
  const row = (clockSize: number) => (
    <HStack alignment="center" spacing={12}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(ink.text)]}>
          {props.modeName}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(ink.textSecondary)]}>{props.statusText}</Text>
      </VStack>
      <Spacer />
      <Text
        timerInterval={interval}
        countsDown={!props.countsUp}
        modifiers={[
          font({ size: clockSize, weight: 'medium' }),
          monospacedDigit(),
          multilineTextAlignment('trailing'),
          foregroundStyle(ink.text),
        ]}
      />
    </HStack>
  );

  // The small square, Brick's mark, for the Dynamic Island.
  const glyph = () => <Image systemName="square.fill" size={10} color={ink.text} />;

  return {
    banner: (
      <HStack modifiers={[padding({ all: 16 }), activityBackgroundTint(ink.bg)]}>{row(34)}</HStack>
    ),
    compactLeading: <HStack modifiers={[padding({ leading: 4 })]}>{glyph()}</HStack>,
    compactTrailing: (
      <Text
        modifiers={[
          font({ size: 14, weight: 'medium' }),
          monospacedDigit(),
          foregroundStyle(ink.text),
          padding({ trailing: 4 }),
        ]}
      >
        {props.remainingText}
      </Text>
    ),
    minimal: glyph(),
    expandedCenter: <HStack modifiers={[padding({ horizontal: 8, vertical: 4 })]}>{row(28)}</HStack>,
  };
}

export const FocusActivity = createLiveActivity<FocusActivityProps>('focus', FocusActivityLayout);
