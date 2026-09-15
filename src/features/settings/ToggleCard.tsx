import { Card, Stack, Text, Toggle } from '../../design/components';

type ToggleCardProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/**
 * A card with a title, a sentence and a toggle on the right, like each rule in
 * Brick's settings. Shared by the rules, Live Activities and schedule pages.
 */
export function ToggleCard({ title, description, value, onValueChange }: ToggleCardProps) {
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
        </Stack>
        <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
      </Stack>
    </Card>
  );
}
