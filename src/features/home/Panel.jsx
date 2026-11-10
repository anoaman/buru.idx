import Watermark from '../../components/Watermark.jsx';

/** A Home panel: title, optional note and header actions, content below. */
export default function Panel({ title, note, actions = null, children, className = '' }) {
  return (
    <section className={`home-panel has-watermark ${className}`} aria-label={title}>
      <header className="home-panel__head">
        <h3>{title}</h3>
        {note && <span className="home-panel__note">{note}</span>}
        {actions}
      </header>
      {children}
      <Watermark />
    </section>
  );
}
