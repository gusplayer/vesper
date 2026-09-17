import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useCircleStore, useProfile } from '../../data';
import type { InviteResult } from '../../data/stores/circle';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { normalizeInviteCode } from '../../domain/circle';
import { useStrings } from '../../i18n';

/**
 * Where an invite link lands: vesper://circle/join?code=ABC234. Shows the code, says
 * what asking to join means, and asks with one tap. Without a profile it sends the
 * user to create one first; the link can be tapped again afterwards (ADR-0021).
 */
export default function JoinScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.circle.join;
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normalizeInviteCode(params.code ?? '');
  const profile = useProfile();
  const invite = useCircleStore((state) => state.invite);
  const [result, setResult] = useState<InviteResult | null>(null);

  // Nobody can be looked up yet (domain/circle.inviteCodeOutcome): asking always
  // answers with a reason, and the line under the card says which.
  const request = () => {
    if (code === null) {
      return;
    }
    setResult(invite(code));
  };

  if (profile === null) {
    return (
      <Screen footer={<Button label={copy.createProfile} onPress={() => router.replace('/settings/circle')} />}>
        <PageHeader onClose={() => router.back()} title={copy.title} />
        <Stack gap="sm">
          <Text variant="heading">{copy.noProfileTitle}</Text>
          <Text variant="body" tone="secondary">
            {copy.noProfileBody}
          </Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button label={copy.request} onPress={request} disabled={code === null || result !== null} />}
    >
      <PageHeader onClose={() => router.back()} title={copy.title} />
      <Card>
        <Stack gap="sm">
          <Text variant="heading">{code === null ? copy.noCode : copy.body(code)}</Text>
          {code === null ? null : (
            <Text variant="label" tone="secondary">
              {copy.explain}
            </Text>
          )}
        </Stack>
      </Card>
      {result === null ? null : (
        <Text variant="label" tone="danger" align="center">
          {t.circle.invite.result[result]}
        </Text>
      )}
      <Text variant="caption" tone="tertiary" align="center">
        {t.circle.invite.prototypeNote}
      </Text>
    </Screen>
  );
}
