import { useState } from 'react';

export default function InfoTip({ title, children }) {
  const [active, setActive] = useState(false);
  return (
    <button type="button" className={`tip-trigger${active ? ' active' : ''}`} aria-label={`Explain ${title}`} aria-expanded={active} onClick={() => setActive(!active)} onBlur={() => setActive(false)}>
      ?
      <span className={`tip-popover${active ? ' visible' : ''}`} role="tooltip">
        <span className="tp-title">{title}</span>
        <span className="tp-def">{children}</span>
      </span>
    </button>
  );
}
