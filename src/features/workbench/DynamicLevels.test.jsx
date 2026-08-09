import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DynamicLevels from './DynamicLevels.jsx';

function payload(overrides = {}) {
  return {
    available: true,
    reason: null,
    levels: [
      {
        period: 20,
        label: 'MA20',
        price: 6180,
        role: 'support',
        distancePct: -1.9,
        slope: 'rising',
        slopePctPerSession: 0.12,
        confluence: [],
        converging: true,
      },
      {
        period: 50,
        label: 'MA50',
        price: 6420,
        role: 'resistance',
        distancePct: 1.9,
        slope: 'falling',
        slopePctPerSession: -0.08,
        confluence: [{ price: 6425, role: 'resistance', touches: 4 }],
        converging: true,
      },
    ],
    unavailable: [],
    nearest: { support: null, resistance: null },
    ...overrides,
  };
}

describe('DynamicLevels', () => {
  it('renders nothing when the block is absent', () => {
    const { container } = render(<DynamicLevels dynamicLevels={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels each average by the side of price it sits on', () => {
    render(<DynamicLevels dynamicLevels={payload()} />);
    const ma20 = screen.getByRole('row', { name: /MA20/ });
    expect(ma20).toHaveTextContent('support');
    const ma50 = screen.getByRole('row', { name: /MA50/ });
    expect(ma50).toHaveTextContent('resistance');
  });

  it('keeps moving averages out of the static level map heading', () => {
    render(<DynamicLevels dynamicLevels={payload()} />);
    expect(screen.getByText(/Dynamic levels \(moving averages\)/)).toBeInTheDocument();
  });

  it('flags confluence with a static pivot and names the touches', () => {
    render(<DynamicLevels dynamicLevels={payload()} />);
    const badges = screen.getAllByText('confluence');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute('title', expect.stringContaining('4 touches'));
  });

  it('states what a missing average would have needed', () => {
    render(<DynamicLevels dynamicLevels={payload({
      unavailable: [{
        period: 200,
        label: 'MA200',
        reason: 'insufficient history',
        sessionsAvailable: 130,
        sessionsRequired: 200,
      }],
    })} />);
    expect(screen.getByText(/MA200 needs 200 sessions, 130 available/)).toBeInTheDocument();
    expect(screen.getByText(/Not estimated from a shorter window/)).toBeInTheDocument();
  });

  it('explains itself rather than rendering an empty table', () => {
    render(<DynamicLevels dynamicLevels={{
      available: false,
      reason: 'history unavailable',
      levels: [],
      unavailable: [],
      nearest: { support: null, resistance: null },
    }} />);
    expect(screen.getByText('history unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
