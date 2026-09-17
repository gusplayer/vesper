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
    body: (modeName) => `${modeName} mode. Tap to focus.`,
  },
  weeklyClose: {
    title: 'Close the week',
    body: 'See how it went. The one starting tomorrow begins at zero.',
  },
  test: {
    title: 'This is what a notice looks like',
    body: 'Vesper will talk to you like this. Tap to go back.',
  },
};
