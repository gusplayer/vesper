import { Text } from './Text';

type SectionTitleProps = {
  children: string;
};

/**
 * The small title above a block of a page: 'Esta semana', 'General'. One style for
 * Section and ListGroup alike, and a heading to VoiceOver so the rotor can jump.
 */
export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <Text variant="label" tone="secondary" accessibilityRole="header">
      {children}
    </Text>
  );
}
