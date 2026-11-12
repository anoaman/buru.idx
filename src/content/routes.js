// Route facts the app shell needs on every page: titles for the app routes
// and which paths are Indonesian content pages. Kept separate from the
// glossary text so the main bundle stays small; content pages set their own
// title via ContentPage.
export const SITE_DESCRIPTION = 'A clearer view of the Indonesian market: an IDX stock screener, stock analysis and broker-flow research on delayed end-of-day data.';

export const APP_PAGES = new Map([
  ['/', {
    name: 'Home',
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
  ['/contact', {
    name: 'Contact',
    title: 'Contact · Bandarlab',
    description: 'Suggest a feature or report wrong data. Bandarlab is free and built by one person, so replies can be slow.',
    summary: 'Suggest a feature or report wrong data at hello@bandarlab.site. Bandarlab is free and built by one person in their spare time, so replies can be slow.',
  }],
]);

export const CONTACT_EMAIL = 'hello@bandarlab.site';

export const GUIDE_LABELS = new Map([
  ['/cara-kerja', 'How it works'],
  ['/metodologi', 'Methodology'],
]);

// "/glossary/" and "/glossary" are the same page.
export const normalizePath = (path) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

export const isContentPath = (path) => {
  const normalized = normalizePath(path);
  return normalized === '/glossary' || normalized.startsWith('/glossary/') || GUIDE_LABELS.has(normalized);
};
