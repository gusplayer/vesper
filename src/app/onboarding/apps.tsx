import { router } from 'expo-router';

import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, NativeHost, NoticeCard, PageHeader, Screen, StatusNote, Text } from '../../design/components';
import { CatalogueApps } from '../../features/onboarding/CatalogueApps';
import { readAppsStepKind } from '../../features/onboarding/readAppsStepKind';
import { stepProgress } from '../../features/onboarding/steps';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { SelectionPicker as NativeSelectionPicker } from '../../platform/BlockingSelectionView';
import { selectionSummary, selectionSummaryText } from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

const NEXT = '/onboarding/routine';

/**
 * The apps the first mode blocks: one list, the same one the mode editor shows
 * (ADR-0047 §2). It comes after the permission step (ADR-0016), so it knows which:
 *
 * - Blocking granted: the real picker — Screen Time's own on iOS, the phone's apps on
 *   Android. Its token is the mode's list, and the only thing the shield reads.
 * - Access skipped or refused: the step says so as a plain fact and picks nothing.
 *   The mode blocks no apps until the access exists; that is a valid mode, not an
 *   error (ADR-0047 §1).
 * - No real picker on this phone (simulator, iOS without the entitlement): the
 *   example catalogue, with the reason once at the top.
 *
 * Choosing nothing is always allowed: "Continuar" is never off here.
 */
export default function AppsScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const selectionToken = useOnboardingDraft((state) => state.selectionToken);
  const setSelectionToken = useOnboardingDraft((state) => state.setSelectionToken);

  const copy = t.onboarding.apps;
  const next = () => router.push(NEXT);
  const kind = readAppsStepKind();

  if (kind === 'example') {
    return <CatalogueApps onContinue={next} />;
  }

  const header = (
    <>
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('apps', t.onboarding.progress)} />
      <Text variant="title">{copy.title(modeName)}</Text>
    </>
  );

  if (kind === 'notGranted') {
    return (
      <Screen scroll footer={<Button label={t.common.continue} onPress={next} />}>
        {header}
        <NoticeCard
          icon="info"
          title={copy.blocksNone}
          body={isAndroid ? copy.notGrantedBodyAndroid : copy.notGrantedBody}
        />
      </Screen>
    );
  }

  const summary = selectionSummary(selectionToken);
  const picked = summary.apps + summary.categories + summary.websites > 0;
  return (
    <Screen scroll footer={<Button label={t.common.continue} onPress={next} />}>
      {header}
      <Text variant="label" tone="secondary">
        {isAndroid ? copy.androidSubtitle : copy.realSubtitle}
      </Text>
      <Card padded={false}>
        <NativeHost>
          <NativeSelectionPicker token={selectionToken} onChange={setSelectionToken} />
        </NativeHost>
      </Card>
      <StatusNote
        text={picked ? copy.blocks(selectionSummaryText(selectionToken)) : copy.blocksNone}
        align="center"
        live
      />
    </Screen>
  );
}
