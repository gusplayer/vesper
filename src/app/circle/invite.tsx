import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useEffect, useRef, useState } from 'react';
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
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  QrCode,
  Screen,
  Section,
  Stack,
  StatusNote,
  Text,
} from '../../design/components';
import { MAX_CIRCLE, type Member } from '../../domain/types';
import {
  accountProblem,
  attemptFailed,
  attemptNeedsHandle,
  checkInviteCode,
  type AccountProblem,
  type InviteAttempt,
} from '../../features/circle/inviteAttempt';
import { codeFieldText, invitePageLinkFor } from '../../features/circle/inviteLink';
import { useIsDemoCircle } from '../../features/circle/useCircleSyncStatus';
import { useStrings } from '../../i18n';
import {
  acceptCircleInvite,
  claimInviteCode,
  endCircleLink,
  ensureInviteCode,
  inviteCodeConfirmed,
  redeemCircleCode,
  type AccountOutcome,
} from '../../platform/hooks/useCircleSync';

/** What the line under the requests says after "Aceptar", when there is something to say. */
type AcceptLine = 'full' | 'queued' | 'gone';

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
 * "Invitar", so nobody lands here by accident. When the account is born over the demo
 * circle, the samples go, and the card says so.
 *
 * Until the server has said **this very code** is this account's, the code and its QR
 * are not drawn and nothing shares it: a code generated offline, or one whose claim
 * failed, is nobody's (`inviteCodeConfirmed`). Everything else on the screen keeps
 * working, because a network failure never blocks a screen (ADR-0044 §5).
 *
 * What goes out is the invitation page (ADR-0034), not the app's own scheme: it opens
 * on a phone without Vesper, and a messenger makes it tappable.
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
  const confirmedGeneration = useCircleStore((state) => state.confirmedGeneration);
  const acceptInvite = useCircleStore((state) => state.acceptInvite);
  const declineInvite = useCircleStore((state) => state.declineInvite);
  const removeFromCircle = useCircleStore((state) => state.removeFromCircle);
  const linkEndSupport = useCircleStore((state) => state.linkEndSupport);
  const regenerateInviteCode = useCircleStore((state) => state.regenerateInviteCode);
  const demo = useIsDemoCircle();

  const [codeText, setCodeText] = useState('');
  const [result, setResult] = useState<InviteAttempt | null>(null);
  const [sending, setSending] = useState(false);
  const [acceptLine, setAcceptLine] = useState<AcceptLine | null>(null);
  // What Rechazar or Quitar could not finish on the server (ADR-0049), said once.
  const [endLine, setEndLine] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  // The last claim's answer, keyed on the handle it was made with: after "Cambiar tu
  // alias" the old refusal is about a handle that no longer exists, and is not shown.
  const [claimed, setClaimed] = useState<{ handle: string; problem: AccountProblem | null } | null>(null);
  // Whether the samples were on screen when the screen opened: if the account is born
  // here, they are gone a second later, and the card says where they went.
  const [openedOnDemo] = useState(demo);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const inCircle = members.filter((member) => member.status === 'member' || member.status === 'invited');
  const seatsTaken = useSeatsTaken();
  const ready = inviteCodeConfirmed({ account, profile, confirmedGeneration });
  const problem = claimed !== null && claimed.handle === profile?.handle ? claimed.problem : null;
  // Without a profile there is nothing to claim and nothing to show: say which,
  // rather than leaving "Preparando…" on screen forever.
  const shown: AccountProblem | null = profile === null ? 'noProfile' : problem;
  // Not ready and nothing refused: the claim on mount is still out. The buttons wait.
  const preparing = profile !== null && !ready && problem === null;
  const busy = claiming || preparing;
  const link = ready && code !== null ? invitePageLinkFor(code) : null;

  /**
   * The code, claimed, from a tap. Answers whether the invitation can go out; the
   * caller decides what to do next. The buttons are busy while it runs, and
   * `ensureCircleAccount` is single-flight, so no second claim starts while one is out.
   */
  const claim = async (register: (at: number) => Promise<AccountOutcome>): Promise<boolean> => {
    setClaiming(true);
    const outcome = await register(Date.now());
    const failure = accountProblem(outcome);
    if (mounted.current) {
      setClaiming(false);
      setClaimed({ handle: useCircleStore.getState().profile?.handle ?? '', problem: failure });
    }
    return failure === null;
  };

  // The code is the invitation: it is reserved the moment the screen shows it, not
  // when a share sheet happens to open — and claimed again when the one on screen is
  // not the one the server holds (a new code generated offline).
  //
  // It runs again when the handle changes, which is the way out of `handleTaken` and
  // `handleInvalid`: pick another one in Ajustes › Círculo, come back, and the code is
  // claimed with it. Not on `profile` itself, because "Generar código nuevo" also
  // writes the profile and already claims on its own.
  const profileId = profile?.id ?? null;
  const handle = profile?.handle ?? null;
  useEffect(() => {
    if (profileId === null || handle === null || inviteCodeConfirmed(useCircleStore.getState())) {
      return;
    }
    let live = true;
    void ensureInviteCode(Date.now()).then((outcome) => {
      if (live) {
        setClaimed({ handle, problem: accountProblem(outcome) });
      }
    });
    return () => {
      live = false;
    };
  }, [profileId, handle]);

  const share = () => {
    void (async () => {
      if (!(await claim(ensureInviteCode))) {
        return;
      }
      // The claim may have bumped the generation past a collision, so the code that
      // goes out is read again rather than closed over.
      const current = getInviteCode();
      if (current === null) {
        return;
      }
      await Share.share({ message: copy.shareMessage(current, invitePageLinkFor(current)) });
    })();
  };

  const confirmNewCode = () => {
    Alert.alert(copy.newCodeQuestion, copy.newCodeMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.newCodeConfirm,
        onPress: () => {
          regenerateInviteCode(Date.now());
          // A new generation is only a new code once the server has it: until then the
          // card draws no code, and opening this screen again claims it again.
          void claim(claimInviteCode);
        },
      },
    ]);
  };

  // A pasted link works as well as a typed code: the field keeps the code inside it.
  // What this phone can answer on its own it answers here; everything else is one
  // request, and its line says which.
  const send = () => {
    if (sending) {
      return;
    }
    const checked = checkInviteCode(profile, members, codeText);
    if (checked.kind === 'stop') {
      setResult(checked.outcome);
      return;
    }
    void (async () => {
      setResult(null);
      setSending(true);
      const outcome = await redeemCircleCode(checked.code, Date.now());
      if (!mounted.current) {
        return;
      }
      setSending(false);
      setResult(outcome);
      if (!attemptFailed(outcome)) {
        setCodeText('');
      }
    })();
  };

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering. The
  // "yes" is written here first, then sent on its own (the sync cannot carry it).
  const accept = (member: Member, tappedAt: number) => {
    if (acceptInvite(member.id, tappedAt) === 'full') {
      setAcceptLine('full');
      return;
    }
    setAcceptLine(null);
    void acceptCircleInvite(member.id).then((sent) => {
      if (mounted.current && (sent === 'queued' || sent === 'gone')) {
        setAcceptLine(sent);
      }
    });
  };

  /** The end goes to the server after the local write; the line says what did not arrive. */
  const endOnServer = (memberId: string, unsupported: string) => {
    setEndLine(null);
    void endCircleLink(memberId).then((outcome) => {
      if (!mounted.current) {
        return;
      }
      setEndLine(outcome === 'unsupported' ? unsupported : outcome === 'queued' ? copy.endQueued : null);
    });
  };

  const decline = (member: Member, tappedAt: number) => {
    declineInvite(member.id, tappedAt);
    endOnServer(member.id, copy.declineUnsupported);
  };

  const confirmRemove = (member: Member) => {
    // A server that predates ADR-0049 cannot end a link: once it has said so, the alert
    // says what "Quitar" really does before anything happens.
    const message = account !== null && linkEndSupport === 'no' ? copy.removeMessageAccount : copy.removeMessage;
    Alert.alert(copy.removeQuestion(member.name), message, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.removeConfirm,
        style: 'destructive',
        onPress: () => {
          removeFromCircle(member.id, Date.now());
          endOnServer(member.id, copy.removeUnsupported);
        },
      },
    ]);
  };

  const changeHandle = () => router.push('/settings/circle');

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={
        <Button label={copy.share} busyLabel={copy.sharing} busy={busy} onPress={share} disabled={code === null} />
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.circle)} title={copy.title} />

      <Card>
        <Stack gap="md" align="center">
          <Stack gap="xs" align="center">
            <Text variant="caption" tone="secondary">
              {copy.yourCode}
            </Text>
            <Text variant="title">{ready && code !== null ? code : t.common.empty}</Text>
          </Stack>
          {link === null || code === null ? null : <QrCode value={link} accessibilityLabel={copy.qrA11y(code)} />}
          {shown === null ? (
            <>
              <Text variant="label" tone="secondary" align="center">
                {ready ? copy.yourCodeHint : copy.preparing}
              </Text>
              {ready ? <StatusNote text={copy.qrHint} align="center" /> : null}
            </>
          ) : shown === 'noProfile' ? (
            // Not an error: the first step. Said plainly, with the way to take it.
            <>
              <StatusNote text={copy.problem.noProfile} align="center" />
              <Button
                label={t.circle.list.createProfile}
                variant="secondary"
                size="sm"
                onPress={() => router.push('/settings/circle')}
              />
            </>
          ) : (
            <StatusNote text={copy.problem[shown]} tone="danger" align="center" live />
          )}
          {openedOnDemo && account !== null ? <StatusNote text={copy.demoGone} align="center" live /> : null}
        </Stack>
      </Card>
      {attemptNeedsHandle(shown) ? <Button label={copy.changeHandle} variant="ghost" onPress={changeHandle} /> : null}
      <Button label={copy.newCode} variant="ghost" onPress={confirmNewCode} disabled={code === null || busy} />

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
                    <Button
                      size="sm"
                      label={copy.accept}
                      onPress={() => accept(member, Date.now())}
                      accessibilityLabel={copy.acceptA11y(member.name)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      tone="danger"
                      label={copy.decline}
                      onPress={() => decline(member, Date.now())}
                      accessibilityLabel={copy.declineA11y(member.name)}
                    />
                  </Stack>
                }
              />
            ))}
          </ListGroup>
        </Section>
      )}
      {endLine === null ? null : <StatusNote text={endLine} live />}
      {acceptLine === null ? null : (
        <StatusNote
          text={acceptLine === 'full' ? copy.acceptFull : acceptLine === 'queued' ? copy.acceptQueued : copy.acceptGone}
          tone={acceptLine === 'full' ? 'danger' : 'secondary'}
          live
        />
      )}

      <Section title={copy.enterTitle}>
        <FieldRow
          label={copy.codeField}
          value={codeText}
          onChangeText={(text) => {
            setCodeText(codeFieldText(text));
            setResult(null);
          }}
          placeholder={copy.codePlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Button
          label={copy.send}
          variant="secondary"
          size="sm"
          busyLabel={copy.sending}
          busy={sending}
          onPress={send}
          disabled={codeText.trim() === ''}
        />
        {result === null ? (
          <StatusNote text={copy.enterHint} />
        ) : (
          <StatusNote text={copy.result[result]} tone={attemptFailed(result) ? 'danger' : 'secondary'} live />
        )}
        {result !== null && attemptNeedsHandle(result) ? (
          <Button label={copy.changeHandle} variant="ghost" onPress={changeHandle} />
        ) : null}
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
          <StatusNote kind="empty" text={t.circle.list.noMembers} />
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
                right={
                  <Button
                    size="sm"
                    variant="secondary"
                    tone="danger"
                    label={copy.remove}
                    onPress={() => confirmRemove(member)}
                    accessibilityLabel={copy.removeA11y(member.name)}
                  />
                }
              />
            ))}
          </ListGroup>
        )}
        <StatusNote text={copy.deliveryNote} />
      </Section>
    </Screen>
  );
}
