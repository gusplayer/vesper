import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share } from 'react-native';

import { useCircleMembers, useCircleStore, useInviteCode, usePendingInvites } from '../../data';
import {
  Button,
  Chip,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  StatCard,
  Text,
} from '../../design/components';
import { MAX_CIRCLE, type Member } from '../../domain/types';
import { useStrings } from '../../i18n';

type InviteResult = 'ok' | 'invalid' | 'full' | 'self';

/**
 * Invitar: the user's code to share, a field for someone else's, the invitations
 * waiting for an answer, and who is already in. There is no server yet, so sending
 * an invitation only adds an 'invited' row here; the last line says so.
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

  const [codeText, setCodeText] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);
  const [acceptFull, setAcceptFull] = useState(false);

  const inCircle = members.filter((member) => member.status === 'member' || member.status === 'invited');
  const memberCount = members.filter((member) => member.status === 'member').length;

  const share = () => {
    if (code === null) {
      return;
    }
    void Share.share({ message: copy.shareMessage(code) });
  };

  const send = () => {
    const outcome = invite(codeText, Date.now());
    setResult(outcome);
    if (outcome === 'ok') {
      setCodeText('');
    }
  };

  const accept = (member: Member) => {
    setAcceptFull(acceptInvite(member.id, Date.now()) === 'full');
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

      <StatCard label={copy.yourCode} value={code ?? t.common.empty} description={copy.yourCodeHint} />

      <Stack gap="sm">
        <FieldRow
          label={copy.codeField}
          value={codeText}
          onChangeText={(text) => {
            setCodeText(text);
            setResult(null);
          }}
          placeholder={copy.codePlaceholder}
        />
        <Button label={copy.send} variant="ghost" onPress={send} disabled={codeText.trim() === ''} />
        {result === null ? null : (
          <Text variant="label" tone={result === 'ok' ? 'secondary' : 'danger'} align="center">
            {copy.result[result]}
          </Text>
        )}
      </Stack>

      {pending.length === 0 ? null : (
        <Section title={copy.pending}>
          <ListGroup>
            {pending.map((member) => (
              <ListRow
                key={member.id}
                label={member.name}
                description={`@${member.handle} · ${copy.invitedYou}`}
                right={
                  <Stack direction="row" gap="sm">
                    <Chip label={copy.accept} selected onPress={() => accept(member)} />
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

      <Section
        title={copy.members}
        right={
          <Text variant="label" tone="secondary">
            {copy.count(memberCount, MAX_CIRCLE)}
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
                description={member.status === 'invited' ? `@${member.handle} · ${copy.waiting}` : `@${member.handle}`}
                right={<Chip label={copy.remove} selected={false} onPress={() => confirmRemove(member)} />}
              />
            ))}
          </ListGroup>
        )}
        <Text variant="caption" tone="tertiary">
          {copy.prototypeNote}
        </Text>
      </Section>
    </Screen>
  );
}
