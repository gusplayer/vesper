import { ExplainerBlock, PageHeader, Screen, Stack, Text, type IconName } from '../../design/components';
import { PermissionFooter, type PermissionFooterProps } from './PermissionFooter';
import type { StepProgress } from './steps';

export type PermissionBlock = {
  icon: IconName;
  heading: string;
  body: string;
};

type PermissionPageProps = {
  title: string;
  blocks: readonly PermissionBlock[];
  onBack: () => void;
  /** The onboarding's dots, on the steps that are part of it. */
  progress?: StepProgress;
} & PermissionFooterProps;

/**
 * The shape Brick uses to ask for a permission: a title, the explainer blocks and
 * the footer. The request behind the primary is real (`platform/*.requestAuthorization`,
 * rule 8). The footer has one contract (`PermissionFooter`): a primary that asks or,
 * where nothing can be asked, moves on; "Ahora no" while something can be asked; and
 * one line that says what the system will do or why it cannot.
 */
export function PermissionPage(props: PermissionPageProps) {
  const { title, blocks, onBack, progress } = props;
  return (
    <Screen scroll footer={<PermissionFooter primary={props.primary} skip={props.skip} note={props.note} />}>
      <PageHeader onBack={onBack} progress={progress} />
      <Text variant="title">{title}</Text>
      <Stack gap="xxl">
        {blocks.map((block) => (
          <ExplainerBlock key={block.heading} icon={block.icon} heading={block.heading} body={block.body} />
        ))}
      </Stack>
    </Screen>
  );
}
