// Crawler-facing HTML for the SPA shell. The app builds every page in the
// browser, so crawlers that skip JavaScript would otherwise see one word.
// App routes get their own title, description, canonical, JSON-LD and a short
// <noscript> summary. Content routes (glossary, terms, guides) get the full
// article inside #root, which React replaces on mount with the same text.
// Unknown paths stay usable but are marked noindex; unknown glossary terms 404.
import { CATEGORIES, TERMS, TERM_BY_SLUG, termPath } from '../src/content/glossary.js';
import { GUIDE_BY_PATH } from '../src/content/guides.js';
import { CONTENT_UPDATED, ORIGIN, PAGES, SITE_DESCRIPTION, normalizePath, pageMeta } from '../src/content/seo.js';

const ORG = { '@type': 'Organization', '@id': 'https://tombaklepas.app/#org', name: 'Tombak Lepas', url: 'https://tombaklepas.app/' };
const DISCLAIMER_ID = 'Bandarlab hanya membaca data tertunda. Isinya bukan rekomendasi investasi atau ajakan jual/beli.';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON-LD sits inside <script>; escape "<" so data can never close the tag.
const jsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const WEBSITE = { '@type': 'WebSite', '@id': ORIGIN + '/#website', name: 'Bandarlab', url: ORIGIN + '/', inLanguage: ['en', 'id'], publisher: { '@id': ORG['@id'] } };
const APP = {
  '@type': 'WebApplication', '@id': ORIGIN + '/#app', name: 'Bandarlab', url: ORIGIN + '/',
  description: SITE_DESCRIPTION, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
  isAccessibleForFree: true, inLanguage: 'en', creator: ORG, publisher: { '@id': ORG['@id'] },
};
const TERM_SET_ID = ORIGIN + '/glossary#terms';

function breadcrumb(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: ORIGIN + path })),
  };
}

function graphFor(path, meta) {
  if (path === '/') return [WEBSITE, APP];
  const url = ORIGIN + path;
  const page = {
    '@type': 'WebPage', '@id': url + '#page', url, name: meta.title, description: meta.description,
    inLanguage: meta.lang, isPartOf: { '@id': WEBSITE['@id'] }, about: { '@id': APP['@id'] },
    ...(meta.lastmod ? { dateModified: meta.lastmod } : {}),
  };
  if (meta.kind === 'glossary') {
    return [WEBSITE, page, {
      '@type': 'DefinedTermSet', '@id': TERM_SET_ID, name: 'Kamus istilah Bandarlab', url, inLanguage: 'id',
      hasDefinedTerm: TERMS.map((term) => ({ '@id': ORIGIN + termPath(term.slug) + '#term' })),
    }, breadcrumb([['Bandarlab', '/'], ['Glossary', '/glossary']])];
  }
  if (meta.kind === 'term') {
    const term = TERM_BY_SLUG.get(meta.slug);
    return [WEBSITE, page, {
      '@type': 'DefinedTerm', '@id': url + '#term', name: term.term, alternateName: term.en,
      description: term.short, url, inLanguage: 'id',
      inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': TERM_SET_ID, name: 'Kamus istilah Bandarlab', url: ORIGIN + '/glossary' },
    }, breadcrumb([['Bandarlab', '/'], ['Glossary', '/glossary'], [term.term, termPath(term.slug)]])];
  }
  return [WEBSITE, page, breadcrumb([['Bandarlab', '/'], [meta.name, path]])];
}

const p = (text) => `<p>${escapeHtml(text)}</p>`;
const a = (href, text) => `<a href="${href}">${escapeHtml(text)}</a>`;
const footer = () => `<footer>${p(DISCLAIMER_ID)}<p>${a('/cara-kerja', 'Cara kerja')} · ${a('/metodologi', 'Metodologi')} · ${a('/glossary', 'Glossary')} · Dibuat oleh ${a('https://tombaklepas.app/', 'Tombak Lepas')}</p></footer>`;

function glossaryHtml() {
  const groups = CATEGORIES.map((category) => {
    const items = TERMS.filter((term) => term.category === category.id)
      .map((term) => `<li>${a(termPath(term.slug), term.term)}: ${escapeHtml(term.short)}</li>`).join('');
    return `<section><h2>${escapeHtml(category.label)}</h2><ul>${items}</ul></section>`;
  }).join('');
  return `<h1>Kamus istilah saham dan bandarmologi</h1>${p('Istilah yang dipakai di Bandarlab, dijelaskan dalam bahasa sederhana beserta cara membacanya di Home, Screener, Stock Analysis dan Broker Flow.')}${groups}`;
}

function termHtml(term) {
  const related = term.related.map((slug) => TERM_BY_SLUG.get(slug)).filter(Boolean)
    .map((item) => `<li>${a(termPath(item.slug), item.term)}</li>`).join('');
  return [
    `<p>${a('/glossary', 'Glossary')}</p>`,
    `<h1>${escapeHtml(term.term)}</h1>`,
    `<p><strong>${escapeHtml(term.short)}</strong></p>`,
    term.en ? p(`Istilah di aplikasi: ${term.en}.`) : '',
    term.body.map(p).join(''),
    `<h2>Di Bandarlab</h2>${p(term.inApp)}`,
    term.tool ? `<p>${a(term.tool.path, term.tool.label)}</p>` : '',
    related ? `<h2>Istilah terkait</h2><ul>${related}</ul>` : '',
  ].join('');
}

function guideHtml(guide) {
  const sections = guide.sections.map((section) => [
    `<h2>${escapeHtml(section.heading)}</h2>`,
    (section.paragraphs || []).map(p).join(''),
    section.items ? `<dl>${section.items.map(([label, text]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd>`).join('')}</dl>` : '',
  ].join('')).join('');
  return `<h1>${escapeHtml(guide.title)}</h1>${p(guide.lead)}${sections}`;
}

function articleFor(path, meta) {
  if (meta.kind === 'glossary') return glossaryHtml();
  if (meta.kind === 'term') return termHtml(TERM_BY_SLUG.get(meta.slug));
  if (meta.kind === 'guide') return guideHtml(GUIDE_BY_PATH.get(path));
  return '';
}

function appSummary(meta) {
  const links = [...PAGES].filter(([, m]) => m.kind !== 'term')
    .map(([path, m]) => `<li>${a(path, m.name)}</li>`).join('');
  return `<noscript><h1>${escapeHtml(meta.title)}</h1>${p(meta.summary)}<p>Bandarlab is read-only research on delayed data. It is not investment advice or a recommendation to buy or sell (bukan ajakan jual/beli).</p><ul>${links}</ul><p>Built by ${a('https://tombaklepas.app/', 'Tombak Lepas')}. Enable JavaScript to use the app.</p></noscript>`;
}

export function seoHead(rawPath) {
  const path = normalizePath(rawPath);
  const meta = pageMeta(path);
  if (!meta) return { head: '<meta name="robots" content="noindex">', body: '', root: '' };
  const url = ORIGIN + path;
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${url}">`,
    meta.lang === 'id' ? '<meta property="og:locale" content="id_ID">' : '',
    `<meta name="twitter:card" content="summary">`,
    `<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': graphFor(path, meta) })}</script>`,
  ].join('');
  if (meta.kind === 'app') return { head, body: appSummary(meta), root: '', meta };
  return { head, body: '', root: `<article class="seo-static" lang="id">${articleFor(path, meta)}${footer()}</article>`, meta };
}

// A glossary URL that names no term is a real 404, not a soft one.
const isMissingTerm = (path) => /^\/glossary\/.+/.test(path) && !pageMeta(path);

// Rewrites the SPA shell for one request. Only the static tags emitted by
// index.html are replaced; everything else passes through untouched.
export async function withSeo(response, rawPath) {
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;
  const path = normalizePath(rawPath);
  const { head, body, root, meta } = seoHead(path);
  let html = await response.text();
  if (meta) {
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`)
      .replace(/<meta\s+property="og:(title|description|url)"\s+content="[^"]*"\s*\/?>\s*/g, '');
    if (meta.lang !== 'en') html = html.replace(/<html lang="en">/, `<html lang="${meta.lang}">`);
  }
  html = html.replace('</head>', head + '</head>').replace('<div id="root"></div>', `<div id="root">${root}</div>${body}`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  const status = isMissingTerm(path) ? 404 : response.status;
  return new Response(html, { status, statusText: status === 404 ? 'Not Found' : response.statusText, headers });
}

export function sitemapXml() {
  const urls = [...PAGES].map(([path, meta]) => `  <url><loc>${ORIGIN}${path}</loc><lastmod>${meta.lastmod || CONTENT_UPDATED}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
