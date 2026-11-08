// One-time carry-over of per-browser settings when the platform moved from
// analysis.tombaklepas.app to bandarlab.site. localStorage is per-origin, so
// the old host packs these keys into the URL fragment (never sent to a server)
// and this module imports them on first load, then strips the fragment.
export const HANDOFF_PARAM = 'nalar-handoff';
export const HANDOFF_KEYS = ['nalar.screener.savedScreens', 'nalar.chart.overlays', 'nalar-theme'];
const SAVED_SCREENS_KEY = 'nalar.screener.savedScreens';
const MAX_HANDOFF_LENGTH = 200_000;

function mergeSavedScreens(existing, incoming) {
  try {
    const current = JSON.parse(existing);
    const next = JSON.parse(incoming);
    if (!Array.isArray(current) || !Array.isArray(next)) return existing;
    const names = new Set(current.map((item) => item?.name));
    const added = next.filter((item) => item?.name && item.slots && !names.has(item.name));
    return JSON.stringify([...current, ...added]);
  } catch {
    return existing;
  }
}

export function importHandoff(win = window) {
  const prefix = `#${HANDOFF_PARAM}=`;
  const { hash, pathname, search } = win.location;
  if (!hash.startsWith(prefix)) return 0;
  let imported = 0;
  try {
    const raw = hash.slice(prefix.length);
    if (raw.length <= MAX_HANDOFF_LENGTH) {
      const data = JSON.parse(decodeURIComponent(raw));
      for (const key of HANDOFF_KEYS) {
        const value = data?.[key];
        if (typeof value !== 'string') continue;
        const existing = win.localStorage.getItem(key);
        if (existing == null) {
          win.localStorage.setItem(key, value);
          imported += 1;
        } else if (key === SAVED_SCREENS_KEY) {
          const merged = mergeSavedScreens(existing, value);
          if (merged !== existing) {
            win.localStorage.setItem(key, merged);
            imported += 1;
          }
        }
      }
    }
  } catch {
    // Malformed or blocked storage: the app still loads with defaults.
  }
  win.history.replaceState(win.history.state, '', `${pathname}${search}`);
  return imported;
}
