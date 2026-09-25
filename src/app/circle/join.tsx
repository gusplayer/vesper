import { useLocalSearchParams, useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useEffect, useRef, useState } from 'react';

import { useCircleMembers, useProfile } from '../../data';
import { Button, NoticeCard, PageHeader, Screen, StatusNote } from '../../design/components';
import { normalizeInviteCode } from '../../domain/circle';
import {
  attemptFailed,
  attemptNeedsHandle,
  attemptRetryable,
  checkInviteCode,
  type InviteAttempt,
} from '../../features/circle/inviteAttempt';
import { useStrings } from '../../i18n';
import { redeemCircleCode } from '../../platform/hooks/useCircleSync';

/**
 * Where an invite link lands: vesper://circle/join?code=ABC234 (the invitation page of
 * ADR-0034 jumps here with its "Abrir Vesper"). Shows the code, says what asking to join
 * means, and asks with one tap.
 *
 * Without a profile it opens Ajustes › Círculo **on top of this screen**, so saving the
 * profile comes straight back here with the code still in the route: nobody has to go
 * back to the chat and tap the link again. After the request, the one button leads to
 * the circle.
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
  // Keyed on the handle it was asked with: after "Cambiar tu alias" an old refusal is
  // about a handle that no longer exists, and asking again is allowed.
  const [answer, setAnswer] = useState<{ handle: string; outcome: InviteAttempt } | null>(null);
  const result = answer !== null && answer.handle === profile?.handle ? answer.outcome : null;
  const [sending, setSending] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = () => {
    if (code === null) {
      return;
    }
    const asked = profile?.handle ?? '';
    const checked = checkInviteCode(profile, members, code);
    if (checked.kind === 'stop') {
      setAnswer({ handle: asked, outcome: checked.outcome });
      return;
    }
    void (async () => {
      setAnswer(null);
      setSending(true);
      const outcome = await redeemCircleCode(checked.code, Date.now());
      if (mounted.current) {
        setSending(false);
        setAnswer({ handle: asked, outcome });
      }
    })();
  };

  const toProfile = () => router.push('/settings/circle');

  if (profile === null) {
    return (
      <Screen footer={<Button label={copy.createProfile} onPress={toProfile} />}>
        <PageHeader onClose={() => goBack(router, BACK_FALLBACK.circle)} title={copy.title} />
        <NoticeCard icon="user" title={copy.noProfileTitle} body={copy.noProfileBody} />
      </Screen>
    );
  }

  // Asking again can only answer differently when the request never arrived or the
  // server asked to wait. Anything else answers the same way every time, and each try
  // spends one of the ten redemptions the server allows in an hour.
  const done = result !== null && !attemptFailed(result);
  const stuck = result !== null && attemptFailed(result) && !attemptRetryable(result);

  const footer =
    code === null ? (
      // A link with no code in it: the field to type one is on the invite screen.
      <Button label={copy.typeCode} onPress={() => router.replace('/circle/invite')} />
    ) : done ? (
      <Button label={t.circle.section.seeCircle} onPress={() => router.replace('/circle')} />
    ) : (
      <>
        <Button
          label={copy.request}
          busyLabel={t.circle.invite.sending}
          busy={sending}
          onPress={request}
          disabled={stuck}
        />
        {result !== null && attemptNeedsHandle(result) ? (
          <Button label={t.circle.invite.changeHandle} variant="ghost" onPress={toProfile} />
        ) : null}
      </>
    );

  return (
    <Screen footer={footer}>
      <PageHeader onClose={() => goBack(router, BACK_FALLBACK.circle)} title={copy.title} />
      {code === null ? (
        <NoticeCard icon="link" title={copy.noCode} />
      ) : (
        <NoticeCard icon="users" title={copy.body(code)} body={copy.explain} />
      )}
      {result === null ? null : (
        <StatusNote
          text={t.circle.invite.result[result]}
          tone={attemptFailed(result) ? 'danger' : 'secondary'}
          align="center"
          live
        />
      )}
      {code === null ? null : <StatusNote text={t.circle.invite.deliveryNote} align="center" />}
    </Screen>
  );
}
