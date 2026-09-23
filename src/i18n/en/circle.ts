import type { circle as shape } from '../es/circle';

/** 'Ana', 'Ana and Luis', 'Ana, Luis and Sofía'. */
function joinNames(names: readonly string[]): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const unavailable = 'There is no connection between phones yet. What you see is sample data.';

export const circle: typeof shape = {
  sync: {
    unavailable,
  },
  section: {
    title: 'Your circle',
    noProfileTitle: 'A circle is the people you would tell that you did not touch your phone today.',
    noProfileBody: 'Create your profile to invite or be invited. No feed, no ranking, no alerts.',
    createProfileA11y: 'Create your circle profile',
    emptyTitle: 'Your circle is empty.',
    emptyBody: 'Invite someone with your code.',
    inviteA11y: 'Invite to your circle',
    seeCircle: 'See circle',
  },
  member: {
    me: 'You',
    handle: (handle) => `@${handle}`,
    focus: (hours) => `${hours} of focus`,
    social: (hours) => `social · ${hours} (estimated)`,
    noData: 'no data this week',
    kudos: 'Cheer',
    kudosSent: 'Sent',
  },
  kudos: {
    received: (names) => `${joinNames(names)} cheered you this week.`,
  },
  list: {
    title: 'Your circle',
    inviteA11y: 'Invite someone',
    thisWeek: 'This week',
    noMembers: 'Nobody yet. Invite with your code.',
    challenges: 'Challenges',
    noChallenges: 'No challenges for now. A challenge is a habit with witnesses.',
    newChallenge: 'New challenge',
    noProfileTitle: 'A circle, not a network.',
    noProfileBody:
      'Up to twelve people you choose. You compare the week’s focus hours, cheer each other and take on challenges together. No feed, no followers, no ranking, no alerts.',
    noProfileShare: 'You decide what is seen, metric by metric. What you do not share never leaves the phone.',
    createProfile: 'Create your profile',
  },
  challenge: {
    duration: (days) =>
      days === null ? 'no limit' : days === 7 ? '1 week' : days % 7 === 0 && days !== 21 ? `${days / 7} weeks` : `${days} days`,
    summary: (target, duration) => `${target} times a week · ${duration}`,
    withNames: (names) => `with ${joinNames(names)}`,
    alone: 'just you',
    nobody: 'no participants',
    status: {
      upcoming: 'Starts on Monday',
      active: (daysLeft) => (daysLeft === null ? 'No limit' : daysLeft <= 1 ? 'Last day' : `${daysLeft} days left`),
      ended: 'Ended',
    },
    progress: (done, target) => `${done} of ${target}`,
    outlook: {
      met: 'You kept it this week',
      left: (needed, daysLeft) =>
        `You need ${needed} more · ${daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}`,
      atRisk: (daysLeft) =>
        daysLeft === 1 ? 'Only if you mark today' : `Only if you mark all ${daysLeft} days left`,
      missed: 'This week is gone',
      notStarted: 'Not started yet',
    },
    otherLine: (name, progress, met) => (met ? `${name} kept it` : `${name} is at ${progress}`),
    ended: {
      title: 'How it ended',
      lastWeek: 'Its last week',
      weeks: (met, total) =>
        met === total
          ? `You kept ${total === 1 ? 'the week' : `all ${total} weeks`}.`
          : `You kept ${met} of ${total} ${total === 1 ? 'week' : 'weeks'}.`,
      repeat: (duration) => `Repeat ${duration}`,
      archive: 'Archive the challenge',
      archiveQuestion: 'Archive the challenge?',
      archiveMessage: 'It leaves your list. Your habit and your marks stay.',
      archiveConfirm: 'Archive',
    },
    habitLine: (names) => (names.length === 0 ? 'Challenge' : `Challenge with ${joinNames(names)}`),
    standingLine: (name, progress, met) => `${name} · ${progress}${met ? ' ✓' : ''}`,
    standingA11y: (name, progress, met) => `${name}, ${progress}${met ? ', done' : ''}`,
    openA11y: (name) => `Open the challenge ${name}`,
    goneTitle: 'That challenge is gone.',
    goneDescription: 'Go back to the circle and pick another.',
    thisWeek: 'This week',
    markToday: 'Mark today',
    unmarkToday: 'Unmark today',
    join: 'Join',
    leave: 'Leave the challenge',
    leaveQuestion: 'Leave the challenge?',
    leaveMessage: 'Your habit stays and keeps counting. You just stop showing up in the challenge.',
    leaveConfirm: 'Leave',
    habitsFull: 'You already have 5 habits. Archive one to join.',
    countsAsHabit: 'Your marks are those of your habit with this name. The others’ arrive as challenge marks.',
    notJoined: 'You are not in this challenge yet.',
    nudge: 'Nudge',
    nudged: 'Nudged',
    nudgeA11y: (name) => `Nudge ${name}`,
    nudgeHint: 'One nudge a day per person. It arrives once there is a server.',
    nudgedYou: (names) => `${joinNames(names)} nudged you today.`,
  },
  home: {
    challenge: (name, outlook) => `${name} · ${outlook.charAt(0).toLowerCase()}${outlook.slice(1)}`,
    challengeA11y: (name, outlook) => `${name}, ${outlook}. Open the challenge`,
  },
  challengeNew: {
    title: 'New challenge',
    name: 'Name',
    namePlaceholder: 'read, walk, sleep 7h',
    ideas: 'Suggested challenges',
    ideasHint: 'Tap one to start there. You can change the name and the times.',
    ideaName: {
      read: 'Read',
      walk: 'Walk',
      table: 'No phone at the table',
      sleep: 'Sleep without a screen',
      move: 'Move',
    },
    fromHabit: 'From a habit',
    fromHabitHint: 'Tap one to use its name and target.',
    timesPerWeek: 'Times a week',
    duration: 'How long',
    durationOption: (days) =>
      days === null ? 'No limit' : days === 7 ? '1 week' : days % 7 === 0 && days !== 21 ? `${days / 7} weeks` : `${days} days`,
    withWhom: 'With whom',
    noMembers: 'Invite someone first. A challenge without witnesses is a habit.',
    meToo: 'Me too',
    meTooHint: 'When you join, the challenge uses a habit of yours with that name and counts against the maximum of five.',
    create: 'Create challenge',
    habitsFull: 'You already have 5 habits. Archive one to join.',
  },
  invite: {
    title: 'Invite',
    yourCode: 'YOUR CODE',
    yourCodeHint: 'Whoever uses it asks to join your circle. You decide whether to accept.',
    qrHint: 'Point the phone camera at this code and Vesper opens.',
    qrA11y: (code) => `QR code of your invitation, ${code}`,
    share: 'Share invitation',
    shareMessage: (code, link) => `Join my circle on Vesper. Tap ${link} or type the code ${code}.`,
    newCode: 'Generate a new code',
    newCodeQuestion: 'Generate a new code?',
    newCodeMessage: 'The old one stops working. Whoever is already in your circle stays.',
    newCodeConfirm: 'Generate',
    enterTitle: 'Were you given a code?',
    enterHint: 'Type it here, or tap the link you were sent.',
    codeField: 'Code',
    codePlaceholder: 'six letters or digits',
    send: 'Ask to join their circle',
    result: {
      invalid: 'A code is six letters or digits.',
      self: 'That is your own code.',
      unavailable,
    },
    pending: 'Asking to join your circle',
    invitedYou: 'used your code',
    accept: 'Accept',
    decline: 'Decline',
    acceptFull: 'Your circle is full. Remove someone to accept.',
    members: 'In your circle',
    count: (members, max) => `${members} of ${max}`,
    waiting: 'waiting for them to accept',
    remove: 'Remove',
    removeQuestion: (name) => `Remove ${name} from your circle?`,
    removeMessage: 'They stop seeing your numbers and you theirs. Their marks in challenges are deleted.',
    removeConfirm: 'Remove',
    prototypeNote: 'In the prototype nobody receives the request.',
  },
  join: {
    title: 'Join a circle',
    body: (code) => `You were invited with the code ${code}.`,
    explain: 'When you ask to join, the other person sees your name and decides. You share nothing until they accept.',
    request: 'Ask to join',
    noCode: 'This link does not carry a valid code.',
    noProfileTitle: 'Create your profile first.',
    noProfileBody: 'A name and a handle, on this phone. Then tap the link again.',
    createProfile: 'Create your profile',
  },
  settings: {
    title: 'Circle',
    profile: 'Profile',
    name: 'Name',
    namePlaceholder: 'what people call you',
    handle: 'Handle',
    handlePlaceholder: 'short, no spaces',
    createProfile: 'Create your profile',
    profileHint: 'Name and handle live on this phone. There is no email or password.',
    share: 'What you share',
    shareFocus: { label: 'Focus hours', description: 'Your focused time this week' },
    shareHabits: { label: 'Habits and challenges', description: 'How many times you kept them' },
    shareSocial: { label: 'Social use', description: 'The phone’s estimated floor' },
    shareHint:
      'Social use is an estimate and is shown as one, on its own line. What you do not share never leaves the phone.',
    seeCircle: 'See circle',
    leaveCircle: 'Leave the circle',
    leaveQuestion: 'Leave the circle?',
    leaveMessage: 'People, their numbers, cheers and challenges are deleted. Your profile and habits stay.',
    leaveConfirm: 'Leave',
  },
};
