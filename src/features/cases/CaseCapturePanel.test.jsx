import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CaseCapturePanel from './CaseCapturePanel.jsx';

vi.mock('../../lib/api/client.js', () => ({ saveCase: vi.fn() }));
import { saveCase } from '../../lib/api/client.js';

describe('CaseCapturePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the human thesis together with the frozen machine snapshot', async () => {
    saveCase.mockResolvedValue({ success: true, data: { id: 17 } });
    render(
      <CaseCapturePanel
        ticker="BBRI"
        source="Market Shortlist scan #41"
        snapshot={{ dataAsOf: '2026-08-12', capitalTier: 'first-liner', score: 74 }}
        defaults={{ confirmation: 'Daily close above 4550', invalidationPrice: 4180, targetPrice: 5000 }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Your thesis/i), { target: { value: 'Structure should expand' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save case' }));
    await waitFor(() => expect(saveCase).toHaveBeenCalledTimes(1));
    expect(saveCase.mock.calls[0][0]).toMatchObject({
      ticker: 'BBRI',
      thesis: 'Structure should expand',
      horizonSessions: 20,
      expectedConfirmation: { text: 'Daily close above 4550' },
      targets: [5000],
    });
    expect(screen.getByText(/Case saved/i)).toBeInTheDocument();
  });

  it('preserves input and exposes an API failure', async () => {
    saveCase.mockResolvedValue({ success: false, error: 'Private API unavailable' });
    render(
      <CaseCapturePanel
        ticker="BBRI"
        source="Stock Analysis"
        snapshot={{}}
        defaults={{ confirmation: 'Wait', invalidationPrice: 4000 }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Your thesis/i), { target: { value: 'Keep this note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save case' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Private API unavailable');
    expect(screen.getByLabelText(/Your thesis/i)).toHaveValue('Keep this note');
  });
});
