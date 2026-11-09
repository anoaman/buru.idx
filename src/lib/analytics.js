// GA4 for the public site only. The private cockpit, staging and the legacy
// handoff host never load the tag. SPA navigations are counted by the GA
// stream's Enhanced measurement (browser history events), so no manual
// page_view calls: adding them double-counts every route change.
export const GA_MEASUREMENT_ID = 'G-5NTTFZRE01';
export const ANALYTICS_HOST = 'bandarlab.site';

let started = false;

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
  gtag('config', GA_MEASUREMENT_ID);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  return true;
}

export function resetAnalyticsForTest() {
  started = false;
}
