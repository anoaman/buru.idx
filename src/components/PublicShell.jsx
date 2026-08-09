import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';

const NAV = [
  { path: '/workbench', label: 'Workbench', icon: '◎' },
  { path: '/broker-intelligence', label: 'Broker Intelligence', icon: '▣' },
];

export default function PublicShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const currentLabel = NAV.find((item) => location.pathname.startsWith(item.path))?.label
    || 'Stock Analysis';

  return (
    <div className={`app-shell ${mobileOpen ? 'app-shell--mobile-open' : ''}`}>
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <span className="app-shell__logo">◈</span>
          <span className="app-shell__name">Stock Analysis</span>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `app-shell__nav-item ${isActive ? 'app-shell__nav-item--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="app-shell__nav-icon">{item.icon}</span>
              <span className="app-shell__nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-shell__footer">
          <span className="app-shell__delay-label">Delayed market data</span>
          <span className="app-shell__delay-copy">Decision support, not execution.</span>
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
          <h1 className="app-shell__title">{currentLabel}</h1>
          <div className="app-shell__spacer" />
          <span className="app-shell__delay-badge">Delayed data</span>
        </header>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
