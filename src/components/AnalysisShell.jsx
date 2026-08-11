import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useAnalysisContext } from './AnalysisContext.jsx';

const NAV = [
  { path: '/radar', label: 'Screener' },
  { path: '/workbench', label: 'Stock Analysis' },
  { path: '/broker-intelligence', label: 'Broker Flow' },
  { path: '/cases', label: 'Watchlist' },
];

function CommandBar() {
  const location = useLocation();
  const { ticker, days, allowedWindows, openTicker, updateWindow } = useAnalysisContext();
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
      </div>
      <div className="analysis-command__windows" aria-label="Broker window">
        {allowedWindows.map((value) => (
          <button
            key={value}
            type="button"
            className={days === value ? 'is-active' : ''}
            aria-pressed={days === value}
            onClick={() => updateWindow(value)}
            title={location.pathname.startsWith('/broker-intelligence')
              ? `Load ${value}-day Broker Map window`
              : `Keep ${value}-day window for Broker Map`}
          >
            {value}D
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current = NAV.find((item) => location.pathname.startsWith(item.path)) || NAV[1];
  const { investigationUrl, brokerFlowUrl } = useAnalysisContext();
  const navTarget = (item) => item.path === '/workbench'
    ? investigationUrl()
    : item.path === '/broker-intelligence'
      ? brokerFlowUrl()
      : item.path;

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
              <span className="app-shell__nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-shell__footer">
          <span className="app-shell__delay-label">PRIVATE · DELAYED DATA</span>
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
            <h1 className="app-shell__title">{current.label}</h1>
          </div>
          <CommandBar />
        </header>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
