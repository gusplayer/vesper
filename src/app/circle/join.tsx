import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useCircleMembers, useProfile } from '../../data';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { normalizeInviteCode } from '../../domain/circle';
import { attemptFailed, checkInviteCode, type InviteAttempt } from '../../features/circle/inviteAttempt';
import { useStrings } from '../../i18n';
import { redeemCircleCode } from '../../platform/hooks/useCircleSync';

/**
 * Where an invite link lands: vesper://circle/join?code=ABC234. Shows the code, says
 * what asking to join means, and asks with one tap. Without a profile it sends the
 * user to create one first; the link can be tapped again afterwards (ADR-0021).
 *
 * Asking is the other moment the account is born (ADR-0044 §2): `redeemCircleCode`
 * claims it and then redeems, so a phone that has never invited anybody still gets a
 * real request out on the first tap. What comes back is one line under the card —
 * never a modal, never a screen that stops working (ADR-0044 §5).
 */
export default function JoinScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.circle.join;
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normalizeInviteCode(params.code ?? '');
  const profile = useProfile();
  const members = useCircleMembers();
  const [result, setResult] = useState<InviteAttempt | null>(null);
  const [sending, setSending] = useState(false);

  const request = () => {
    if (code === null) {
      return;
    }
    const checked = checkInviteCode(profile, members, code);
    if (checked.kind === 'stop') {
      setResult(checked.outcome);
      return;
    }
    void (async () => {
      setSending(true);
      const outcome = await redeemCircleCode(checked.code, Date.now());
      setSending(false);
      setResult(outcome);
    })();
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

  // A refusal that the network caused can be tried again; one this phone decided
  // (the code is yours, the circle is full) will answer the same way every time.
  const retryable = result !== null && attemptFailed(result) && result !== 'self' && result !== 'full';
  const done = result !== null && !retryable;

  return (
    <Screen
      footer={
        <Button
          label={copy.request}
          busyLabel={t.circle.invite.preparing}
          busy={sending}
          onPress={request}
          disabled={code === null || done}
        />
      }
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
        <Text variant="label" tone={attemptFailed(result) ? 'danger' : 'secondary'} align="center">
          {t.circle.invite.result[result]}
        </Text>
      )}
      <Text variant="caption" tone="secondary" align="center">
        {t.circle.invite.prototypeNote}
      </Text>
    </Screen>
  );
}
