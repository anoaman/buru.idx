import { afterEach, describe, expect, it } from 'vitest';
import { analyticsEnabled, resetAnalyticsForTest, startAnalytics } from './analytics.js';

afterEach(() => {
  resetAnalyticsForTest();
  delete window.dataLayer;
  delete window.gtag;
  document.head.querySelectorAll('script[src*="googletagmanager"]').forEach((node) => node.remove());
});

describe('analytics', () => {
  it('only runs on the public host', () => {
    expect(analyticsEnabled('bandarlab.site')).toBe(true);
    expect(analyticsEnabled('www.bandarlab.site')).toBe(false);
    expect(analyticsEnabled('analysis.tombaklepas.app')).toBe(false);
    expect(analyticsEnabled('100.90.140.51')).toBe(false);
    expect(analyticsEnabled('localhost')).toBe(false);
  });

  it('does nothing off the public host', () => {
    expect(startAnalytics()).toBe(false);
    expect(window.dataLayer).toBeUndefined();
    expect(document.head.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
});
