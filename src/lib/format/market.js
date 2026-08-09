export { formatIDR, formatPrice, formatPct, formatNumber, formatCompact, formatShares, formatLots, formatRatio, formatDate } from './number.js';
import { formatCompact } from './number.js';

export function formatVolume(value) {
  return formatCompact(value);
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
