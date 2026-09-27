import { useState } from 'react';

import { Button, FieldRow, ListGroup, ListRow, Sheet, StatusNote } from '../../design/components';
import { useStrings } from '../../i18n';

/** Why a photo is reported, in the order the sheet lists them (ADR-0051 §18). */
export const REPORT_REASONS = ['unwanted', 'consent', 'minor', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** The note travels with the report; the server refuses anything longer. */
export const REPORT_NOTE_MAX = 200;

/** Sent, or kept to go out with the next connection: either way the photo is gone here. */
export type ReportSent = 'sent' | 'queued';

type PhotoOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Whose photo it is: 'Ocultar las fotos de Ana', 'Bloquear a Ana'. */
  name: string;
  /**
   * Sends the report. Resolves with how it went, or null when it could not be sent at
   * all; then the sheet stays, says so, and nothing was hidden.
   */
  onReport: (reason: ReportReason, note: string | null) => Promise<ReportSent | null>;
  /** After a report went: the sheet has closed and the viewer says what happened. */
  onReported: (sent: ReportSent) => void;
  /**
   * "Ocultar las fotos de Ana": only for you, reversible in Ajustes › Círculo. Left out
   * (with `onBlock`) when the person is no longer in the circle: there is nobody to name.
   */
  onHide?: () => void;
  /** "Bloquear a Ana": asks first (the caller's alert), over the sheet. */
  onBlock?: () => void;
};

type Step = 'menu' | 'report';

/**
 * The "…" of someone else's photo (ADR-0051 §18): report the photo, hide that person's
 * photos for you, or block them. Nothing here reacts to the photo, and nothing counts.
 *
 * Reporting happens in the same sheet, one step further: a reason (one of four, as
 * radios) and an optional note, and the line that says nobody will know it was you. A
 * second sheet opened as the first closes can fail to appear on iOS, so the sheet
 * changes its content instead. Closing it forgets the half-written report.
 */
export function PhotoOptionsSheet({
  visible,
  onClose,
  name,
  onReport,
  onReported,
  onHide,
  onBlock,
}: PhotoOptionsSheetProps) {
  const t = useStrings().photos;
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = () => {
    setStep('menu');
    setReason(null);
    setNote('');
    setSending(false);
    setFailed(false);
  };

  const close = () => {
    if (sending) {
      return;
    }
    reset();
    onClose();
  };

  const send = async () => {
    if (reason === null || sending) {
      return;
    }
    setSending(true);
    setFailed(false);
    const trimmed = note.trim();
    const sent = await onReport(reason, trimmed === '' ? null : trimmed.slice(0, REPORT_NOTE_MAX));
    setSending(false);
    if (sent === null) {
      setFailed(true);
      return;
    }
    reset();
    onClose();
    onReported(sent);
  };

  return (
    <Sheet visible={visible} title={step === 'menu' ? t.options.title : t.report.title} onClose={close}>
      {step === 'menu' ? (
        <ListGroup>
          <ListRow icon="flag" label={t.options.report} kind="action" onPress={() => setStep('report')} />
          {onHide === undefined ? null : (
            <ListRow
              icon="eye-off"
              label={t.options.hide(name)}
              description={t.options.hideHint}
              kind="action"
              onPress={onHide}
            />
          )}
          {onBlock === undefined ? null : (
            <ListRow icon="slash" label={t.options.block(name)} tone="danger" kind="action" onPress={onBlock} />
          )}
        </ListGroup>
      ) : (
        <>
          <ListGroup footer={t.report.anonymous}>
            {REPORT_REASONS.map((option) => (
              <ListRow
                key={option}
                label={t.report.reasons[option]}
                selection="radio"
                selected={reason === option}
                disabled={sending}
                onPress={() => setReason(option)}
              />
            ))}
          </ListGroup>
          <FieldRow
            label={t.report.note}
            value={note}
            onChangeText={setNote}
            placeholder={t.report.notePlaceholder}
            maxLength={REPORT_NOTE_MAX}
            multiline
            editable={!sending}
          />
          <Button
            label={t.report.send}
            busyLabel={t.report.sending}
            busy={sending}
            disabled={reason === null}
            onPress={() => void send()}
          />
          {failed ? <StatusNote text={t.report.failed} tone="danger" align="center" live /> : null}
        </>
      )}
    </Sheet>
  );
}
