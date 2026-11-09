// GA4 for the public site only. The private cockpit, staging and the legacy
// handoff host never load the tag. Page views are sent on every router
// navigation because the SPA never reloads; gtag's automatic one is disabled.
export const GA_MEASUREMENT_ID = 'G-5NTTFZRE01';
export const ANALYTICS_HOST = 'bandarlab.site';

let started = false;
let lastPage = null;

export function analyticsEnabled(host = window.location.hostname) {
  return host === ANALYTICS_HOST;
}

function gtag() {
  window.dataLayer.push(arguments);
}

export function startAnalytics() {
  if (started || !analyticsEnabled()) return false;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  return true;
}

export function trackPageView(pathname, search = '') {
  if (!started) return false;
  const page = pathname + search;
  if (page === lastPage) return false;
  lastPage = page;
  gtag('event', 'page_view', {
    page_location: window.location.origin + page,
    page_title: document.title,
  });
  return true;
}

export function resetAnalyticsForTest() {
  started = false;
  lastPage = null;
}
