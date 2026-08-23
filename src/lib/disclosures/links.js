import { officialSourceUrl } from './serialize.js';

export function officialSourceHref(url) {
  return officialSourceUrl(url) || '';
}

export function evidenceSnippet(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return '';
  const snippet = evidence.snippet ?? evidence.text ?? evidence.quote ?? '';
  return String(snippet).trim();
}

export function evidencePage(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null;
  const page = evidence.page ?? evidence.pageNumber;
  if (page == null || page === '') return null;
  const number = Number(page);
  return Number.isFinite(number) ? number : String(page);
}
