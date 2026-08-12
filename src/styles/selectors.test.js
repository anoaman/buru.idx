/**
 * Regression: multi-line selector groups in components.css must use commas.
 * Without commas, CSS treats consecutive lines as descendant combinators
 * (`.a\n.b` → `.a .b`), which was the Graphite pass layout-break root cause.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLESHEETS = [
  resolve(import.meta.dirname, '../styles/components.css'),
  resolve(import.meta.dirname, '../styles/global.css'),
  resolve(import.meta.dirname, '../styles/tokens.css'),
];

function stripBlockComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

function findMissingCommaGroups(css) {
  const lines = stripBlockComments(css).split('\n');
  const bugs = [];
  let i = 0;
  while (i < lines.length) {
    const stripped = lines[i].trim();
    if (
      !stripped
      || stripped.startsWith('@')
      || stripped.startsWith('}')
      || stripped.endsWith('{')
      || stripped.endsWith(',')
      || stripped.endsWith(';')
      || stripped.includes('{')
    ) {
      i += 1;
      continue;
    }
    // Selector-like only: class/id/attr/pseudo/tag starting a rule
    if (!/^[.#:\[]|^[a-z][\w-]*([.#:\[]|\s|$)/i.test(stripped)) {
      i += 1;
      continue;
    }

    const group = [i];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next) break;
      if (!/^[.#:\[]|^[a-z][\w-]*([.#:\[]|\s|$)/i.test(next)) break;
      if (next.endsWith(';') && !next.includes('{')) break;
      group.push(j);
      if (next.endsWith('{') || next.includes('{')) break;
      j += 1;
    }

    const last = lines[group[group.length - 1]].trim();
    if (group.length > 1 && (last.endsWith('{') || last.includes('{'))) {
      const missing = group.slice(0, -1).filter((idx) => !lines[idx].trim().endsWith(','));
      // Only flag when every non-final line looks like an independent selector
      // (starts with . # [ :) — avoids tag{property} false positives.
      const independent = group.slice(0, -1).every((idx) => /^[.#:\[]/.test(lines[idx].trim()));
      if (missing.length && independent) {
        bugs.push({
          start: group[0] + 1,
          end: group[group.length - 1] + 1,
          selectors: group.map((idx) => lines[idx].trim()),
        });
      }
      i = group[group.length - 1] + 1;
      continue;
    }
    i += 1;
  }
  return bugs;
}

describe('stylesheet selector groups', () => {
  it.each(STYLESHEETS.map((path) => [path.split('/').pop(), path]))(
    '%s has no missing-comma multi-line selector groups',
    (_name, path) => {
      const bugs = findMissingCommaGroups(readFileSync(path, 'utf8'));
      expect(bugs, JSON.stringify(bugs, null, 2)).toEqual([]);
    },
  );

  it('keeps the known Graphite symptom selectors as comma groups', () => {
    const css = readFileSync(STYLESHEETS[0], 'utf8');
    expect(css).toMatch(/\.module-heading h2,\s*\n\.bi-intro__title,\s*\n\.wb-header__symbol\s*\{/);
    expect(css).toMatch(/\.scout-layout__conditions \.scout-controls__intro,\s*\n\.scout-layout__conditions \.scout-conditions\s*\{/);
    expect(css).toMatch(/\.radar-cell-ticker,\s*\n\.radar-cell-levels,\s*\n\.radar-cell-metric,\s*\n\.radar-cell-why\s*\{/);
  });

  it('does not add pseudo-elements directly to table rows', () => {
    const css = stripBlockComments(readFileSync(STYLESHEETS[0], 'utf8'));
    // The tail must stay inside one selector: [^,{]* also crossed `}` and `;`,
    // so `transition: transform …} .app-shell--mobile-open::after {` matched and
    // the guard reported three phantom violations. Selector characters only.
    expect(css).not.toMatch(/(?:\btr|\.ui-row)[\w.\-[\]='":() ]*::(?:before|after)\s*\{/);
  });
});
