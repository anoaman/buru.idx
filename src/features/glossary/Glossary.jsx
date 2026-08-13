import { GLOSSARY_GROUPS } from '../../lib/copy/terms.js';

export default function Glossary() {
  return (
    <section className="glossary-page" aria-labelledby="glossary-title">
      <header className="module-heading">
        <div><h2 id="glossary-title">Glossary</h2></div>
        <p>
          Study room for the words this workstation uses. Nothing here is live
          analysis, and nothing here is a recommendation.
        </p>
      </header>
      {GLOSSARY_GROUPS.map((group) => (
        <section key={group.id} className="glossary-group" aria-labelledby={`glossary-${group.id}`}>
          <h3 id={`glossary-${group.id}`}>{group.title}</h3>
          <dl>
            {group.entries.map((entry) => (
              <div key={entry.id} id={entry.id} className="glossary-entry">
                <dt>{entry.title}</dt>
                <dd>{entry.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}
