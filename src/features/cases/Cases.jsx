import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

export default function Cases() {
  const { ticker, openInvestigation } = useAnalysisContext();
  return (
    <section className="phase-foundation" aria-labelledby="cases-title">
      <span className="phase-foundation__index">MODULE 04</span>
      <h2 id="cases-title">Cases foundation is active.</h2>
      <p>
        Frozen evidence, thesis, trigger, and invalidation migrate here in Phase 4. Existing
        cockpit records remain untouched in the canonical database until this workflow is verified.
      </p>
      <div className="phase-foundation__actions">
        <button type="button" onClick={() => openInvestigation(ticker)}>Return to {ticker}</button>
      </div>
    </section>
  );
}
