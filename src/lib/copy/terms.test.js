import { describe, expect, it } from 'vitest';
import {
  GLOSSARY_GROUPS,
  LABELS,
  framingLabel,
  leanLabel,
  recipeFitLabel,
  setupTypeLabel,
} from './terms.js';

describe('trader-facing copy', () => {
  it('uses everyday setup words instead of engine keys', () => {
    expect(setupTypeLabel('distribution_risk')).toBe('Selling pressure');
    expect(setupTypeLabel('trend_pullback')).toBe('Pullback in an uptrend');
    expect(framingLabel('long_setup')).toBe('Long setup');
    expect(framingLabel('defensive')).toBe('Risk, not a long');
    expect(recipeFitLabel('medium')).toBe('Medium recipe fit');
    expect(leanLabel('LONG_LEAN')).toBe('Constructive');
    expect(LABELS.failsBelow).toBe('Fails below');
    expect(LABELS.clearsAbove).toBe('Clears above');
  });

  it('keeps glossary titles aligned with on-screen labels', () => {
    const titles = GLOSSARY_GROUPS.flatMap((group) => group.entries.map((entry) => entry.title));
    expect(titles).toContain(LABELS.clearsAbove);
    expect(titles).toContain(LABELS.failsBelow);
    expect(titles).toContain(LABELS.recipeFit);
    expect(titles).toContain(LABELS.windowNet);
  });
});
