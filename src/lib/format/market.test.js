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
});
