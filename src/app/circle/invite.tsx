import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share } from 'react-native';

import { useCircleMembers, useCircleStore, useInviteCode, usePendingInvites, useSeatsTaken } from '../../data';
import type { InviteResult } from '../../data/stores/circle';
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
import { CODE_LENGTH, codeFromInviteLink, inviteLinkFor } from '../../domain/circle';
import { MAX_CIRCLE, type Member } from '../../domain/types';
import { useStrings } from '../../i18n';

/**
 * Invitar. Two directions, kept apart on purpose: your code (with its QR and a share
 * sheet that sends the link too), and someone else's code, which asks to join their
 * circle. A code is a request, not a key: whoever uses yours waits until you accept
 * (ADR-0021). There is no server yet, so a request only adds an 'invited' row here;
 * the last line says so.
 */
export default function InviteScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.circle.invite;
  const code = useInviteCode();
  const members = useCircleMembers();
  const pending = usePendingInvites();
  const invite = useCircleStore((state) => state.invite);
  const acceptInvite = useCircleStore((state) => state.acceptInvite);
  const declineInvite = useCircleStore((state) => state.declineInvite);
  const removeMember = useCircleStore((state) => state.removeMember);
  const regenerateInviteCode = useCircleStore((state) => state.regenerateInviteCode);

  const [codeText, setCodeText] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);
  const [acceptFull, setAcceptFull] = useState(false);

  const inCircle = members.filter((member) => member.status === 'member' || member.status === 'invited');
  const seatsTaken = useSeatsTaken();
  const link = code === null ? null : inviteLinkFor(code);

  const share = () => {
    if (code === null || link === null) {
      return;
    }
    void Share.share({ message: copy.shareMessage(code, link) });
  };

  const confirmNewCode = () => {
    Alert.alert(copy.newCodeQuestion, copy.newCodeMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: copy.newCodeConfirm, onPress: () => regenerateInviteCode(Date.now()) },
    ]);
  };

  // A pasted link works as well as a typed code. Nobody can be looked up yet, so the
  // outcome is always a reason (domain/circle.inviteCodeOutcome); the line says which.
  const send = () => {
    setResult(invite(codeFromInviteLink(codeText) ?? codeText));
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
    <Screen scroll footer={<Button label={copy.share} onPress={share} disabled={code === null} />}>
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
          <Text variant="label" tone="secondary" align="center">
            {copy.yourCodeHint}
          </Text>
          <Text variant="caption" tone="tertiary" align="center">
            {copy.qrHint}
          </Text>
        </Stack>
      </Card>
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
        <Button label={copy.send} variant="secondary" onPress={send} disabled={codeText.trim() === ''} />
        <Text variant="label" tone={result === null ? 'tertiary' : 'danger'}>
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
