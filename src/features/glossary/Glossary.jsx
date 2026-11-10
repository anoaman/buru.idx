import { Link, useParams } from 'react-router';
import ContentPage from '../../components/ContentPage.jsx';
import { CATEGORIES, TERMS, TERM_BY_SLUG, termPath } from '../../content/glossary.js';

export default function Glossary() {
  return (
    <ContentPage testId="glossary-page">
      <header className="content-page__head">
        <h1>Kamus istilah saham dan bandarmologi</h1>
        <p>Istilah yang dipakai di Bandarlab, dijelaskan dalam bahasa sederhana beserta cara membacanya di Home, Screener, Stock Analysis dan Broker Flow.</p>
      </header>
      {CATEGORIES.map((category) => (
        <section key={category.id} className="content-page__section">
          <h2>{category.label}</h2>
          <dl className="glossary-list">
            {TERMS.filter((term) => term.category === category.id).map((term) => (
              <div key={term.slug}>
                <dt><Link to={termPath(term.slug)}>{term.term}</Link></dt>
                <dd>{term.short}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </ContentPage>
  );
}

export function GlossaryTerm() {
  const { slug } = useParams();
  const term = TERM_BY_SLUG.get(slug);
  if (!term) {
    return (
      <ContentPage testId="glossary-term">
        <h1>Istilah tidak ditemukan</h1>
        <p><Link to="/glossary">Lihat semua istilah di Glossary</Link></p>
      </ContentPage>
    );
  }
  const related = term.related.map((key) => TERM_BY_SLUG.get(key)).filter(Boolean);
  return (
    <ContentPage testId="glossary-term">
      <p className="content-page__crumb"><Link to="/glossary">Glossary</Link></p>
      <header className="content-page__head">
        <h1>{term.term}</h1>
        <p className="content-page__lead">{term.short}</p>
        {term.en && <p className="content-page__alias">Istilah di aplikasi: {term.en}.</p>}
      </header>
      {term.body.map((text) => <p key={text}>{text}</p>)}
      <section className="content-page__section">
        <h2>Di Bandarlab</h2>
        <p>{term.inApp}</p>
        {term.tool && <p><Link className="content-page__cta" to={term.tool.path}>{term.tool.label}</Link></p>}
      </section>
      {related.length > 0 && (
        <section className="content-page__section">
          <h2>Istilah terkait</h2>
          <ul className="content-page__related">
            {related.map((item) => <li key={item.slug}><Link to={termPath(item.slug)}>{item.term}</Link></li>)}
          </ul>
        </section>
      )}
    </ContentPage>
  );
}
