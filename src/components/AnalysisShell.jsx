import { useEffect, useRef, useState } from 'react';
import { BrandCandle, BrandWordmark } from './BrandMark.jsx';
import { Link, NavLink, useLocation } from 'react-router';
import { useAnalysisContext } from './AnalysisContext.jsx';
import FreshnessBar from './FreshnessBar.jsx';
import Watermark from './Watermark.jsx';
import { APP_PAGES, GUIDE_LABELS, isContentPath, normalizePath } from '../content/routes.js';

// Line icons (Lucide geometry, 24px grid) drawn in currentColor so they follow
// the nav item's active and hover colours.
const ICONS = {
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  screener: (
    <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
  ),
  analysis: (
    <>
      <path d="M9 5v4" /><rect width="4" height="6" x="7" y="9" rx="1" /><path d="M9 15v2" />
      <path d="M17 3v2" /><rect width="4" height="8" x="15" y="5" rx="1" /><path d="M17 13v3" />
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    </>
  ),
  brokerFlow: (
    <>
      <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
    </>
  ),
  glossary: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
};

const NAV = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/radar', label: 'Screener', icon: 'screener' },
  { path: '/workbench', label: 'Stock Analysis', icon: 'analysis' },
  { path: '/broker-intelligence', label: 'Broker Flow', icon: 'brokerFlow' },
  { path: '/glossary', label: 'Glossary', icon: 'glossary' },
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
  const current = NAV.find((item) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path))) || NAV[0];
  // App routes take their title from the same registry the Worker serves to
  // crawlers. Content pages (glossary, guides) set their own via ContentPage.
  const path = normalizePath(location.pathname);
  const isContent = isContentPath(path);
  const sectionLabel = GUIDE_LABELS.get(path) || current.label;
  const contentRef = useRef(null);

  useEffect(() => {
    if (isContent) return;
    document.title = APP_PAGES.get(path)?.title || `${sectionLabel} · Bandarlab`;
    document.documentElement.lang = 'en';
  }, [isContent, path, sectionLabel]);

  // Each route starts at the top; query-only changes (ticker, filters) keep position.
  useEffect(() => {
    contentRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);
  const { investigationUrl, brokerFlowUrl } = useAnalysisContext();
  const navTarget = (item) => item.path === '/workbench'
    ? investigationUrl()
    : item.path === '/broker-intelligence'
      ? brokerFlowUrl()
      : item.path;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nalar-theme', theme);
  }, [theme]);

  return (
    <div className={`app-shell ${mobileOpen ? 'app-shell--mobile-open' : ''}`}>
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__logo"><BrandCandle /></span>
          <div className="app-shell__name"><BrandWordmark /></div>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={navTarget(item)}
              end={item.path === '/'}
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? 'app-shell__nav-item--active' : ''}`
              }
              title={item.label}
              aria-label={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <svg className="app-shell__nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                {ICONS[item.icon]}
              </svg>
              <span className="app-shell__nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-shell__footer">
          <span className="app-shell__market"><i aria-hidden="true" />IDX workstation</span>
          <span className="app-shell__delay-label">Delayed data</span>
          <span className="app-shell__guides">
            <Link to="/cara-kerja" onClick={() => setMobileOpen(false)}>How it works</Link>
            <Link to="/metodologi" onClick={() => setMobileOpen(false)}>Methodology</Link>
          </span>
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
            <span>Bandarlab</span><b>/</b>
            {isContent
              ? <span className="app-shell__title">{sectionLabel}</span>
              : <h1 className="app-shell__title">{sectionLabel}</h1>}
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
        <main className="app-shell__content" ref={contentRef}>
          <FreshnessBar />
          {children}
        </main>
        {current.path === '/radar' && <Watermark />}
      </div>
    </div>
  );
}
