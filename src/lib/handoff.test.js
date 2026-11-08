import { describe, expect, it, vi } from 'vitest';
import { HANDOFF_PARAM, importHandoff } from './handoff.js';

function fakeWindow(hash, storage = {}) {
  const store = new Map(Object.entries(storage));
  return {
    location: { hash, pathname: '/radar', search: '?x=1' },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
    history: { state: null, replaceState: vi.fn() },
    store,
  };
}

const encode = (data) => `#${HANDOFF_PARAM}=${encodeURIComponent(JSON.stringify(data))}`;

describe('importHandoff', () => {
  it('imports allowlisted keys and strips the fragment', () => {
    const win = fakeWindow(encode({ 'nalar-theme': 'dark', 'nalar.chart.overlays': '{"ma20":true}', evil: 'x' }));
    expect(importHandoff(win)).toBe(2);
    expect(win.store.get('nalar-theme')).toBe('dark');
    expect(win.store.has('evil')).toBe(false);
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/radar?x=1');
  });

  it('never overwrites settings already on the new domain, but merges saved screens by name', () => {
    const win = fakeWindow(encode({
      'nalar-theme': 'dark',
      'nalar.screener.savedScreens': JSON.stringify([{ name: 'A', slots: { a: 1 } }, { name: 'B', slots: { b: 1 } }]),
    }), {
      'nalar-theme': 'light',
      'nalar.screener.savedScreens': JSON.stringify([{ name: 'A', slots: { a: 2 } }]),
    });
    importHandoff(win);
    expect(win.store.get('nalar-theme')).toBe('light');
    expect(JSON.parse(win.store.get('nalar.screener.savedScreens'))).toEqual([
      { name: 'A', slots: { a: 2 } }, { name: 'B', slots: { b: 1 } },
    ]);
  });

  it('ignores pages without a handoff and survives garbage', () => {
    const plain = fakeWindow('');
    expect(importHandoff(plain)).toBe(0);
    expect(plain.history.replaceState).not.toHaveBeenCalled();
    const junk = fakeWindow(`#${HANDOFF_PARAM}=%E0%A4%A`);
    expect(importHandoff(junk)).toBe(0);
    expect(junk.history.replaceState).toHaveBeenCalled();
  });
});
