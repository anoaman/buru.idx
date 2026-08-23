import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NewsDetector from './NewsDetector.jsx';

vi.mock('../../lib/api/client.js', () => ({ getNewsDetector: vi.fn(), runNewsDetector: vi.fn() }));
import { getNewsDetector, runNewsDetector } from '../../lib/api/client.js';

const RESULT = {
  success: true,
  data: {
    available: true,
    run: { id: 1, totalDisclosures: 2, taxonomyVersion: '1', suppressedCount: 1, materialCount: 1 },
    items: [
      {
        eventId: 'e1',
        ticker: 'TEST',
        title: 'Akuisisi PT X',
        disposition: 'material',
        category: 'acquisition',
        signalScore: 0.9,
        evidence: [{ kind: 'title_keyword', quote: 'Akuisisi PT X' }],
        officialSourceUrl: 'https://www.idx.co.id/e1',
        scoreBreakdown: { title: 0.3, body: 0, categoryWeight: 1, deepParsed: false },
      },
      {
        eventId: 'e2',
        ticker: 'TEST',
        title: 'Pemberitahuan Rapat',
        disposition: 'suppressed',
        category: 'administrative_notice',
        signalScore: 0,
        suppressionReason: 'Routine notice',
        evidence: [],
        scoreBreakdown: { deepParsed: false },
      },
    ],
  },
};

beforeEach(() => {
  getNewsDetector.mockReset().mockResolvedValue(RESULT);
  runNewsDetector.mockReset().mockResolvedValue(RESULT);
});

it('renders ranked material signals and suppression counts', async () => {
  render(<MemoryRouter><NewsDetector /></MemoryRouter>);
  expect(await screen.findByText('1 material signal')).toBeInTheDocument();
  expect(screen.getByText('Akuisisi PT X')).toBeInTheDocument();
  expect(screen.getByText(/1 routine item suppressed/)).toBeInTheDocument();
});

it('runs the selected-date scan and shows suppressed items in All disclosures', async () => {
  render(<MemoryRouter><NewsDetector /></MemoryRouter>);
  await screen.findByText('1 material signal');
  fireEvent.click(screen.getByRole('button', { name: 'Scan date' }));
  await waitFor(() => expect(runNewsDetector).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('tab', { name: 'All disclosures' }));
  expect(screen.getByTestId('news-all-disclosures')).toBeInTheDocument();
  expect(screen.getAllByTestId('news-all-row')).toHaveLength(2);
  expect(screen.getByText('Pemberitahuan Rapat')).toBeInTheDocument();
  expect(screen.getByText('Routine notice')).toBeInTheDocument();
});
