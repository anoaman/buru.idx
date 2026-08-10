import { useMemo, useState } from 'react';

const PERIODS = Object.freeze([
  { value: 5, label: '1W' },
  { value: 22, label: '1M' },
]);

export default function InvestigationBrief({ investigation }) {
  const [period, setPeriod] = useState(5);
  const timeline = useMemo(() => (investigation?.timeline || [])
    .filter((event) => !Number.isFinite(event.sessionsAgo) || event.sessionsAgo < period), [investigation, period]);

  if (!investigation) return null;
  return (
    <section className="inv-timeline inv-timeline--primary" aria-labelledby="timeline-title">
      <div className="inv-section-head inv-section-head--timeline">
        <div><span>01</span><h3 id="timeline-title">Setup timeline</h3></div>
        <div className="inv-periods" aria-label="Timeline period">
          {PERIODS.map((item) => (
            <button
              className={period === item.value ? 'is-active' : ''}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >{item.label}</button>
          ))}
        </div>
      </div>
      <p className="inv-timeline__intro">Material price, volume, moving-average, and broker-flow changes in the selected period.</p>
      {timeline.length ? (
        <ol>
          {timeline.map((event, index) => (
            <li key={`${event.date}-${event.type}-${index}`}>
              <time>{event.date}</time>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
            </li>
          ))}
        </ol>
      ) : <p className="inv-timeline__empty">No material setup change was detected in this period.</p>}
    </section>
  );
}
