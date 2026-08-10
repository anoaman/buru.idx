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

  it('surfaces rather than hides missing or future-dated records', () => {
    const now = Date.parse('2026-08-10T09:00:00+07:00');
    expect(formatRelativeDays(null, now)).toBe('—');
    expect(formatRelativeDays('not-a-date', now)).toBe('—');
    expect(formatRelativeDays('2026-08-14', now)).toBe('dated ahead');
  });
});
