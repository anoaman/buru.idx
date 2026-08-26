import { useEffect, useState } from 'react';
import { getDataHealth } from '../lib/api/client.js';
import { guardDataHealth } from '../lib/api/contracts.js';
import { formatDate } from '../lib/format/market.js';

/**
 * How old the data under this screen actually is.
 *
 * Every surface in NALAR reads delayed end-of-day data, which is fine, but
 * "delayed" is not a number. A screen scoring on a nine-session-old broker cache
 * looks exactly like one scoring on yesterday's, and the difference decides
 * whether a result is worth acting on. The API has reported this all along under
 * /api/data-health; nothing rendered it.
 *
 * Silent when the caches are current, because a banner that is always on is a
 * banner nobody reads.
 */
export default function FreshnessBar() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDataHealth()
      .then((raw) => {
        if (cancelled) return;
        const result = guardDataHealth(raw);
        setHealth(result.ok ? result.data : null);
      })
      .catch(() => {
        // A freshness indicator that breaks the app when it cannot load is worse
        // than no indicator. Stay quiet and let the surfaces render.
        if (!cancelled) setHealth(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!health) return null;

  const behind = health.worstSessionsBehind;
  if (!Number.isFinite(behind) || behind <= 1) return null;

  const tone = behind >= 5 ? 'is-critical' : 'is-warning';
  const oldest = [health.priceCache, health.brokerCache]
    .filter((entry) => entry.lastDate)
    .sort((a, b) => String(a.lastDate).localeCompare(String(b.lastDate)))[0];

  return (
    <div className={`freshness-bar ${tone}`} role="status">
      <strong>{behind} sessions behind</strong>
      <span>
        Oldest input {oldest?.lastDate ? formatDate(oldest.lastDate) : 'unknown'}
        {health.lastCompletedSession ? ` · last IDX session ${formatDate(health.lastCompletedSession)}` : ''}
      </span>
      <span className="freshness-bar__note">Scores and screens reflect that date, not today.</span>
    </div>
  );
}
