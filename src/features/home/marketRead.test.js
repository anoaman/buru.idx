import { describe, expect, it } from 'vitest';
import { composeMarketRead, idr, pct } from './marketRead.js';

const base = {
  ihsg: { close: 5050.429, changePct: 0.4 },
  breadth: { available: true, advanced: 229, declined: 437 },
  home: {
    foreign: { net: 108e9, inflow: [{ code: 'BBCA', net: 219e9 }], outflow: [], topInflowSharePct: 68.7 },
    limits: { araCount: 2, arbCount: 1 },
    trends: { sectors: [
      { name: 'Financials', vsIhsg: { d5: 3.2 } },
      { name: 'Energy', vsIhsg: { d5: -4.05 } },
      { name: 'Healthcare', vsIhsg: { d5: 0.1 } },
    ] },
  },
};

describe('composeMarketRead', () => {
  it('calls out a narrow rally, concentrated foreign buying, limit hits and sector leadership', () => {
    expect(composeMarketRead(base)).toEqual([
      'IHSG rose +0.40% to 5,050, but the move was narrow: 437 stocks fell against 229 that rose.',
      "Foreigners were net buyers of Rp108B, and BBCA alone took Rp219B, more than the whole market's net.",
      '2 stocks closed at ARA and 1 at ARB; over five sessions Financials led IHSG by 3.2 pts while Energy trailed by 4.0.',
    ]);
  });

  it('reports agreeing breadth and ordinary foreign selling', () => {
    const lines = composeMarketRead({
      ...base,
      ihsg: { close: 4900, changePct: -1.2 },
      breadth: { available: true, advanced: 120, declined: 500 },
      home: { foreign: { net: -50e9, inflow: [], outflow: [{ code: 'BMRI', net: -20e9 }], topOutflowSharePct: 55 } },
    });
    expect(lines[0]).toBe('IHSG fell -1.20% to 4,900, and breadth agreed: 120 up, 500 down.');
    expect(lines[1]).toBe('Foreigners were net sellers of Rp50B, led by BMRI (Rp20B); the top five names were 55% of all net selling.');
    expect(lines).toHaveLength(2);
  });

  it('drops sentences it has no data for', () => {
    expect(composeMarketRead({ ihsg: null, breadth: null, home: null })).toEqual([]);
  });
});

describe('formatters', () => {
  it('formats rupiah and percentages', () => {
    expect(idr(7.8e12)).toBe('Rp7.80T');
    expect(idr(-218.99e9)).toBe('Rp219B');
    expect(pct(0.4)).toBe('+0.40%');
  });
});
