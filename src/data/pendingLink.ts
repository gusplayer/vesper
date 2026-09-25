import { create } from 'zustand';

/**
 * An invitation that arrived before the app could open it.
 *
 * `circle/join` lives behind the onboarding guard, so a `vesper://circle/join?code=…`
 * opened on a fresh install (the path of anyone who installs Vesper from the invite
 * page, ADR-0034) was redirected to the onboarding and the code was lost.
 * `src/app/+native-intent.tsx` parks the code here and `PendingInviteGate` opens it
 * the moment the onboarding ends. Memory only: a code worth keeping across a kill
 * would be in the link the user can tap again.
 */

type PendingLink = {
  inviteCode: string | null;
  setInviteCode: (code: string | null) => void;
};

export const usePendingLink = create<PendingLink>((set) => ({
  inviteCode: null,
  setInviteCode: (inviteCode) => set({ inviteCode }),
}));

/** Returns the parked code and forgets it, so it is opened once. */
export function takePendingInvite(): string | null {
  const { inviteCode, setInviteCode } = usePendingLink.getState();
  if (inviteCode !== null) {
    setInviteCode(null);
  }
  return inviteCode;
}

const JOIN_PATH = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/?(?:--\/)?circle\/join\/?(?:[?#]|$)/i;
const CODE_PARAM = /[?&]code=([^&#]*)/;

/**
 * The invite code in a system path, or null when the path is not an invitation.
 * Accepts the shapes the OS hands over: `vesper://circle/join?code=X`,
 * `/circle/join?code=X` and `circle/join?code=X`. Pure, so it is tested; the URL
 * class of React Native is too partial to lean on here.
 */
export function inviteCodeFromPath(path: string): string | null {
  if (!JOIN_PATH.test(path.trim())) {
    return null;
  }
  const match = CODE_PARAM.exec(path);
  const raw = match?.[1];
  if (raw === undefined || raw === '') {
    return null;
  }
  try {
    const code = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
    return code === '' ? null : code;
  } catch {
    return null;
  }
}
