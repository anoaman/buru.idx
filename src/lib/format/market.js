export { formatIDR, formatPrice, formatPct, formatNumber, formatCompact, formatShares, formatLots, formatRatio, formatDate } from './number.js';
import { formatCompact } from './number.js';

export function formatVolume(value) {
  return formatCompact(value);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The local calendar day a record belongs to.
 *
 * A bare `YYYY-MM-DD` is parsed by the platform as UTC midnight, which in WIB
 * is 07:00 that morning. Measuring age as elapsed milliseconds against that
 * therefore reported yesterday's data as "today" for anyone reading before
 * 07:00, and today's own data as "dated ahead" — the pre-open hour is exactly
 * when a stale scan matters most. Dated fields are read as the calendar day
 * they name; timestamps are reduced to the local day they fell on.
 */
function localDayStart(value) {
  const match = DATE_ONLY.exec(String(value).trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Age of a dated record, in whole calendar days, for freshness disclosure.
 *
 * Calendar days, not trading sessions: the browser has no IDX calendar and
 * inventing one here would duplicate backend logic. A record dated after `now`
 * is reported as such rather than clamped to "today", because a scan that
 * claims to be from the future is a clock or pipeline fault worth seeing.
 */
export function formatRelativeDays(value, now = Date.now()) {
  if (!value) return '—';
  const then = localDayStart(value);
  if (!then) return '—';
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rounded, not floored: day boundaries are not always exactly 24h apart.
  const days = Math.round((todayStart.getTime() - then.getTime()) / 86400000);
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
