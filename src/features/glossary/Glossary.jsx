const TERMS = [
  ['Evidence', 'The official filing line, page, or disclosure that supports a displayed claim.'],
  ['Comparative period', 'The prior reporting column printed beside the current period in the same filing.'],
  ['Cash quality', 'How closely reported profit is supported by operating cash flow.'],
  ['Material disclosure', 'Information reasonably capable of changing an investor’s assessment of the company.'],
  ['Suppressed', 'Preserved in All disclosures, but removed from the ranked digest because it is routine or administrative.'],
  ['Deep parse', 'Reading extracted attachment text after metadata classification. Routine filings are not deep-parsed.'],
  ['Official source', 'An IDX HTTPS URL for the original announcement or filing. Local file paths are never shown.'],
  ['Company type', 'Parser path for the issuer: common, bank, insurance, or multifinance. Bank ratios are not forced onto ordinary companies.'],
  ['Derived metric', 'A ratio computed from extracted facts. Unavailable when an input is missing, mixed across periods, or the denominator is not positive.'],
  ['News Detector scan', 'An on-demand selected-date job. Repeating the same date and rule version overwrites the previous run rather than duplicating it.'],
];

export default function Glossary() {
  return (
    <div className="glossary-page" data-testid="glossary-page">
      <h2>Glossary</h2>
      <dl>
        {TERMS.map(([term, meaning]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
