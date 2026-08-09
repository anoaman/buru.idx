/**
 * Canonical module ID: trading-surface-number-format/v1.
 * Keep every copy of this file byte-identical across the three trading surfaces.
 */
const unavailable = '—';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatNumber(value, decimals = 0) {
  if (!finite(value)) return unavailable;
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(value, decimals = 1) {
  if (!finite(value)) return unavailable;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  const unit = units.find(([threshold]) => abs >= threshold);
  if (!unit) return formatNumber(value);
  const scaled = abs / unit[0];
  const precision = scaled >= 100 ? 0 : scaled >= 10 ? Math.min(decimals, 1) : decimals;
  return `${sign}${scaled.toFixed(precision)}${unit[1]}`;
}

export function formatIDR(value, compact = false) {
  if (!finite(value)) return unavailable;
  if (compact) return `${value < 0 ? '-' : ''}Rp${formatCompact(Math.abs(value))}`;
  return `${value < 0 ? '-' : ''}Rp${formatNumber(Math.round(Math.abs(value)))}`;
}

export function formatPrice(value) {
  return finite(value) ? formatNumber(value) : unavailable;
}

export function formatPct(value, decimals = 2, showSign = true) {
  if (!finite(value)) return unavailable;
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatShares(value) {
  return finite(value) ? `${formatCompact(value)} shares` : unavailable;
}

export function formatLots(value) {
  return finite(value) ? `${formatNumber(value)} lots` : unavailable;
}

export function formatRatio(value, decimals = 2) {
  return finite(value) ? `${value.toFixed(decimals)}x` : unavailable;
}

export function formatDate(value) {
  if (!value) return unavailable;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unavailable;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
