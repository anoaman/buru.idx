export { formatIDR, formatPrice, formatPct, formatNumber, formatCompact, formatShares, formatLots, formatRatio, formatDate } from './number.js';
import { formatCompact } from './number.js';

export function formatVolume(value) {
  return formatCompact(value);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MARKET_TZ = 'Asia/Jakarta';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MARKET_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day key (YYYY-MM-DD) in the IDX market timezone. */
function marketDayKey(value) {
  const match = DATE_ONLY.exec(String(value).trim());
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return dayFormatter.format(parsed);
}

/**
 * Age of a dated record, in whole calendar days, for freshness disclosure.
 *
 * Calendar days are measured in Asia/Jakarta (WIB), not the browser's local
 * zone: IDX disclosures must not flip with the operator's laptop timezone, and
 * UTC CI hosts would otherwise disagree with desk machines in Indonesia.
 *
 * Calendar days, not trading sessions: the browser has no IDX calendar and
 * inventing one here would duplicate backend logic. A record dated after `now`
 * is reported as such rather than clamped to "today", because a scan that
 * claims to be from the future is a clock or pipeline fault worth seeing.
 */
export function formatRelativeDays(value, now = Date.now()) {
  if (!value) return '—';
  const thenKey = marketDayKey(value);
  if (!thenKey) return '—';
  const todayKey = marketDayKey(now);
  if (!todayKey) return '—';
  const then = new Date(`${thenKey}T00:00:00+07:00`);
  const today = new Date(`${todayKey}T00:00:00+07:00`);
  const days = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (days < 0) return 'dated ahead';
  if (days === 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'var(--color-positive)';
    case 'B': return '#81c995';
    case 'C': return 'var(--color-warning)';
    case 'D': return '#f28b82';
    case 'F': return 'var(--color-negative)';
    default: return 'var(--text-tertiary)';
  }
}
