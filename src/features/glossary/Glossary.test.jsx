import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import Glossary, { GlossaryTerm } from './Glossary.jsx';
import GuidePage from '../guide/GuidePage.jsx';
import { CATEGORIES, TERMS, TERM_BY_SLUG, termPath } from '../../content/glossary.js';
import { GUIDES } from '../../content/guides.js';
import { PAGES } from '../../content/seo.js';

const APP_ROUTES = ['/', '/radar', '/workbench', '/broker-intelligence', '/glossary', '/cara-kerja', '/metodologi'];

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/glossary" element={<Glossary />} />
        <Route path="/glossary/:slug" element={<GlossaryTerm />} />
        <Route path="/metodologi" element={<GuidePage path="/metodologi" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('glossary content', () => {
  it('has unique slugs, known categories, and links that resolve', () => {
    expect(TERM_BY_SLUG.size).toBe(TERMS.length);
    const categories = new Set(CATEGORIES.map((category) => category.id));
    for (const term of TERMS) {
      expect(term.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(categories.has(term.category)).toBe(true);
      expect(term.short.length).toBeLessThanOrEqual(160);
      for (const slug of term.related) expect(TERM_BY_SLUG.has(slug)).toBe(true);
      if (term.tool) expect(APP_ROUTES).toContain(term.tool.path);
    }
  });

  it('registers every term and guide as an Indonesian public page', () => {
    for (const term of TERMS) expect(PAGES.get(termPath(term.slug))).toMatchObject({ kind: 'term', lang: 'id' });
    for (const guide of GUIDES) expect(PAGES.get(guide.path)).toMatchObject({ kind: 'guide', lang: 'id' });
  });
});

describe('Glossary pages', () => {
  it('lists every term by category with a link to its own page', () => {
    renderAt('/glossary');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kamus istilah');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(CATEGORIES.length);
    expect(screen.getByRole('link', { name: 'Bandarmologi' })).toHaveAttribute('href', '/glossary/bandarmologi');
    expect(screen.getAllByRole('definition')).toHaveLength(TERMS.length);
  });

  it('renders a term with its app usage, tool link and related terms', () => {
    renderAt('/glossary/arb');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ARB (auto reject bawah)');
    expect(document.title).toBe('Apa itu ARB (auto reject bawah)? · Bandarlab');
    expect(document.documentElement.lang).toBe('id');
    expect(screen.getByText(/7% mulai 19 Oktober 2026 sampai 31 Desember 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Stock Analysis' })).toHaveAttribute('href', '/workbench');
    expect(screen.getByRole('link', { name: 'ARA (auto reject atas)' })).toHaveAttribute('href', '/glossary/ara');
    expect(screen.getByText(/bukan rekomendasi investasi/)).toBeInTheDocument();
  });

  it('handles an unknown term without crashing', () => {
    renderAt('/glossary/tidak-ada');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Istilah tidak ditemukan');
  });

  it('renders the methodology guide with its disclaimer', () => {
    renderAt('/metodologi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Metodologi dan batasan');
    expect(document.title).toBe('Metodologi dan batasan Bandarlab · Bandarlab');
    expect(screen.getByRole('heading', { name: 'Bukan ajakan jual/beli' })).toBeInTheDocument();
  });
});
