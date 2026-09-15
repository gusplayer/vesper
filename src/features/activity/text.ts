import { HOUR } from '../../domain/time';

/** Small Spanish plurals for the activity tab. Presentation only. */

export function sessionsText(count: number): string {
  if (count === 0) {
    return 'Sin sesiones';
  }
  return count === 1 ? '1 sesión' : `${count} sesiones`;
}

/** '42 horas', '1 hora'. Whole hours: the lifetime figure is a headline, not a ledger. */
export function hoursText(ms: number): string {
  const hours = Math.round(ms / HOUR);
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export function daysText(count: number): string {
  return count === 1 ? '1 día' : `${count} días`;
}

export function weeksText(count: number): string {
  return count === 1 ? '1 semana' : `${count} semanas`;
}
