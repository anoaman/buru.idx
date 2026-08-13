import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useAnalysisContext } from './AnalysisContext.jsx';
import { privateWritesEnabled } from '../lib/api/client.js';

const NAV = [
  { path: '/radar', label: 'Screener', mark: 'SC' },
  { path: '/workbench', label: 'Stock Analysis', mark: 'SA' },
  { path: '/fundamentals', label: 'Fundamentals', mark: 'FD' },
  { path: '/broker-intelligence', label: 'Broker Flow', mark: 'BF' },
  ...(privateWritesEnabled ? [{ path: '/cases', label: 'Watchlist', mark: 'WL' }] : []),
  { path: '/glossary', label: 'Glossary', mark: 'GL' },
];

function CommandBar() {
  const { ticker, asOf, openTicker } = useAnalysisContext();
  const [query, setQuery] = useState(ticker);

  useEffect(() => setQuery(ticker), [ticker]);

  const submit = (event) => {
    event.preventDefault();
    openTicker(query);
  };

  return (
    <div className="analysis-command">
      <form className="analysis-command__search" onSubmit={submit}>
        <span className="analysis-command__prompt" aria-hidden="true">⌘</span>
        <label className="sr-only" htmlFor="analysis-ticker">Open ticker investigation</label>
        <input
          id="analysis-ticker"
          value={query}
          maxLength={4}
          onChange={(event) => setQuery(event.target.value.toUpperCase())}
          placeholder="TICKER"
          autoComplete="off"
        />
        <button type="submit" disabled={!/^[A-Z]{4}$/.test(query)}>OPEN</button>
      </form>
      <div className="analysis-command__context" aria-label="Selected ticker">
        <span className="analysis-command__identity">{ticker}</span>
        {asOf ? (
          <span className="analysis-command__asof text-tertiary" title="Selected as-of date">
            as of {asOf}
          </span>
        ) : (
          <span className="analysis-command__asof text-tertiary">delayed EOD</span>
        )}
      </div>
    </div>
  );
}

export default function AnalysisShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('nalar-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const location = useLocation();
  const current = NAV.find((item) => location.pathname.startsWith(item.path)) || NAV[1];
  const { investigationUrl, brokerFlowUrl, fundamentalsUrl } = useAnalysisContext();
  const navTarget = (item) => item.path === '/workbench'
    ? investigationUrl()
    : item.path === '/broker-intelligence'
      ? brokerFlowUrl()
      : item.path === '/fundamentals'
        ? fundamentalsUrl()
        : item.path;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nalar-theme', theme);
  }, [theme]);

  return (
    <div className={`app-shell ${mobileOpen ? 'app-shell--mobile-open' : ''}`}>
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__logo">N</span>
          <div>
            <span className="app-shell__name">NALAR</span>
            <span className="app-shell__edition">IDX ANALYSIS</span>
          </div>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={navTarget(item)}
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? 'app-shell__nav-item--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="app-shell__nav-mark" aria-hidden="true">{item.mark}</span>
              <span className="app-shell__nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-shell__footer">
          <span className="app-shell__market"><i aria-hidden="true" />IDX workstation</span>
          <span className="app-shell__delay-label">Private · delayed data</span>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__header">
          <button
            className="app-shell__menu-btn"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            ☰
          </button>
          <div className="app-shell__section-id">
            <span>NALAR</span><b>/</b><h1 className="app-shell__title">{current.label}</h1>
          </div>
          <CommandBar />
          <button
            type="button"
            className="app-shell__theme"
            onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'Switch to Graphite Ledger' : 'Switch to Paper Ledger'}
            title={theme === 'light' ? 'Switch to Graphite Ledger' : 'Switch to Paper Ledger'}
          >
            {theme === 'light' ? 'Graphite' : 'Paper'}
          </button>
        </header>
        <main className="app-shell__content">
          <div key={location.pathname} className="app-shell__page">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
