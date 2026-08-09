import { useEffect, useMemo, useState } from 'react';

/**
 * TradingViewChart — lazy-loaded free TradingView embed for IDX symbols.
 *
 * Only the ticker symbol leaves the app (as IDX:TICKER). No credentials,
 * broker data, or analysis payloads are sent. Mounted only when selected.
 *
 * @param {object} props
 * @param {string} props.ticker - Four-letter IDX symbol (e.g. BBRI)
 */
export default function TradingViewChart({ ticker }) {
  const symbol = useMemo(() => {
    const clean = String(ticker || '').trim().toUpperCase();
    return clean ? `IDX:${clean}` : null;
  }, [ticker]);

  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const embedUrl = useMemo(() => {
    if (!symbol) return null;
    const params = new URLSearchParams({
      symbol,
      interval: 'D',
      theme: 'dark',
      style: '1',
      locale: 'en',
      timezone: 'Asia/Jakarta',
      hide_top_toolbar: '0',
      hide_legend: '0',
      save_image: '0',
      hideideas: '1',
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol]);

  const openUrl = symbol
    ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
    : 'https://www.tradingview.com/';

  useEffect(() => {
    setBlocked(false);
    setLoading(true);
  }, [symbol]);

  if (!symbol || !embedUrl) {
    return (
      <div className="wb-tv wb-tv--empty">
        <h3 className="wb-section__title text-tertiary">TradingView</h3>
        <div className="text-tertiary">Enter a ticker to load the TradingView chart.</div>
      </div>
    );
  }

  return (
    <div className="wb-tv">
      <div className="wb-tv__header">
        <h3 className="wb-section__title text-tertiary">TradingView</h3>
        <span className="wb-tv__symbol text-tertiary">{symbol}</span>
      </div>

      {blocked ? (
        <div className="wb-tv__fallback" role="status">
          <p className="text-secondary">
            TradingView widget could not load in this environment.
          </p>
          <a
            className="wb-tv__link"
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open {symbol} on TradingView
          </a>
        </div>
      ) : (
        <div className="wb-tv__frame-wrap">
          {loading && (
            <div className="wb-tv__loading text-tertiary" role="status">
              Loading TradingView chart…
            </div>
          )}
          <iframe
            key={symbol}
            className="wb-tv__iframe"
            src={embedUrl}
            title={`TradingView chart for ${symbol}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setBlocked(true);
            }}
          />
        </div>
      )}

      <div className="wb-tv__footer">
        <a
          className="wb-tv__link text-tertiary"
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on TradingView
        </a>
      </div>
    </div>
  );
}
