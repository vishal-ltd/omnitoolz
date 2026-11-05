import type { IconName } from "@/lib/tools/types";
import { PIXEL_GLYPHS } from "./pixel-glyphs";

/**
 * Tool and category plates draw pixel art, not anti-aliased strokes — the one
 * element that used to refuse the rest of the world it sits in. Glyphs come
 * from pixel-glyphs.ts; regenerate that file rather than editing shapes.
 */
function toRuns(rows: string[]): Array<[number, number, number]> {
  const runs: Array<[number, number, number]> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === "#") end += 1;
      runs.push([x, y, end - x]);
      x = end;
    }
  });
  return runs;
}

const RUNS = new Map(Object.entries(PIXEL_GLYPHS).map(([key, rows]) => [key, toRuns(rows)]));

export function ToolIcon({ name, className }: { name: IconName; className?: string }) {
  const runs = RUNS.get(name) ?? [];
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor" shapeRendering="crispEdges">
      {runs.map(([x, y, width]) => (
        <rect key={`${x}-${y}-${width}`} x={x} y={y} width={width} height={1} />
      ))}
    </svg>
  );
}
