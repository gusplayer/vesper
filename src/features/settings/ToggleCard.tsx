import { Card, Stack, Text, Toggle } from '../../design/components';

type ToggleCardProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /**
   * A line under the description that qualifies the switch: what this phone does not
   * apply ('Todavía no llega al sistema en este teléfono'). A switch that changes
   * nothing says so on the card itself, not only in a footer (CLAUDE.md: no flag
   * passes for a capability).
   */
  note?: string;
  /** The capability does not exist here: the switch is shown, dimmed, and cannot move. */
  disabled?: boolean;
};

/**
 * A card with a title, a sentence and a toggle on the right, like each rule in
 * Brick's settings. Shared by the rules and Live Activities pages. VoiceOver reads
 * the title as the switch's name and the description (and note) as its hint.
 */
export function ToggleCard({ title, description, value, onValueChange, note, disabled = false }: ToggleCardProps) {
  return (
    <Card>
      <Stack direction="row" align="center" gap="lg">
        <Stack grow gap="xs">
          <Text variant="body" weight="medium">
            {title}
          </Text>
          <Text variant="label" tone="secondary">
            {description}
          </Text>
          {note === undefined ? null : (
            <Text variant="caption" tone="secondary">
              {note}
            </Text>
          )}
        </Stack>
        <Toggle
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={title}
          accessibilityHint={note === undefined ? description : `${description}. ${note}`}
          disabled={disabled}
        />
      </Stack>
    </Card>
  );
}
