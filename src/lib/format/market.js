export { formatIDR, formatPrice, formatPct, formatNumber, formatCompact, formatShares, formatLots, formatRatio, formatDate } from './number.js';
import { formatCompact } from './number.js';

export function formatVolume(value) {
  return formatCompact(value);
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
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((now - then.getTime()) / 86400000);
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
