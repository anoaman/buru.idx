// Bandarlab brand: the wordmark "bandarlab" with the "l" replaced by a solid
// green candlestick, plus the candle alone for the collapsed sidebar and
// favicon. The candle is sized to the "l" of Zen Kaku Gothic Antique 700:
// 0.71em ascender, baseline-aligned, so it sits exactly in the letter's slot.
export function BrandCandle({ className = '' }) {
  return (
    <svg className={`brand-candle ${className}`} viewBox="0 0 22 71" aria-hidden="true" focusable="false">
      <rect x="9" y="0" width="4" height="71" rx="2" fill="currentColor" />
      <rect x="1" y="11" width="20" height="46" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function BrandWordmark() {
  return (
    <span className="brand-wordmark" role="img" aria-label="Bandarlab">
      <span aria-hidden="true">bandar</span>
      <BrandCandle className="brand-wordmark__l" />
      <span aria-hidden="true" className="brand-wordmark__ab">ab</span>
    </span>
  );
}
