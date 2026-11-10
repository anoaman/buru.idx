import { useEffect, useRef, useState } from 'react';
import { BrandCandle } from './BrandMark.jsx';

// One centred mark per ~700px of panel height, so a crop of any stretch of a
// long table still carries one; a short panel gets exactly one, dead centre.
const SPACING = 700;

/**
 * Brand watermark for a panel: a faint centred candle + bandarlab.site, and a
 * small signature in the bottom-right corner. Screenshots can't be detected
 * from a web page, so the mark is always on. It sits above the content with
 * pointer events off; the parent needs `has-watermark` (position: relative).
 * `sign={false}` drops the corner signature on strips too short to hold it.
 */
export default function Watermark({ sign = true }) {
  const ref = useRef(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setCount(Math.max(1, Math.round(entry.contentRect.height / SPACING)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="watermark" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="watermark__mark">
          <BrandCandle />
          <span>bandarlab.site</span>
        </span>
      ))}
      {sign && <span className="watermark__sign"><BrandCandle />bandarlab.site</span>}
    </div>
  );
}
