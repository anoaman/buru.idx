import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { pageMeta } from '../content/seo.js';

// Frame for the Indonesian reading pages (glossary, terms, guides). Sets the
// tab title and document language from the page registry (the shell leaves
// both alone on these routes), and ends with the same footer the Worker
// serves to crawlers in worker/seo.js.
export default function ContentPage({ testId, children }) {
  const { pathname } = useLocation();
  const meta = pageMeta(pathname);

  useEffect(() => {
    document.title = meta ? meta.title : 'Glossary · Bandarlab';
    document.documentElement.lang = 'id';
  }, [meta]);

  return (
    <article className="content-page" lang="id" data-testid={testId}>
      {children}
      <footer className="content-page__foot">
        <p>Bandarlab hanya membaca data tertunda. Isinya bukan rekomendasi investasi atau ajakan jual/beli.</p>
        <p>
          <Link to="/cara-kerja">Cara kerja</Link> · <Link to="/metodologi">Metodologi</Link> · <Link to="/glossary">Glossary</Link>
          {' · '}Dibuat oleh <a href="https://tombaklepas.app/">Tombak Lepas</a>
        </p>
      </footer>
    </article>
  );
}

// Highlighted statement under a page's header (mirrored as <aside> in worker/seo.js).
export function ContentNote({ note }) {
  return (
    <aside className="content-page__note">
      <p><strong>{note.title}</strong> {note.text}</p>
    </aside>
  );
}
