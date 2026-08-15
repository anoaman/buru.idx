import { useCallback, useEffect, useId, useRef, useState } from 'react';

const DEFAULT_TABS = [
  { id: 'levels', label: 'Levels' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'broker', label: 'Broker Flow' },
  { id: 'changed', label: 'What Changed' },
  { id: 'risk', label: 'Risk Simulator' },
  { id: 'methodology', label: 'Methodology' },
];

function readStoredTab(storageKey, tabItems) {
  if (!storageKey || typeof sessionStorage === 'undefined') return null;
  const saved = sessionStorage.getItem(storageKey);
  return tabItems.some((tab) => tab.id === saved) ? saved : null;
}

function writeStoredTab(storageKey, tabId) {
  if (!storageKey || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(storageKey, tabId);
}

/**
 * Accessible docked detail drawer for Stock Analysis.
 * Network-heavy panels should be supplied as render props and only created when selected.
 *
 * Selection is owned by React state. sessionStorage is a per-ticker preference:
 * it is read once when `storageKey` changes and written synchronously on select.
 * Unrelated parent rerenders and async child updates must not reset the active tab.
 */
export default function DetailDrawer({
  tabs = DEFAULT_TABS,
  storageKey = null,
  children,
}) {
  const baseId = useId();
  const tabItems = tabs;
  const tabRefs = useRef({});
  const hydratedKeyRef = useRef(undefined);
  const [active, setActive] = useState(
    () => readStoredTab(storageKey, tabItems) || tabItems[0]?.id || 'levels',
  );

  useEffect(() => {
    if (hydratedKeyRef.current === storageKey) return;
    hydratedKeyRef.current = storageKey;
    const next = readStoredTab(storageKey, tabItems) || tabItems[0]?.id || 'levels';
    setActive(next);
  }, [storageKey, tabItems]);

  const selectTab = useCallback((tabId, { focus = false } = {}) => {
    if (!tabItems.some((tab) => tab.id === tabId)) return;
    setActive(tabId);
    writeStoredTab(storageKey, tabId);
    if (focus) {
      requestAnimationFrame(() => tabRefs.current[tabId]?.focus());
    }
  }, [storageKey, tabItems]);

  const selectIndex = useCallback((index, { focus = false } = {}) => {
    const next = tabItems[(index + tabItems.length) % tabItems.length];
    if (!next) return;
    selectTab(next.id, { focus });
  }, [selectTab, tabItems]);

  const onKeyDown = (event) => {
    const index = tabItems.findIndex((tab) => tab.id === active);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectIndex(index + 1, { focus: true });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectIndex(index - 1, { focus: true });
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0, { focus: true });
    } else if (event.key === 'End') {
      event.preventDefault();
      selectIndex(tabItems.length - 1, { focus: true });
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
              ref={(node) => { tabRefs.current[tab.id] = node; }}
              className={`ui-tab ${selected ? 'is-active' : ''}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
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
