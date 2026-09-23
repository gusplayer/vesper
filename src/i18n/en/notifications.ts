import type { notifications as shape } from '../es/notifications';

export const notifications: typeof shape = {
  channelName: 'Reminders',
  unavailable: 'Notifications only exist on the phone.',
  sessionEnd: {
    title: 'Your session ended',
    body: (duration) => `${duration} of focus. Come back to Vesper to close it.`,
  },
  breakEnd: {
    title: 'Break is over',
    body: 'Apps are blocked again. Your session goes on.',
  },
  schedule: {
    title: (scheduleName) => `${scheduleName} starts`,
    body: (modeName) => `${modeName} mode. Tap to start the session.`,
  },
  weeklyClose: {
    title: 'Close the week',
    body: 'See how it went. The one starting tomorrow begins at zero.',
  },
  streakRisk: {
    title: (days) => `Your ${days}-day streak ends at midnight`,
    body: '10 minutes are enough.',
  },
  noFocus: {
    title: 'No focus yet today',
    body: '25 minutes and you are done.',
  },
  challengeRisk: {
    title: (challengeName) => `${challengeName} is slipping away`,
    body: (needed, daysLeft) =>
      `You need ${needed} more and ${daysLeft} ${daysLeft === 1 ? 'day is' : 'days are'} left. Mark it today.`,
  },
  challengeEnd: {
    title: (challengeName) => `${challengeName} is over`,
    body: (met, total) =>
      met === total
        ? `You kept ${total === 1 ? 'the week' : `all ${total} weeks`}.`
        : `You kept ${met} of ${total} ${total === 1 ? 'week' : 'weeks'}.`,
  },
  reactivation: {
    title: (days) => `It has been ${days} ${days === 1 ? 'day' : 'days'} without focus`,
    body: 'A short session counts.',
    bodyStreak: (days) => `Your streak stopped at ${days}. You can start another today.`,
    bodyCircle: 'Your circle is still there.',
  },
  test: {
    title: 'This is what a notice looks like',
    body: 'Vesper will talk to you like this. Tap to go back.',
  },
};
