import { CONTACT_EMAIL } from '../../content/routes.js';

const mailto = (subject) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

// English on purpose (Kibz, 2026-11-12), so it is an app page, not one of the
// Indonesian content pages that ContentPage frames.
export default function Contact() {
  return (
    <article className="content-page" data-testid="contact-page">
      <header className="content-page__head">
        <h1>Contact</h1>
        <p className="content-page__lead">Suggest a feature, report data that looks wrong, or just say hello.</p>
      </header>
      <aside className="content-page__note">
        <p><strong>One person, free of charge.</strong> Bandarlab is free and built by one person in their spare time. Replies can be slow, data sometimes updates late, and not every feature request will get built. Thanks for your patience.</p>
      </aside>
      <p><a className="content-page__cta" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      <section className="content-page__section">
        <h2>Suggesting a feature</h2>
        <p>Tell me what you were trying to do and where Bandarlab got in the way. A screenshot helps. <a href={mailto('Feature suggestion')}>Email a suggestion</a>.</p>
      </section>
      <section className="content-page__section">
        <h2>Reporting wrong data</h2>
        <p>Include the ticker, the date, the page you were on, and the figure you expected, with its source if you have one. <a href={mailto('Data report')}>Email a data report</a>.</p>
      </section>
      <section className="content-page__section">
        <h2>What I can't help with</h2>
        <p>Bandarlab is read-only research on delayed data. I can't give buy or sell advice or comment on your positions.</p>
      </section>
    </article>
  );
}
