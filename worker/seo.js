// Crawler-facing metadata for the SPA shell. The app builds every page in the
// browser, so crawlers that skip JavaScript would otherwise see one word. Each
// public route gets its own title, description, canonical, JSON-LD and a short
// <noscript> summary; unknown paths stay usable but are marked noindex.
const ORIGIN = 'https://bandarlab.site';
const ORG = { '@type': 'Organization', '@id': 'https://tombaklepas.app/#org', name: 'Tombak Lepas', url: 'https://tombaklepas.app/' };
const SITE_DESCRIPTION = 'A clearer view of the Indonesian market: an IDX stock screener, stock analysis and broker-flow research on delayed end-of-day data.';

export const SEO_ROUTES = new Map([
  ['/', {
    title: 'Bandarlab · IDX screener and broker-flow research',
    description: SITE_DESCRIPTION,
    summary: 'Bandarlab is a read-only research tool for the Indonesia Stock Exchange (IDX). It shows market breadth, foreign flow and the brokers with the largest net buying in the latest session, using delayed end-of-day data.',
  }],
  ['/radar', {
    name: 'Screener',
    title: 'IDX stock screener · Bandarlab',
    description: 'Screen IDX stocks by price action, volume and broker accumulation on delayed end-of-day data, then open any ticker for a deeper read.',
    summary: 'The Bandarlab screener filters stocks listed on the Indonesia Stock Exchange by price action, volume and broker accumulation patterns, using delayed end-of-day data.',
  }],
  ['/workbench', {
    name: 'Stock Analysis',
    title: 'IDX stock analysis · Bandarlab',
    description: 'Read a single IDX stock: price chart, technical indicators, broker activity and a plain-language summary, on delayed end-of-day data.',
    summary: 'Stock Analysis brings one IDX ticker into a single view: price chart, technical indicators, broker activity and a plain-language read, using delayed end-of-day data.',
  }],
  ['/broker-intelligence', {
    name: 'Broker Flow',
    title: 'IDX broker flow · Bandarlab',
    description: 'Track which brokers are accumulating or distributing an IDX stock across sessions, with persistence and an estimated inventory curve.',
    summary: 'Broker Flow tracks which brokers are net buying or selling an IDX stock across 1 day to multi-month windows. Broker codes aggregate many unrelated clients, so persistence is observed flow, not proof of a single bandar.',
  }],
  ['/glossary', {
    name: 'Glossary',
    title: 'IDX trading glossary · Bandarlab',
    description: 'Plain-language definitions of the Indonesian market and broker-flow terms used across Bandarlab.',
    summary: 'The Bandarlab glossary explains the Indonesian market and broker-flow terms used across the screener, stock analysis and broker flow pages.',
  }],
]);

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON-LD sits inside <script>; escape "<" so data can never close the tag.
const jsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function graphFor(path, meta) {
  const url = ORIGIN + path;
  const website = { '@type': 'WebSite', '@id': ORIGIN + '/#website', name: 'Bandarlab', url: ORIGIN + '/', inLanguage: 'en', publisher: { '@id': ORG['@id'] } };
  const app = {
    '@type': 'WebApplication', '@id': ORIGIN + '/#app', name: 'Bandarlab', url: ORIGIN + '/',
    description: SITE_DESCRIPTION, applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
    isAccessibleForFree: true, inLanguage: 'en', creator: ORG, publisher: { '@id': ORG['@id'] },
  };
  if (path === '/') return [website, app];
  return [website, {
    '@type': 'WebPage', '@id': url + '#page', url, name: meta.title, description: meta.description,
    inLanguage: 'en', isPartOf: { '@id': website['@id'] }, about: { '@id': app['@id'] },
  }, {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Bandarlab', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: meta.name, item: url },
    ],
  }];
}

export function seoHead(path) {
  const meta = SEO_ROUTES.get(path);
  if (!meta) return { head: '<meta name="robots" content="noindex">', body: '' };
  const url = ORIGIN + path;
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta name="twitter:card" content="summary">`,
    `<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': graphFor(path, meta) })}</script>`,
  ].join('');
  const links = [...SEO_ROUTES].map(([p, m]) => `<li><a href="${p}">${escapeHtml(m.name || 'Home')}</a></li>`).join('');
  const body = `<noscript><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.summary)}</p><p>Bandarlab is read-only research on delayed data. It is not investment advice or a recommendation to buy or sell (bukan ajakan jual/beli).</p><ul>${links}</ul><p>Built by <a href="https://tombaklepas.app/">Tombak Lepas</a>. Enable JavaScript to use the app.</p></noscript>`;
  return { head, body, meta };
}

// Rewrites the SPA shell for one request. Only the static tags emitted by
// index.html are replaced; everything else passes through untouched.
export async function withSeo(response, path) {
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;
  const { head, body, meta } = seoHead(path);
  let html = await response.text();
  if (meta) {
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`)
      .replace(/<meta\s+property="og:(title|description|url)"\s+content="[^"]*"\s*\/?>\s*/g, '');
  }
  html = html.replace('</head>', head + '</head>').replace('<div id="root"></div>', '<div id="root"></div>' + body);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
