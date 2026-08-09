/**
 * EvidenceDebate — bull/bear evidence without recommendation.
 *
 * Presentation of the existing debate contract from the analyze API.
 * The debate shows the evidence for and against a setup.  It never
 * adds buy/sell recommendation language — the directional stance
 * (LONG_LEAN, SHORT_LEAN, NEUTRAL) is contextual evidence only.
 *
 * @param {object} props
 * @param {object} props.debate - The debate block from analyze (bull/bear arrays).
 * @param {object} props.stance - The stance block from analyze.
 */
export default function EvidenceDebate({ debate, stance }) {
  if (!debate) return null;

  const bull = debate.bull || [];
  const bear = debate.bear || [];

  return (
    <div className="wb-debate">
      <h3 className="wb-section__title text-tertiary">What supports or challenges the setup</h3>

      {stance && (
        <div className="wb-debate__stance">
          <span className={`badge ${stance.stance === 'LONG_LEAN' ? 'badge-positive' : stance.stance === 'SHORT_LEAN' ? 'badge-negative' : 'badge-neutral'}`}>
            {stance.stance === 'LONG_LEAN' ? 'Constructive lean' : stance.stance === 'SHORT_LEAN' ? 'Defensive lean' : 'Neutral / mixed'}
          </span>
          <span className="wb-debate__stance-reason text-secondary">{stance.reason}</span>
        </div>
      )}

      <div className="wb-debate__cases">
        <div className="wb-debate__case wb-debate__case--bull">
          <div className="wb-debate__label text-positive">Supporting evidence</div>
          {bull.length > 0 ? (
            <ul className="wb-debate__points">
              {bull.map((item, i) => (
                <li key={i} className="text-secondary">
                  <span className="wb-debate__factor">{item.factor}</span>
                  <span className="text-tertiary">{item.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-tertiary">No supporting evidence</span>
          )}
        </div>

        <div className="wb-debate__case wb-debate__case--bear">
          <div className="wb-debate__label text-negative">Risks and contradictions</div>
          {bear.length > 0 ? (
            <ul className="wb-debate__points">
              {bear.map((item, i) => (
                <li key={i} className="text-secondary">
                  <span className="wb-debate__factor">{item.factor}</span>
                  <span className="text-tertiary">{item.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-tertiary">No contradictory evidence</span>
          )}
        </div>
      </div>
    </div>
  );
}
