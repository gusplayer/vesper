import { dayKeyOf } from '../domain/day';
import { DAY, HOUR, MINUTE } from '../domain/time';
import type {
  Activity,
  AppInfo,
  DayStat,
  Habit,
  HabitMark,
  HealthSummary,
  Mode,
  ModeIdea,
  Schedule,
  Settings,
  UsageEstimate,
  Website,
} from './types';

/**
 * Fake data for the prototype. Deterministic: the same numbers every launch, so a
 * screenshot today matches one tomorrow. Nothing here is real (ADR-0016).
 */

export const APPS: AppInfo[] = [
  { id: 'instagram', name: 'Instagram', category: 'Redes', color: '#C13584', initial: 'I' },
  { id: 'tiktok', name: 'TikTok', category: 'Entretenimiento', color: '#1C1B1A', initial: 'T' },
  { id: 'youtube', name: 'YouTube', category: 'Entretenimiento', color: '#D6322A', initial: 'Y' },
  { id: 'x', name: 'X', category: 'Redes', color: '#2B2B2B', initial: 'X' },
  { id: 'facebook', name: 'Facebook', category: 'Redes', color: '#1877F2', initial: 'f' },
  { id: 'reddit', name: 'Reddit', category: 'Redes', color: '#FF4500', initial: 'r' },
  { id: 'netflix', name: 'Netflix', category: 'Entretenimiento', color: '#B20710', initial: 'N' },
  { id: 'disney', name: 'Disney+', category: 'Entretenimiento', color: '#0E3C8C', initial: 'D' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'Mensajes', color: '#25A244', initial: 'W' },
  { id: 'telegram', name: 'Telegram', category: 'Mensajes', color: '#2AABEE', initial: 't' },
  { id: 'twitch', name: 'Twitch', category: 'Entretenimiento', color: '#8A4BE0', initial: 'T' },
  { id: 'amazon', name: 'Amazon', category: 'Compras', color: '#E67E22', initial: 'a' },
  { id: 'mail', name: 'Mail', category: 'Productividad', color: '#3478F6', initial: 'M' },
  { id: 'slack', name: 'Slack', category: 'Productividad', color: '#4A154B', initial: 'S' },
];

export const WEBSITES: Website[] = [
  { id: 'amazon.com', host: 'amazon.com', popular: true },
  { id: 'facebook.com', host: 'facebook.com', popular: true },
  { id: 'instagram.com', host: 'instagram.com', popular: true },
  { id: 'reddit.com', host: 'reddit.com', popular: true },
  { id: 'tiktok.com', host: 'tiktok.com', popular: true },
  { id: 'youtube.com', host: 'youtube.com', popular: true },
  { id: 'x.com', host: 'x.com', popular: true },
  { id: 'twitter.com', host: 'twitter.com', popular: false },
  { id: 'twitch.tv', host: 'twitch.tv', popular: false },
  { id: 'ads-twitter.com', host: 'ads-twitter.com', popular: false },
];

export const ACTIVITIES: Activity[] = [
  { id: 'trabajo', label: 'trabajo' },
  { id: 'lectura', label: 'lectura' },
  { id: 'aprender', label: 'aprender' },
  { id: 'gym', label: 'gym' },
  { id: 'familia', label: 'familia' },
  { id: 'amigos', label: 'amigos' },
];

export const MODES: Mode[] = [
  {
    id: 'mode-no-socials',
    name: 'Sin redes',
    behavior: 'block',
    appIds: ['instagram', 'tiktok', 'x', 'facebook'],
    websiteIds: ['instagram.com', 'tiktok.com', 'x.com'],
    depth: 'firm',
    activityId: 'trabajo',
    createdAt: 1,
  },
  {
    id: 'mode-family',
    name: 'Familia',
    behavior: 'block',
    appIds: ['instagram', 'tiktok', 'youtube', 'netflix'],
    websiteIds: [],
    depth: 'soft',
    activityId: 'familia',
    createdAt: 2,
  },
  {
    id: 'mode-deep-work',
    name: 'Trabajo profundo',
    behavior: 'allow',
    appIds: ['mail', 'slack', 'whatsapp'],
    websiteIds: [],
    depth: 'deep',
    activityId: 'trabajo',
    createdAt: 3,
  },
];

export const MODE_IDEAS: ModeIdea[] = [
  {
    id: 'idea-family',
    name: 'Familia',
    description: 'Estar con la gente que importa',
    icon: 'home',
    appIds: ['instagram', 'tiktok', 'youtube', 'x'],
    depth: 'soft',
  },
  {
    id: 'idea-sleep',
    name: 'Dormir',
    description: 'Bajar el ritmo sin el scroll',
    icon: 'moon',
    appIds: ['instagram', 'tiktok', 'youtube', 'netflix', 'reddit'],
    depth: 'firm',
  },
  {
    id: 'idea-work',
    name: 'Trabajo',
    description: 'Encerrarte sin distracciones',
    icon: 'briefcase',
    appIds: ['instagram', 'tiktok', 'youtube', 'x', 'reddit', 'twitch'],
    depth: 'deep',
  },
  {
    id: 'idea-mindfulness',
    name: 'Calma',
    description: 'Teléfono en silencio, mente en silencio',
    icon: 'wind',
    appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit', 'youtube', 'whatsapp'],
    depth: 'firm',
  },
  {
    id: 'idea-no-socials',
    name: 'Sin redes',
    description: 'Un paso atrás del feed',
    icon: 'slash',
    appIds: ['instagram', 'tiktok', 'x', 'facebook', 'reddit'],
    depth: 'firm',
  },
];

export const SCHEDULES: Schedule[] = [
  {
    id: 'schedule-work',
    name: 'Trabajo',
    modeId: 'mode-deep-work',
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    days: [true, true, true, true, true, false, false],
    enabled: true,
  },
  {
    id: 'schedule-sleep',
    name: 'Hora de dormir',
    modeId: 'mode-no-socials',
    startMinutes: 21 * 60 + 30,
    endMinutes: null,
    days: [true, true, true, true, false, false, true],
    enabled: true,
  },
];

export const SETTINGS: Settings = {
  onboardingDone: false,
  screenTimeConnected: false,
  healthConnected: false,
  notificationsAllowed: false,
  liveActivities: true,
  emergencyLeft: 5,
  emergencyTotal: 5,
  rules: { strictMode: false, blockInstalls: false, blockPurchases: false, blockMature: false },
  notifications: { coaching: true, updates: true, sessionEnd: true, weeklyClose: true },
  birthDate: new Date(1992, 3, 14).getTime(),
  lifeExpectancyYears: 77.6,
  weeklyTargetMs: 15 * HOUR,
  pendingBanner: null,
};

export const HABITS: Habit[] = [
  { id: 'habit-gym', name: 'gym', activityId: 'gym', weeklyTarget: 4, countMode: 'verified', healthType: 'workout', archivedAt: null, createdAt: 1 },
  { id: 'habit-read', name: 'leer', activityId: 'lectura', weeklyTarget: 6, countMode: 'declared', healthType: null, archivedAt: null, createdAt: 2 },
  { id: 'habit-sleep', name: 'dormir 7h', activityId: null, weeklyTarget: 5, countMode: 'verified', healthType: 'sleep', archivedAt: null, createdAt: 3 },
];

/** A shape of focus per weekday, used to fabricate ~10 weeks of history. */
const WEEKDAY_PATTERN_MS = [3 * HOUR, 2.5 * HOUR, 1 * HOUR, 4 * HOUR, 0, 1.5 * HOUR, 5 * HOUR];

function seededSessions(dayIndex: number, focusMs: number): number {
  if (focusMs === 0) {
    return 0;
  }
  return 1 + ((dayIndex * 7) % 3);
}

/** Day stats for the last `days` days, today included, oldest first. */
export function seedDayStats(now: number, days = 70): DayStat[] {
  const stats: DayStat[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const at = now - offset * DAY;
    const weekday = (new Date(at).getDay() + 6) % 7;
    const wobble = ((offset * 37) % 11) / 10;
    const base = WEEKDAY_PATTERN_MS[weekday] ?? 0;
    const focusMs = offset === 0 ? 0 : Math.round(base * (0.6 + wobble * 0.8));
    const sessions = seededSessions(offset, focusMs);
    const segments = Array.from({ length: sessions }, (_, i) => {
      const start = 0.35 + i * 0.2;
      return { start, end: Math.min(0.98, start + (focusMs / (sessions * DAY)) * 1.4) };
    });
    stats.push({ dayKey: dayKeyOf(at), focusMs, sessions, segments });
  }
  return stats;
}

/** Marks for the current week so the habits have some progress. */
export function seedHabitMarks(now: number): HabitMark[] {
  const marks: HabitMark[] = [];
  const weekday = (new Date(now).getDay() + 6) % 7;
  for (let offset = weekday; offset >= 1; offset -= 1) {
    const dayKey = dayKeyOf(now - offset * DAY);
    if (offset % 2 === 0) {
      marks.push({ id: `m-gym-${dayKey}`, habitId: 'habit-gym', dayKey, source: 'health', sourceRef: `hk-${dayKey}`, durationMs: 55 * MINUTE, markedAt: now });
    }
    marks.push({ id: `m-read-${dayKey}`, habitId: 'habit-read', dayKey, source: 'manual', sourceRef: '', durationMs: null, markedAt: now });
    if (offset !== 3) {
      marks.push({ id: `m-sleep-${dayKey}`, habitId: 'habit-sleep', dayKey, source: 'health', sourceRef: `hk-s-${dayKey}`, durationMs: 7.2 * HOUR, markedAt: now });
    }
  }
  return marks;
}

export const USAGE: UsageEstimate = {
  todayMs: 1 * HOUR + 12 * MINUTE,
  weekMs: 11 * HOUR + 40 * MINUTE,
  byApp: [
    { appId: 'instagram', ms: 34 * MINUTE },
    { appId: 'tiktok', ms: 22 * MINUTE },
    { appId: 'youtube', ms: 11 * MINUTE },
    { appId: 'x', ms: 5 * MINUTE },
  ],
};

export const HEALTH: HealthSummary = {
  workoutsThisWeek: 2,
  stepsToday: 6420,
  sleepLastNightMs: 7 * HOUR + 12 * MINUTE,
};
