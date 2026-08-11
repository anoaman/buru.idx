import { formatPrice, formatPct } from '../../lib/format/market.js';
import InfoTip from '../../components/InfoTip.jsx';

/**
 * DynamicLevels — MA5/10/20/50/200 read as support and resistance.
 *
 * Deliberately its own panel rather than extra rows in the risk and level map.
 * A pivot is a price the market has already defended and it stays where it is;
 * a moving average moves every session, so a level that was support on Friday
 * can be resistance on Monday without a single trade going through it. Merging
 * them into one list would make the map look more certain than it is.
 *
 * Presentation only. Every number here comes from the analyze contract.
 */

const ROLE_CLASS = {
  support: 'text-positive',
  resistance: 'text-negative',
  'at price': 'text-warning',
};

const SLOPE_LABEL = {
  rising: '↑ rising',
  falling: '↓ falling',
  flat: '→ flat',
  unknown: 'slope unknown',
};

function LevelRow({ level }) {
  const confluent = level.confluence?.length > 0;
  return (
    <tr className="wb-dyn__row">
      <th scope="row" className="wb-dyn__label">
        {level.label}
        {confluent && (
          <span
            className="badge badge-positive wb-dyn__confluence"
            title={`A pivot level sits within 1.5% of this average: ${level.confluence
              .map((c) => `${formatPrice(c.price)} (${c.touches} touches)`)
              .join(', ')}. One price, defended twice.`}
          >
            confluence
          </span>
        )}
      </th>
      <td className={`tabular ${ROLE_CLASS[level.role] || 'text-secondary'}`}>
        {formatPrice(level.price)}
      </td>
      <td className={ROLE_CLASS[level.role] || 'text-secondary'}>{level.role}</td>
      <td className="tabular text-secondary">{formatPct(level.distancePct)}</td>
      <td className="text-tertiary">
        {SLOPE_LABEL[level.slope] || level.slope}
        {level.converging && (
          <span className="wb-dyn__converging" title="This average is moving toward price. The gap closes even if price does not move.">
            {' '}· closing
          </span>
        )}
      </td>
    </tr>
  );
}

export default function DynamicLevels({ dynamicLevels }) {
  if (!dynamicLevels) return null;

  const { levels = [], unavailable = [], available } = dynamicLevels;

  return (
    <div className="wb-dyn">
      <h3 className="wb-section__title text-tertiary">
        Dynamic levels (moving averages){' '}
        <InfoTip title="Dynamic levels">
          MA5, MA10, MA20, MA50 and MA200 of the daily close, shown as support when they sit below price
          and resistance when they sit above it. Distance is the gap to the last close.
          Slope is the average daily change over the last 5 trading days; under 0.05% per
          day it reads flat. &quot;Closing&quot; means the average is travelling toward
          price (a rising support or a falling resistance), so the gap narrows even on a flat
          day. &quot;Confluence&quot; marks an average sitting within 1.5% of a static pivot
          from the level map. These are kept separate from pivot levels because they move:
          the same average can change sides without any trade occurring at it. Descriptive
          geometry, not a signal or a win probability.
        </InfoTip>
      </h3>

      {available ? (
        <table className="wb-dyn__table">
          <thead>
            <tr className="text-tertiary">
              <th scope="col">Average</th>
              <th scope="col">Price</th>
              <th scope="col">Acting as</th>
              <th scope="col">Distance</th>
              <th scope="col">Direction</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <LevelRow key={level.label} level={level} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-tertiary wb-dyn__empty">
          {dynamicLevels.reason || 'Moving-average levels are unavailable.'}
        </p>
      )}

      {unavailable.length > 0 && (
        <p className="text-tertiary wb-dyn__note">
          {unavailable
            .map((u) => `${u.label} needs ${u.sessionsRequired} sessions, ${u.sessionsAvailable} available`)
            .join(' · ')}
          . Not estimated from a shorter window.
        </p>
      )}
    </div>
  );
}
