import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const ALLOWED_WINDOWS = [1, 7, 14, 30, 60];
const AnalysisContext = createContext(null);

function validTicker(value) {
  const ticker = String(value || '').trim().toUpperCase();
  return /^[A-Z]{4}$/.test(ticker) ? ticker : null;
}

function validWindow(value) {
  const days = Number(value);
  return ALLOWED_WINDOWS.includes(days) ? days : null;
}

export function AnalysisProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [ticker, setTicker] = useState('BBCA');
  const [days, setDays] = useState(1);
  const [asOf, setAsOf] = useState(null);
  const [brokerRange, setBrokerRange] = useState('preset=latest');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTicker = validTicker(params.get('ticker'));
    const nextDays = validWindow(params.get('days'));
    const nextAsOf = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '')
      ? params.get('date')
      : null;
    if (nextTicker) setTicker(nextTicker);
    if (nextDays) setDays(nextDays);
    setAsOf(nextAsOf);
    if (location.pathname.startsWith('/broker-intelligence')) {
      const range = new URLSearchParams();
      for (const key of ['preset', 'from', 'to', 'days', 'date']) {
        const value = params.get(key);
        if (value) range.set(key, value);
      }
      setBrokerRange(range.toString() || 'preset=latest');
    }
  }, [location.pathname, location.search]);

  const investigationUrl = (value = ticker) => {
    const nextTicker = validTicker(value);
    return nextTicker ? `/workbench?ticker=${encodeURIComponent(nextTicker)}` : null;
  };

  const brokerFlowUrl = (value = ticker) => {
    const nextTicker = validTicker(value);
    if (!nextTicker) return null;
    const params = new URLSearchParams(brokerRange);
    params.set('lens', 'stock');
    params.set('ticker', nextTicker);
    return `/broker-intelligence?${params.toString()}`;
  };

  const openInvestigation = (value = ticker) => {
    const nextTicker = validTicker(value);
    if (!nextTicker) return false;
    setTicker(nextTicker);
    navigate(investigationUrl(nextTicker));
    return true;
  };

  const openTicker = (value = ticker) => {
    const nextTicker = validTicker(value);
    if (!nextTicker) return false;
    setTicker(nextTicker);
    navigate(location.pathname.startsWith('/broker-intelligence') ? brokerFlowUrl(nextTicker) : investigationUrl(nextTicker));
    return true;
  };

  const openInvestigationTab = (value = ticker) => {
    const url = investigationUrl(value);
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  };

  const openBrokerFlowTab = (value = ticker) => {
    const url = brokerFlowUrl(value);
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  };

  const openBrokerMap = (value = ticker, nextDays = days) => {
    const nextTicker = validTicker(value);
    const safeDays = validWindow(nextDays) || 1;
    if (!nextTicker) return false;
    setTicker(nextTicker);
    setDays(safeDays);
    const params = new URLSearchParams({
      lens: 'stock',
      ticker: nextTicker,
      days: String(safeDays),
    });
    if (asOf) params.set('date', asOf);
    navigate(`/broker-intelligence?${params.toString()}`);
    return true;
  };

  const updateWindow = (value) => {
    const nextDays = validWindow(value);
    if (!nextDays) return;
    setDays(nextDays);
    if (!location.pathname.startsWith('/broker-intelligence')) return;
    const params = new URLSearchParams(location.search);
    params.set('days', String(nextDays));
    if (!params.get('lens')) params.set('lens', 'stock');
    if (params.get('lens') === 'stock' && !params.get('ticker')) params.set('ticker', ticker);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const value = useMemo(() => ({
    ticker,
    days,
    asOf,
    allowedWindows: ALLOWED_WINDOWS,
    openInvestigation,
    openBrokerMap,
    openTicker,
    openInvestigationTab,
    openBrokerFlowTab,
    investigationUrl,
    brokerFlowUrl,
    updateWindow,
  }), [ticker, days, asOf, brokerRange, location.pathname, location.search]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysisContext() {
  const value = useContext(AnalysisContext);
  if (!value) throw new Error('useAnalysisContext must be used inside AnalysisProvider');
  return value;
}
