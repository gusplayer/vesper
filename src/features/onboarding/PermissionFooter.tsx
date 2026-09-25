import { Button, StatusNote } from '../../design/components';

export type PermissionPrimary = { label: string; onPress: () => void; busy?: boolean; busyLabel?: string };
export type PermissionSkip = { label: string; onPress: () => void };

export type PermissionFooterProps = {
  /** The one primary: ask, or move on where there is nothing left to ask. */
  primary: PermissionPrimary;
  /**
   * "Ahora no". Present whenever the primary asks for something: the onboarding never
   * demands a permission (ADR-0026). Absent when the primary already moves on.
   */
  skip?: PermissionSkip;
  /** The line under the buttons: what the system will do, or why it cannot. */
  note?: string | null;
};

/**
 * The footer every permission step shares, so they cannot drift apart again: one
 * primary, an optional "Ahora no" that is off while the system is asking, and one
 * line of explanation. `PermissionPage` draws it from its own props.
 */
export function PermissionFooter({ primary, skip, note }: PermissionFooterProps) {
  return (
    <>
      <Button
        label={primary.label}
        onPress={primary.onPress}
        busy={primary.busy ?? false}
        busyLabel={primary.busyLabel}
      />
      {skip === undefined ? null : (
        <Button variant="ghost" label={skip.label} onPress={skip.onPress} disabled={primary.busy === true} />
      )}
      {note === undefined || note === null ? null : <StatusNote text={note} align="center" live />}
    </>
  );
}
