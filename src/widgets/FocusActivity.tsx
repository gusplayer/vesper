import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityLayout } from 'expo-widgets';

/**
 * The Live Activity for a running session: the clock on the lock screen and in the
 * Dynamic Island, shaped like Brick's. It follows the app's rule for schemes: focus is
 * ink (dark) and a break is paper (light), whatever the system scheme is (ADR-0016,
 * ADR-0023). The island itself is always black, so its regions keep light text in
 * both phases and the break shows there through the glyph and the status line.
 *
 * Every clock is a native `Text timerInterval`: the app sets the interval once and
 * SwiftUI counts it, so nothing here goes stale when iOS suspends the JS (ADR-0023).
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

export type FocusActivityPhase = 'focus' | 'open' | 'break';

export type FocusActivityProps = {
  modeName: string;
  /** What the clock counts: the session down, an open session up, a break down. */
  phase: FocusActivityPhase;
  startedAt: number;
  endsAt: number;
  /** 'Enfocado', 'Enfocado · sin límite' or 'Pausa', in the app's language. No time in it. */
  statusText: string;
};

function FocusActivityLayout(props: FocusActivityProps): LiveActivityLayout {
  'widget';

  // Copied from src/design/tokens.ts, which the widget cannot import; keep them in sync.
  // Ink is the session's dark scheme (bg = light.ink, text = dark.ink, secondary =
  // dark.inkSecondary). Paper is the app's light scheme (bg, ink, inkSecondary).
  const ink = {
    bg: '#1C1B1A',
    text: '#F2F1EE',
    textSecondary: '#A9A7A2',
  };
  const paper = {
    bg: '#E8E6E2',
    text: '#1C1B1A',
    textSecondary: '#66645F',
  };

  const isBreak = props.phase === 'break';
  const scheme = isBreak ? paper : ink;
  // Only an open session counts up; focus and break count down to their end.
  const countsDown = props.phase !== 'open';
  // The island's mark: Brick's square while focused, the pause glyph during a break.
  const glyphName = isBreak ? 'pause.fill' : 'square.fill';

  // SwiftUI counts this on its own; the app only has to set it once.
  const interval = { lower: new Date(props.startedAt), upper: new Date(props.endsAt) };
  // A timer text reserves the width of its widest value, so in the island it gets a
  // fixed frame: 'mm:ss' for anything under an hour, 'h:mm:ss' for longer intervals.
  const showsHours = props.endsAt - props.startedAt >= 60 * 60 * 1000;
  const compactClockWidth = showsHours ? 66 : 46;
  const expandedClockWidth = showsHours ? 118 : 84;

  // Built by functions rather than shared as elements: two regions must not hold the
  // same node. `colors` is the scheme of the surface each one lands on.
  type Colors = { bg: string; text: string; textSecondary: string };

  const clock = (size: number, colors: Colors, width?: number) => (
    <Text
      timerInterval={interval}
      countsDown={countsDown}
      modifiers={[
        font({ size, weight: 'medium' }),
        monospacedDigit(),
        multilineTextAlignment('trailing'),
        foregroundStyle(colors.text),
        ...(width === undefined ? [] : [frame({ width, alignment: 'trailing' })]),
      ]}
    />
  );

  const title = (colors: Colors) => (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(colors.text)]}>
        {props.modeName}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.textSecondary)]}>{props.statusText}</Text>
    </VStack>
  );

  const glyph = (size: number, colors: Colors) => <Image systemName={glyphName} size={size} color={colors.text} />;

  return {
    // The lock screen banner: mode and phase on the left, the big clock on the right.
    banner: (
      <HStack alignment="center" spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint(scheme.bg)]}>
        {title(scheme)}
        <Spacer />
        {clock(34, scheme)}
      </HStack>
    ),
    // The island is black whatever the phase: light text everywhere below.
    compactLeading: <HStack modifiers={[padding({ leading: 4 })]}>{glyph(10, ink)}</HStack>,
    compactTrailing: <HStack modifiers={[padding({ trailing: 4 })]}>{clock(14, ink, compactClockWidth)}</HStack>,
    minimal: glyph(10, ink),
    // Expanded: the glyph and the clock flank the sensor; the name and the phase take
    // the full-width row below, where a long mode name has room to stay on one line.
    expandedLeading: <HStack modifiers={[padding({ leading: 8, top: 6 })]}>{glyph(12, ink)}</HStack>,
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 8, top: 4 })]}>{clock(28, ink, expandedClockWidth)}</HStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 8, bottom: 4 })]}>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(ink.text), lineLimit(1)]}>
            {props.modeName}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(ink.textSecondary)]}>{props.statusText}</Text>
        </VStack>
        <Spacer />
      </HStack>
    ),
  };
}

export const FocusActivity = createLiveActivity<FocusActivityProps>('focus', FocusActivityLayout);
