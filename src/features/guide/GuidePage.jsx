import ContentPage from '../../components/ContentPage.jsx';
import { GUIDE_BY_PATH } from '../../content/guides.js';

// Renders one of the Indonesian guide pages (Cara kerja, Metodologi).
export default function GuidePage({ path }) {
  const guide = GUIDE_BY_PATH.get(path);
  return (
    <ContentPage testId="guide-page">
      <header className="content-page__head">
        <h1>{guide.title}</h1>
        <p className="content-page__lead">{guide.lead}</p>
      </header>
      {guide.sections.map((section) => (
        <section key={section.heading} className="content-page__section">
          <h2>{section.heading}</h2>
          {(section.paragraphs || []).map((text) => <p key={text}>{text}</p>)}
          {section.items && (
            <dl className="content-page__defs">
              {section.items.map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </ContentPage>
  );
}
