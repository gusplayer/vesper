/**
 * The words in the demo data (ADR-0016, ADR-0017): the names a fresh database is
 * seeded with, the sample mode ideas, and the catalogue labels the pickers show.
 * Seeded once, in the language the phone had at that first boot; the rows are the
 * user's from then on (ADR-0020). The keys are the stable ids in `src/data/seed.ts`.
 */

export type AppCategory = 'social' | 'entertainment' | 'messages' | 'shopping' | 'productivity';

export type DemoActivityKey = 'trabajo' | 'lectura' | 'aprender' | 'gym' | 'familia' | 'amigos';

export type DemoModeKey = 'noSocials' | 'family' | 'deepWork';

export type DemoIdeaKey = 'family' | 'sleep' | 'work' | 'mindfulness' | 'noSocials';

export type DemoScheduleKey = 'work' | 'sleep' | 'walk';

export type DemoHabitKey = 'gym' | 'read' | 'sleep';

export type DemoStrings = {
  /** The line under an app's name in the catalogue. */
  appCategory: Record<AppCategory, string>;
  /** Default activities: the chips on a mode and the habit form. Lowercase, like the ledger. */
  activity: Record<DemoActivityKey, string>;
  modeName: Record<DemoModeKey, string>;
  ideaName: Record<DemoIdeaKey, string>;
  ideaDescription: Record<DemoIdeaKey, string>;
  scheduleName: Record<DemoScheduleKey, string>;
  habitName: Record<DemoHabitKey, string>;
};

export const demo: DemoStrings = {
  appCategory: {
    social: 'Redes',
    entertainment: 'Entretenimiento',
    messages: 'Mensajes',
    shopping: 'Compras',
    productivity: 'Productividad',
  },
  activity: {
    trabajo: 'trabajo',
    lectura: 'lectura',
    aprender: 'aprender',
    gym: 'gym',
    familia: 'familia',
    amigos: 'amigos',
  },
  modeName: {
    noSocials: 'Sin redes',
    family: 'Familia',
    deepWork: 'Trabajo profundo',
  },
  ideaName: {
    family: 'Familia',
    sleep: 'Dormir',
    work: 'Trabajo',
    mindfulness: 'Calma',
    noSocials: 'Sin redes',
  },
  ideaDescription: {
    family: 'Estar con la gente que importa',
    sleep: 'Bajar el ritmo sin el scroll',
    work: 'Encerrarte sin distracciones',
    mindfulness: 'Teléfono en silencio, mente en silencio',
    noSocials: 'Un paso atrás del feed',
  },
  scheduleName: {
    work: 'Trabajo',
    sleep: 'Hora de dormir',
    walk: 'Caminar',
  },
  habitName: {
    gym: 'gym',
    read: 'leer',
    sleep: 'dormir 7h',
  },
};
