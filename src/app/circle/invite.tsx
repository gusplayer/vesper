import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';

import {
  getInviteCode,
  useCircleMembers,
  useCircleStore,
  useInviteCode,
  usePendingInvites,
  useSeatsTaken,
} from '../../data';
import {
  Button,
  Card,
  Chip,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  QrCode,
  Screen,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { CODE_LENGTH, inviteLinkFor } from '../../domain/circle';
import { MAX_CIRCLE, type Member } from '../../domain/types';
import {
  accountProblem,
  attemptFailed,
  checkInviteCode,
  type AccountProblem,
  type InviteAttempt,
} from '../../features/circle/inviteAttempt';
import { useStrings } from '../../i18n';
import {
  claimInviteCode,
  ensureCircleAccount,
  redeemCircleCode,
  type AccountOutcome,
} from '../../platform/hooks/useCircleSync';

/**
 * Invitar. Two directions, kept apart on purpose: your code (with its QR and a share
 * sheet that sends the link too), and someone else's code, which asks to join their
 * circle. A code is a request, not a key: whoever uses yours waits until you accept
 * (ADR-0021).
 *
 * **This screen is where the account is born** (ADR-0044 §2). Not when the profile is
 * created — that stays local and offline — but here, because this is the first moment
 * somebody else has to be able to find the user. The claim runs on mount rather than
 * on the share tap: the QR is live the instant the screen paints, and there is no
 * "share the QR" gesture to hang the claim on. The two ways in are both an explicit
 * "Invitar", so nobody lands here by accident.
 *
 * Until the server has said the code is this account's, **the QR is not drawn**: a
 * code nobody can redeem must not be shown as if it worked. Everything else on the
 * screen keeps working, because a network failure never blocks a screen (ADR-0044 §5).
 */
export default function InviteScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.circle.invite;
  const code = useInviteCode();
  const members = useCircleMembers();
  const pending = usePendingInvites();
  const profile = useCircleStore((state) => state.profile);
  const account = useCircleStore((state) => state.account);
  const acceptInvite = useCircleStore((state) => state.acceptInvite);
  const declineInvite = useCircleStore((state) => state.declineInvite);
  const removeMember = useCircleStore((state) => state.removeMember);
  const regenerateInviteCode = useCircleStore((state) => state.regenerateInviteCode);

  const [codeText, setCodeText] = useState('');
  const [result, setResult] = useState<InviteAttempt | null>(null);
  const [sending, setSending] = useState(false);
  const [acceptFull, setAcceptFull] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [problem, setProblem] = useState<AccountProblem | null>(null);

  const inCircle = members.filter((member) => member.status === 'member' || member.status === 'invited');
  const seatsTaken = useSeatsTaken();
  const ready = account !== null;
  // Without a profile there is nothing to claim and nothing to show: say which,
  // rather than leaving "Preparando…" on screen forever.
  const shown: AccountProblem | null = profile === null ? 'noProfile' : problem;
  const link = ready && code !== null ? inviteLinkFor(code) : null;

  /**
   * The account, claimed. Answers whether the invitation can go out; the caller
   * decides what to do next. `ensureCircleAccount` is safe to call again — with a key
   * in the keychain it is one read and no request — and `claimInviteCode` is the one
   * that always asks, which is what a freshly generated code needs.
   */
  const claim = async (register: (at: number) => Promise<AccountOutcome>): Promise<boolean> => {
    setProblem(null);
    setClaiming(true);
    const outcome = await register(Date.now());
    const failure = accountProblem(outcome);
    setClaiming(false);
    setProblem(failure);
    return failure === null;
  };

  // The code is the invitation: it is reserved the moment the screen shows it, not
  // when a share sheet happens to open. Nothing is set before the answer comes back —
  // the "preparing" line is what `account === null` already means.
  //
  // It runs again when the handle changes, which is the way out of `handleTaken`:
  // pick another one in Ajustes › Círculo, come back, and the code is claimed with
  // it. Not on `profile` itself, because "Generar código nuevo" also writes the
  // profile and already claims on its own — two claims at once would be two accounts.
  const profileId = profile?.id ?? null;
  const handle = profile?.handle ?? null;
  useEffect(() => {
    if (profileId === null || handle === null || account !== null) {
      return;
    }
    let live = true;
    void ensureCircleAccount(Date.now()).then((outcome) => {
      if (live) {
        setProblem(accountProblem(outcome));
      }
    });
    return () => {
      live = false;
    };
  }, [profileId, handle, account]);

  const share = () => {
    void (async () => {
      if (!(await claim(ensureCircleAccount))) {
        return;
      }
      // The claim may have bumped the generation past a collision, so the code that
      // goes out is read again rather than closed over.
      const claimed = getInviteCode();
      if (claimed === null) {
        return;
      }
      await Share.share({ message: copy.shareMessage(claimed, inviteLinkFor(claimed)) });
    })();
  };

  const confirmNewCode = () => {
    Alert.alert(copy.newCodeQuestion, copy.newCodeMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.newCodeConfirm,
        onPress: () => {
          regenerateInviteCode(Date.now());
          // A new generation is only a new code once the server has it: until then
          // the old six symbols are the ones that work and these are nobody's.
          void claim(claimInviteCode);
        },
      },
    ]);
  };

  // A pasted link works as well as a typed code. What this phone can answer on its
  // own it answers here; everything else is one request, and its line says which.
  const send = () => {
    const checked = checkInviteCode(profile, members, codeText);
    if (checked.kind === 'stop') {
      setResult(checked.outcome);
      return;
    }
    void (async () => {
      setResult(null);
      setSending(true);
      const outcome = await redeemCircleCode(checked.code, Date.now());
      setSending(false);
      setResult(outcome);
      if (!attemptFailed(outcome)) {
        setCodeText('');
      }
    })();
  };

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering.
  const accept = (member: Member, tappedAt: number) => {
    setAcceptFull(acceptInvite(member.id, tappedAt) === 'full');
  };

  const confirmRemove = (member: Member) => {
    Alert.alert(copy.removeQuestion(member.name), copy.removeMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: copy.removeConfirm, style: 'destructive', onPress: () => removeMember(member.id) },
    ]);
  };

  return (
    <Screen
      scroll
      footer={
        <Button
          label={copy.share}
          busyLabel={copy.sharing}
          busy={claiming}
          onPress={share}
          disabled={code === null}
        />
      }
    >
      <PageHeader onBack={() => router.back()} title={copy.title} />

      <Card>
        <Stack gap="md" align="center">
          <Stack gap="xs" align="center">
            <Text variant="caption" tone="secondary">
              {copy.yourCode}
            </Text>
            <Text variant="title">{code ?? t.common.empty}</Text>
          </Stack>
          {link === null || code === null ? null : <QrCode value={link} accessibilityLabel={copy.qrA11y(code)} />}
          {shown === null ? (
            <>
              <Text variant="label" tone="secondary" align="center">
                {ready ? copy.yourCodeHint : copy.preparing}
              </Text>
              {ready ? (
                <Text variant="caption" tone="tertiary" align="center">
                  {copy.qrHint}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="label" tone="danger" align="center">
              {copy.problem[shown]}
            </Text>
          )}
        </Stack>
      </Card>
      {shown === 'handleTaken' ? (
        <Button label={copy.changeHandle} variant="ghost" onPress={() => router.push('/settings/circle')} />
      ) : null}
      <Button label={copy.newCode} variant="ghost" onPress={confirmNewCode} disabled={code === null} />

      {pending.length === 0 ? null : (
        <Section title={copy.pending}>
          <ListGroup>
            {pending.map((member) => (
              <ListRow
                key={member.id}
                label={member.name}
                description={`${t.circle.member.handle(member.handle)} · ${copy.invitedYou}`}
                right={
                  <Stack direction="row" gap="sm">
                    <Chip label={copy.accept} selected onPress={() => accept(member, Date.now())} />
                    <Chip label={copy.decline} selected={false} onPress={() => declineInvite(member.id)} />
                  </Stack>
                }
              />
            ))}
          </ListGroup>
          {acceptFull ? (
            <Text variant="label" tone="danger">
              {copy.acceptFull}
            </Text>
          ) : null}
        </Section>
      )}

      <Section title={copy.enterTitle}>
        <FieldRow
          label={copy.codeField}
          value={codeText}
          onChangeText={(text) => {
            setCodeText(text);
            setResult(null);
          }}
          placeholder={copy.codePlaceholder}
          autoCapitalize="none"
          maxLength={CODE_LENGTH}
        />
        <Button
          label={copy.send}
          variant="secondary"
          busyLabel={copy.preparing}
          busy={sending}
          onPress={send}
          disabled={codeText.trim() === ''}
        />
        <Text
          variant="label"
          tone={result === null ? 'tertiary' : attemptFailed(result) ? 'danger' : 'secondary'}
        >
          {result === null ? copy.enterHint : copy.result[result]}
        </Text>
      </Section>

      <Section
        title={copy.members}
        right={
          <Text variant="label" tone="secondary">
            {copy.count(seatsTaken, MAX_CIRCLE)}
          </Text>
        }
      >
        {inCircle.length === 0 ? (
          <Text variant="label" tone="secondary">
            {t.circle.list.noMembers}
          </Text>
        ) : (
          <ListGroup>
            {inCircle.map((member) => (
              <ListRow
                key={member.id}
                label={member.name}
                description={
                  member.status === 'invited'
                    ? `${t.circle.member.handle(member.handle)} · ${copy.waiting}`
                    : t.circle.member.handle(member.handle)
                }
                right={<Chip label={copy.remove} selected={false} onPress={() => confirmRemove(member)} />}
              />
            ))}
          </ListGroup>
        )}
        <Text variant="caption" tone="secondary">
          {copy.prototypeNote}
        </Text>
      </Section>
    </Screen>
  );
}
