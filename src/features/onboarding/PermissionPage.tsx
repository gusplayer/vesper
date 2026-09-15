import type { ReactNode } from 'react';

import { PageHeader, Screen, Stack, Text, type IconName } from '../../design/components';
import { ExplainerBlock } from '../../design/components';

export type PermissionBlock = {
  icon: IconName;
  heading: string;
  body: string;
};

type PermissionPageProps = {
  title: string;
  blocks: ReadonlyArray<PermissionBlock>;
  /** The pinned primary button, plus whatever goes under it. */
  footer: ReactNode;
  onBack: () => void;
};

/**
 * The shape Brick uses to ask for a permission: a title, three explainer blocks and
 * a button that, in the prototype, only flips a flag (guide, rule 9).
 */
export function PermissionPage({ title, blocks, footer, onBack }: PermissionPageProps) {
  return (
    <Screen scroll footer={footer}>
      <PageHeader onBack={onBack} />
      <Text variant="title">{title}</Text>
      <Stack gap="xxl">
        {blocks.map((block) => (
          <ExplainerBlock
            key={block.heading}
            icon={block.icon}
            heading={block.heading}
            body={block.body}
          />
        ))}
      </Stack>
    </Screen>
  );
}
