import { useAnalysisContext } from '../../components/AnalysisContext.jsx';

export default function Radar() {
  const { ticker, openInvestigation, openBrokerMap } = useAnalysisContext();
  return (
    <section className="phase-foundation" aria-labelledby="radar-title">
      <span className="phase-foundation__index">MODULE 01</span>
      <h2 id="radar-title">Radar foundation is active.</h2>
      <p>
        Qualified setups and broker anomalies will land here in Phase 4. The scanner remains
        canonical in the private backend; this route does not duplicate or manufacture signals.
      </p>
      <div className="phase-foundation__actions">
        <button type="button" onClick={() => openInvestigation(ticker)}>Investigate {ticker}</button>
        <button type="button" onClick={() => openBrokerMap(ticker)}>Open {ticker} Broker Map</button>
      </div>
    </section>
  );
}
