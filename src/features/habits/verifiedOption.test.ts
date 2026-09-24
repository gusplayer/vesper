import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { verifiedOption, type HealthState } from './verifiedOption';

const CONNECTED: HealthState = { available: true, reason: null, connected: true };
const DISCONNECTED: HealthState = { available: true, reason: null, connected: false };
const NO_HEALTH: HealthState = {
  available: false,
  reason: es.habits.healthStatus.unsupported,
  connected: false,
};

describe('verifiedOption', () => {
  it('keeps verified for a name Health knows, and carries its type', () => {
    const option = verifiedOption('gym', 'verified', CONNECTED, es.habits.form);
    expect(option.verifiable).toBe(true);
    expect(option.countMode).toBe('verified');
    expect(option.healthType).toBe('workout');
    expect(option.description).toBe('Salud lo confirma solo');
  });

  it('never carries a type for a declared habit, however well Health knows the name', () => {
    const option = verifiedOption('dormir 7h', 'declared', CONNECTED, es.habits.form);
    expect(option.verifiable).toBe(true);
    expect(option.countMode).toBe('declared');
    expect(option.healthType).toBeNull();
  });

  it('falls to declared when nothing can verify the name (ADR-0041)', () => {
    const option = verifiedOption('Meditar', 'verified', CONNECTED, es.habits.form);
    expect(option.verifiable).toBe(false);
    expect(option.countMode).toBe('declared');
    expect(option.healthType).toBeNull();
    expect(option.description).toBe(
      'Solo para hábitos que Salud puede confirmar: entrenamiento, caminata, sueño',
    );
    expect(option.note).toBe(
      'Salud no reconoce este nombre, así que el hábito queda declarado y lo marcas tú.',
    );
  });

  it('gives verified back when the name comes back: the fall never forgets the choice', () => {
    expect(verifiedOption('gy', 'verified', CONNECTED, es.habits.form).countMode).toBe('declared');
    expect(verifiedOption('gym', 'verified', CONNECTED, es.habits.form).countMode).toBe('verified');
  });

  it('ignores the surrounding spaces of a name', () => {
    expect(verifiedOption('  caminar  ', 'verified', CONNECTED, es.habits.form).healthType).toBe(
      'steps',
    );
  });

  it('says nothing about the name while the field is empty', () => {
    const option = verifiedOption('   ', 'declared', DISCONNECTED, es.habits.form);
    expect(option.verifiable).toBe(false);
    expect(option.note).toBe(
      'Salud no está conectada. Conéctala en Ajustes para que confirme este hábito sola.',
    );
  });

  it('keeps the two reasons apart: the name is not the connection', () => {
    const name = verifiedOption('leer', 'verified', DISCONNECTED, es.habits.form);
    const connection = verifiedOption('gym', 'verified', DISCONNECTED, es.habits.form);
    expect(name.note).toBe(
      'Salud no reconoce este nombre, así que el hábito queda declarado y lo marcas tú.',
    );
    expect(connection.note).toBe(
      'Salud no está conectada. Conéctala en Ajustes para que confirme este hábito sola.',
    );
    // Only the name takes the option away; without Health the habit still takes a tap.
    expect(name.verifiable).toBe(false);
    expect(connection.verifiable).toBe(true);
    expect(connection.countMode).toBe('verified');
  });

  it('says Health is there when it is', () => {
    expect(verifiedOption('gym', 'verified', CONNECTED, es.habits.form).note).toBe(
      'Salud está conectada: puede confirmar este hábito sola.',
    );
  });

  it('borrows the reason from the capability when Health cannot exist here', () => {
    expect(verifiedOption('gym', 'verified', NO_HEALTH, es.habits.form).note).toBe(
      'Salud no existe en este teléfono, así que este hábito lo marcas tú.',
    );
  });

  it('speaks English too', () => {
    const form = en.habits.form;
    expect(verifiedOption('meditate', 'verified', CONNECTED, form).note).toBe(
      'Health does not recognize this name, so the habit stays declared and you mark it.',
    );
    expect(verifiedOption('walk', 'verified', DISCONNECTED, form).note).toBe(
      'Health is not connected. Connect it in Settings so it confirms this habit on its own.',
    );
    expect(verifiedOption('walk', 'verified', CONNECTED, form).note).toBe(
      'Health is connected: it can confirm this habit on its own.',
    );
    expect(
      verifiedOption('walk', 'verified', { ...NO_HEALTH, reason: en.habits.healthStatus.unsupported }, form)
        .note,
    ).toBe('Health does not exist on this phone, so you mark this habit.');
    expect(verifiedOption('meditate', 'verified', CONNECTED, form).description).toBe(
      'Only for habits Health can confirm: workouts, walking, sleep',
    );
  });
});
