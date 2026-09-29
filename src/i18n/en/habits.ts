import type { habits as shape } from '../es/habits';

export const habits: typeof shape = {
  section: {
    title: 'Habits this week',
    healthTip: 'Health marks it. To mark it yourself, switch it to declared.',
    verifiedSynced: (synced) => `verified by Health · ${synced}`,
    verifiedNoHealth: 'Health not connected · manual mark',
    verifiedManual: (reason) => `${reason} · manual mark`,
    declared: 'declared',
    joined: (first, second) => `${first} · ${second}`,
    edit: 'Edit habits',
    add: 'Add habit',
    help: 'Tap a habit to mark today, and hold it to edit it. The number is how many days you have marked this week.',
    helpHealth:
      'Tap a habit to mark today, and hold it to edit it. The number is how many days you have marked this week. Health marks the verified ones on its own.',
    rowA11y: (name, progress, how) => `${name}, ${progress}, ${how}`,
    hintMark: 'Marks today',
    hintUnmark: "Removes today's mark",
    hintHealth: 'Health marks it; it is not marked by hand',
    empty: 'Up to five habits, counted in days, not hours.',
    fiveIsMax: 'Five is the maximum, on purpose: attention does not scale. Archive one to make room.',
  },
  summary: {
    title: 'Habits',
    label: 'This week',
    value: (met, total) => (total === 0 ? 'No habits' : `${met} of ${total} met`),
    hint: 'Opens the weekly view, where they are marked',
  },
  form: {
    name: 'Name',
    namePlaceholder: 'gym, bike, read, sleep 7h',
    timesPerWeek: 'Times per week',
    howCounted: 'How it is counted',
    declared: 'Declared',
    declaredDescription: 'You mark it',
    verified: 'Verified',
    verifiedDescription: 'Health confirms it on its own',
    verifiedWorkout: 'Health confirms it if you record with a watch or an app',
    verifiedPending: 'Health will confirm it once you connect it',
    verifiedManual: 'Health would confirm it; here you mark it',
    stepGoal: (steps, tag) => `Counts the days with ${steps.toLocaleString(tag)} steps or more`,
    workoutKind: {
      any: (minutes) => `Counts the days with a workout of ${minutes} minutes or more, of any kind.`,
      cycling: (minutes) => `Counts the days with a bike ride of ${minutes} minutes or more, outdoors or indoors.`,
      running: (minutes) => `Counts the days you run for ${minutes} minutes or more, outdoors or on a treadmill.`,
      swimming: (minutes) => `Counts the days you swim for ${minutes} minutes or more.`,
    },
    fromApps: 'Do you record on Strava or Garmin?',
    verifiedUnavailable: 'Only for habits Health can confirm: workouts, walking, sleep',
    note: {
      name: 'Health does not recognize this name, so the habit stays declared and you mark it.',
      connected: 'Health is connected: it can confirm this habit on its own.',
      disconnected: 'Health is not connected. If you pick verified, Vesper asks for permission when you save.',
      askOnSave: 'When you save, Vesper asks for permission so Health confirms it on its own.',
      unavailable: (reason) => `${reason}, so you mark this habit.`,
    },
    asking: 'Asking Health for permission…',
    times: (count) => (count === 1 ? '1 time a week' : `${count} times a week`),
    challengeTarget: 'The challenge sets the target.',
  },
  new: {
    title: 'New habit',
    fullTitle: 'You already have five habits.',
    fullDescription:
      'Five is the maximum, on purpose: attention does not scale. Archive one to make room.',
    left: (count) => (count === 1 ? 'You can have 1 more' : `You can have ${count} more`),
  },
  edit: {
    title: 'Edit habit',
    goneTitle: 'That habit is gone.',
    goneDescription: 'Go back to Activity and pick another.',
    archiveQuestion: 'Archive this habit?',
    archiveMessage: 'It cannot be restored yet.',
    archiveChallengeMessage: (name) =>
      `It is the habit of your challenge “${name}”. The challenge stays in your circle, but this habit stops counting here and cannot be restored yet.`,
    archive: 'Archive',
    archiveHabit: 'Archive habit',
    archiveCaption: 'Archiving takes it off the list and frees a slot.',
  },
  sync: {
    never: 'not synced',
    at: (clock) => `synced ${clock}`,
  },
  healthWeek: {
    title: 'This week',
    workouts: 'Workouts',
    stepDays: 'Days with steps',
    nights: 'Nights slept',
    noHabit: 'No habit',
    lastRead: 'Last read',
    notYet: 'Not yet',
    lastReadOn: (day, time) => `${day} · ${time}`,
    readNow: 'Read Health now',
    reading: 'Reading…',
  },
  intoHealth: {
    title: 'Getting it into Health',
    ios: {
      intro: 'Vesper does not connect to your apps: it reads the workouts they leave in Health. Never the route.',
      sources: [
        { name: 'Apple Watch', path: 'Nothing to do: what you record on the watch is already in Health.' },
        { name: 'Strava', path: 'You › Settings › Manage Apps and Devices › Health › Send to Health.' },
        { name: 'Garmin Connect', path: 'More › Settings › Connected Apps › Apple Health.' },
      ],
      footer: (minutes) =>
        `Not showing up? Check whether it is in Health. If it is and does not count, it was shorter than ${minutes} minutes, of another kind or typed in by hand.`,
    },
    android: {
      intro: 'Vesper does not connect to your apps: it reads the workouts they leave in Health Connect. Never the route.',
      sources: [
        { name: 'Your watch', path: "Open Health Connect and link Samsung Health, Fitbit or your watch's app." },
        {
          name: 'Strava',
          path: 'You › Settings › Manage Apps and Devices › Health Connect. Only GPS activities go through.',
        },
        { name: 'Garmin Connect', path: 'In Garmin Connect, turn on Health Connect under connected apps.' },
      ],
      footer: (minutes) =>
        `Not showing up? Check whether it is in Health Connect. If it is and does not count, it was shorter than ${minutes} minutes, of another kind or typed in by hand.`,
    },
  },
  healthStatus: {
    unsupported: 'Health does not exist on this phone',
    installHealthConnect: 'Health Connect is missing or out of date',
    notLinked: 'This version of Vesper cannot read Health',
    notAvailable: 'Health is not available on this device',
  },
};
