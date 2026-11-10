// Public page registry: titles, descriptions and language for every indexable
// route. The Worker (worker/seo.js) uses it for crawler HTML and the sitemap;
// the app shell (app routes, via routes.js) and ContentPage (content routes)
// use the same titles for document.title, so the rendered page never
// contradicts what crawlers were served.
import { GLOSSARY_UPDATED, TERMS, termPath } from './glossary.js';
import { GUIDES } from './guides.js';
import { APP_PAGES, GUIDE_LABELS, SITE_DESCRIPTION, normalizePath } from './routes.js';

export { SITE_DESCRIPTION, normalizePath };

export const ORIGIN = 'https://bandarlab.site';
export const CONTENT_UPDATED = GLOSSARY_UPDATED;

export const PAGES = new Map([
  ...[...APP_PAGES].map(([path, meta]) => [path, { ...meta, kind: 'app', lang: 'en' }]),
  ['/glossary', {
    kind: 'glossary',
    lang: 'id',
    name: 'Glossary',
    title: 'Kamus istilah saham dan bandarmologi · Bandarlab',
    description: `Arti ${TERMS.length} istilah saham Indonesia dalam bahasa sederhana: bandarmologi, broker summary, akumulasi, ARA dan ARB, FCA, support dan lainnya.`,
    lastmod: GLOSSARY_UPDATED,
  }],
  ...GUIDES.map((guide) => [guide.path, {
    kind: 'guide',
    lang: 'id',
    name: GUIDE_LABELS.get(guide.path),
    title: `${guide.title} · Bandarlab`,
    description: guide.description,
    lastmod: CONTENT_UPDATED,
  }]),
  ...TERMS.map((term) => [termPath(term.slug), {
    kind: 'term',
    lang: 'id',
    name: term.term,
    slug: term.slug,
    title: `Apa itu ${term.term}? · Bandarlab`,
    description: term.short,
    lastmod: GLOSSARY_UPDATED,
  }]),
]);

export const pageMeta = (path) => PAGES.get(normalizePath(path)) || null;
