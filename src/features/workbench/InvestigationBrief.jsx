function Question({ question }) {
  if (!question) return null;
  return (
    <section className="inv-question">
      <span className="inv-kicker">CURRENT MARKET QUESTION · {question.code}</span>
      <h2>{question.title}</h2>
      <p>{question.detail}</p>
      {question.method && <small className="inv-question__method">{question.method}</small>}
    </section>
  );
}

export default function InvestigationBrief({ investigation }) {
  if (!investigation) return null;
  const timeline = investigation.timeline || [];
  const contradictions = investigation.contradictions || [];
  return (
    <div className="inv-brief">
      <Question question={investigation.question} />
      <div className="inv-brief__grid">
        <section className="inv-timeline" aria-labelledby="timeline-title">
          <div className="inv-section-head">
            <span>01</span>
            <h3 id="timeline-title">Setup timeline</h3>
          </div>
          <ol>
            {timeline.map((event, index) => (
              <li key={`${event.date}-${event.type}-${index}`}>
                <time>{event.date}</time>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="inv-contradictions" aria-labelledby="contradiction-title">
          <div className="inv-section-head">
            <span>02</span>
            <h3 id="contradiction-title">Contradiction map</h3>
          </div>
          <div className="inv-contradictions__list">
            {contradictions.map((item, index) => (
              <article key={item.code}>
                <span>{item.code}</span>
                {index > 0 && <small>Also observed</small>}
                <strong>{item.title}</strong>
                <ul>
                  {(item.evidence || []).map((evidence) => <li key={evidence}>{evidence}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
