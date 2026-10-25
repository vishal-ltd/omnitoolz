/**
 * Pixel "power core" mark drawn from 2px rect blocks with crispEdges —
 * the box-shadow-pixel-art technique from NES.css, in SVG form. Colors ride
 * on CSS variables so the logo re-themes with light/dark automatically.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden shapeRendering="crispEdges">
      {/* tile */}
      <rect x="0" y="0" width="16" height="16" fill="var(--color-edge)" />
      <rect x="2" y="2" width="12" height="12" fill="var(--color-brand)" />
      {/* pixel ring (8 blocks, corners cut for an octagon "O") */}
      <g fill="#ffffff">
        <rect x="4" y="6" width="2" height="2" />
        <rect x="4" y="8" width="2" height="2" />
        <rect x="10" y="6" width="2" height="2" />
        <rect x="10" y="8" width="2" height="2" />
        <rect x="6" y="4" width="2" height="2" />
        <rect x="8" y="4" width="2" height="2" />
        <rect x="6" y="10" width="2" height="2" />
        <rect x="8" y="10" width="2" height="2" />
      </g>
      {/* core */}
      <rect x="6" y="6" width="4" height="4" fill="var(--color-gold)" />
      {/* corner sparkle on the border */}
      <rect x="13" y="1" width="2" height="2" fill="var(--color-gold)" />
    </svg>
  );
}
