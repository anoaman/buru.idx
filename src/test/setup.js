import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver for lightweight-charts in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock lightweight-charts canvas-based charting (incompatible with jsdom)
vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: () => ({
      setData: () => {},
      createPriceLine: () => {},
    }),
    priceScale: () => ({
      applyOptions: () => {},
    }),
    timeScale: () => ({
      fitContent: () => {},
    }),
    applyOptions: () => {},
    remove: () => {},
  }),
  CandlestickSeries: {},
  HistogramSeries: {},
  LineSeries: {},
}));
