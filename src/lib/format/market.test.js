import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatIDR,
  formatNumber,
  formatPct,
  formatPrice,
  formatVolume,
  formatShares,
  formatLots,
  formatRatio,
  formatRelativeDays,
  gradeColor,
} from './market.js';

describe('required market formatters', () => {
  it('formats full and compact Rupiah values', () => {
    expect(formatIDR(229975060500)).toBe('Rp229.975.060.500');
    expect(formatIDR(-229975060500)).toBe('-Rp229.975.060.500');
    expect(formatIDR(1.5e9, true)).toBe('Rp1.5B');
  });

  it('formats price, percentage, number, volume, and date values', () => {
    expect(formatPrice(3050)).toBe('3.050');
    expect(formatPct(1.5)).toBe('+1.50%');
    expect(formatNumber(12000)).toBe('12.000');
    expect(formatVolume(2.5e6)).toBe('2.5M');
    // Rounding must not park a value at the top of the smaller unit: "1000M"
    // and "1.0B" are the same number read two different ways at a glance.
    expect(formatVolume(999_999_999)).toBe('1.0B');
    expect(formatVolume(999_999)).toBe('1.0M');
    expect(formatVolume(-999_999_999)).toBe('-1.0B');
    expect(formatVolume(999_400_000)).toBe('999M');
    expect(formatDate('2026-07-21')).not.toBe('—');
    expect(formatShares(2500000)).toBe('2.5M shares');
    expect(formatLots(12000)).toBe('12.000 lots');
    expect(formatRatio(1.25)).toBe('1.25x');
    expect(gradeColor('A')).toBe('var(--color-positive)');
  });

  it('uses an unavailable marker for invalid numeric values', () => {
    expect(formatIDR(null)).toBe('—');
    expect(formatPrice(null)).toBe('—');
    expect(formatPct(null)).toBe('—');
  });

  it('describes record age in whole calendar days', () => {
    const now = Date.parse('2026-08-10T09:00:00+07:00');
    expect(formatRelativeDays('2026-08-10', now)).toBe('today');
    expect(formatRelativeDays('2026-08-09', now)).toBe('1 day ago');
    expect(formatRelativeDays('2026-08-03', now)).toBe('7 days ago');
    expect(formatRelativeDays('2026-08-09T23:00:00Z', now)).toBe('today');
  });

  // The pre-open hour is when a stale scan does the most damage, and it was the
  // one hour the age readout was wrong: a bare YYYY-MM-DD parses as UTC midnight,
  // which is 07:00 WIB, so before 07:00 every dated record was reported a day
  // younger than it was.
  it('reads dated records against the local calendar day before the UTC rollover', () => {
    const preOpen = Date.parse('2026-08-11T06:00:00+07:00');
    expect(formatRelativeDays('2026-08-11', preOpen)).toBe('today');
    expect(formatRelativeDays('2026-08-10', preOpen)).toBe('1 day ago');
    expect(formatRelativeDays('2026-08-04', preOpen)).toBe('7 days ago');
  });

  // A run finished late in one session is not "today" the next morning.
  it('ages a timestamp by the calendar day it fell on, not by elapsed hours', () => {
    const morning = Date.parse('2026-08-11T09:00:00+07:00');
    expect(formatRelativeDays('2026-08-10T23:00:00+07:00', morning)).toBe('1 day ago');
    expect(formatRelativeDays('2026-08-11T00:30:00+07:00', morning)).toBe('today');
  });

  it('surfaces rather than hides missing or future-dated records', () => {
    const now = Date.parse('2026-08-10T09:00:00+07:00');
    expect(formatRelativeDays(null, now)).toBe('—');
    expect(formatRelativeDays('not-a-date', now)).toBe('—');
    expect(formatRelativeDays('2026-08-14', now)).toBe('dated ahead');
  });
});
