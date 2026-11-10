import { BrandCandle } from './BrandMark.jsx';

/**
 * Brand watermark: one faint candle + bandarlab.site centred over the content
 * area. Screenshots can't be detected from a web page, so it is always on. It
 * sits in the shell's non-scrolling main column, so it stays centred on screen
 * while the page scrolls under it; pointer events are off. Screener only
 * (Kibz, 2026-11-10).
 */
export default function Watermark() {
  return (
    <div className="watermark" aria-hidden="true">
      <span className="watermark__mark">
        <BrandCandle />
        <span>bandarlab.site</span>
      </span>
    </div>
  );
}
