import { describe, expect, it } from 'vitest';

import { aHabit } from '../domain/fixtures';
import type { LedgerRow, Provenance } from '../domain/types';
import { habitTone, ledgerTone } from './tone';

function aRow(provenance: Provenance): LedgerRow {
  return { key: 'trabajo', label: 'trabajo', ms: 0, provenance };
}

describe('ledgerTone', () => {
  it('celebrates verified time', () => {
    expect(ledgerTone(aRow('verified'))).toBe('strong');
  });

  it('whispers unregistered time', () => {
    expect(ledgerTone(aRow('unknown'))).toBe('faint');
  });

  it('reads declared and estimated time at normal volume', () => {
    expect(ledgerTone(aRow('declared'))).toBe('normal');
    expect(ledgerTone(aRow('estimated'))).toBe('normal');
  });
});

describe('habitTone', () => {
  it('follows the count mode, never whether the habit is done', () => {
    const verified = aHabit({ countMode: 'verified', healthType: 'workout' });
    const declared = aHabit({ countMode: 'declared' });

    expect(habitTone({ habit: verified, markedDays: 0, met: false, markedToday: false })).toBe(
      'strong',
    );
    expect(habitTone({ habit: declared, markedDays: 4, met: true, markedToday: true })).toBe(
      'normal',
    );
  });
});
