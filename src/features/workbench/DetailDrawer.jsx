import { useCallback, useEffect, useId, useState } from 'react';

const DEFAULT_TABS = [
  { id: 'levels', label: 'Levels' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'broker', label: 'Broker Flow' },
  { id: 'changed', label: 'What Changed' },
  { id: 'risk', label: 'Risk Simulator' },
  { id: 'methodology', label: 'Methodology' },
];

/**
 * Accessible docked detail drawer for Stock Analysis.
 * Network-heavy panels should be supplied as render props and only created when selected.
 */
export default function DetailDrawer({
  tabs = DEFAULT_TABS,
  storageKey = null,
  children,
}) {
  const baseId = useId();
  const tabItems = tabs;
  const [active, setActive] = useState(() => {
    if (storageKey && typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      if (tabItems.some((tab) => tab.id === saved)) return saved;
    }
    return tabItems[0]?.id || 'levels';
  });

  useEffect(() => {
    if (storageKey && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, active);
    }
  }, [active, storageKey]);

  const selectIndex = useCallback((index) => {
    const next = tabItems[(index + tabItems.length) % tabItems.length];
    if (next) setActive(next.id);
  }, [tabItems]);

  const onKeyDown = (event) => {
    const index = tabItems.findIndex((tab) => tab.id === active);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectIndex(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectIndex(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectIndex(tabItems.length - 1);
    }
  };

  const panel = typeof children === 'function' ? children(active) : children;

  return (
    <section className="wb-detail-drawer" aria-label="Analysis details">
      <div
        className="ui-tabs wb-detail-drawer__tabs"
        role="tablist"
        aria-label="Analysis detail sections"
        onKeyDown={onKeyDown}
      >
        {tabItems.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              className={`ui-tab ${selected ? 'is-active' : ''}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="wb-detail-drawer__panel"
      >
        {panel}
      </div>
    </section>
  );
}
