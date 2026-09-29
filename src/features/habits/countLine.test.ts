import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { countLineText, workoutKindText } from './countLine';

describe('workoutKindText', () => {
  it('says which workouts a name counts, by the kind it reads (ADR-0055)', () => {
    expect(workoutKindText('Montar en bici', es.habits.form)).toBe(
      'Cuenta los días con una salida en bici de 10 minutos o más, al aire libre o en interior.',
    );
    expect(workoutKindText('Correr', es.habits.form)).toBe(
      'Cuenta los días que corres 10 minutos o más, al aire libre o en cinta.',
    );
    expect(workoutKindText('Nadar', es.habits.form)).toBe('Cuenta los días que nadas 10 minutos o más.');
  });

  it('takes any workout when the name names no sport', () => {
    expect(workoutKindText('Hacer ejercicio', es.habits.form)).toBe(
      'Cuenta los días con un entrenamiento de 10 minutos o más, del tipo que sea.',
    );
    expect(workoutKindText('gym', en.habits.form)).toBe(
      'Counts the days with a workout of 10 minutes or more, of any kind.',
    );
  });

  it('speaks English with the English dictionary', () => {
    expect(workoutKindText('Ride a bike', en.habits.form)).toBe(
      'Counts the days with a bike ride of 10 minutes or more, outdoors or indoors.',
    );
    expect(workoutKindText('Swim', en.habits.form)).toBe('Counts the days you swim for 10 minutes or more.');
  });

  it('says nothing for a name that is not a workout', () => {
    expect(workoutKindText('Caminar', es.habits.form)).toBeNull();
    expect(workoutKindText('Leer', es.habits.form)).toBeNull();
  });
});

describe('countLineText', () => {
  it('says the step goal of a steps name and the kind of a workout name', () => {
    expect(countLineText('Caminar 10.000 pasos', es.habits.form, 'es-ES')).toBe(
      'Cuenta los días con 10.000 pasos o más',
    );
    expect(countLineText('Rodar juntos', es.habits.form, 'es-ES')).toBe(
      'Cuenta los días con una salida en bici de 10 minutos o más, al aire libre o en interior.',
    );
  });

  it('says nothing where the name decides nothing', () => {
    expect(countLineText('Dormir 7h', es.habits.form, 'es-ES')).toBeNull();
    expect(countLineText('Leer', es.habits.form, 'es-ES')).toBeNull();
    expect(countLineText('   ', es.habits.form, 'es-ES')).toBeNull();
  });
});
