import type { IconName } from "@/lib/tools/types";
import { PIXEL_GLYPHS } from "./pixel-glyphs";

/**
 * Tool and category plates draw pixel art, not anti-aliased strokes — the one
 * element that used to refuse the rest of the world it sits in. Tool glyphs come
 * from pixel-glyphs.ts (regenerate that file rather than editing shapes); the
 * interface glyphs below are hand-drawn because they belong to the chrome.
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

export type UiGlyph = "chevron" | "close";

const UI_GLYPHS: Record<UiGlyph, string[]> = {
  chevron: [
    "................",
    "................",
    "................",
    "................",
    "......#.........",
    "......##........",
    "......###.......",
    "......####......",
    "......#####.....",
    "......####......",
    "......###.......",
    "......##........",
    "......#.........",
    "................",
    "................",
    "................",
  ],
  close: [
    "................",
    "................",
    "................",
    "................",
    "....#.......#...",
    ".....#.....#....",
    "......#...#.....",
    ".......#.#......",
    "........#.......",
    ".......#.#......",
    "......#...#.....",
    ".....#.....#....",
    "....#.......#...",
    "................",
    "................",
    "................",
  ],
};

const RUNS = new Map(
  [...Object.entries(PIXEL_GLYPHS), ...Object.entries(UI_GLYPHS)].map(([key, rows]) => [key, toRuns(rows)]),
);

function Glyph({ name, className }: { name: string; className?: string }) {
  const runs = RUNS.get(name) ?? [];
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor" shapeRendering="crispEdges">
      {runs.map(([x, y, width]) => (
        <rect key={`${x}-${y}-${width}`} x={x} y={y} width={width} height={1} />
      ))}
    </svg>
  );
}

/** Tool and category art. Size on the 8px grid only (16, 24, 32) so it stays crisp. */
export function ToolIcon({ name, className }: { name: IconName; className?: string }) {
  return <Glyph name={name} className={className} />;
}

/** Interface marks: arrows and close. Never below 16px, or the pixels smear. */
export function PixelIcon({ name, className }: { name: UiGlyph; className?: string }) {
  return <Glyph name={name} className={className} />;
}

export type ChromeName =
  | "search" | "menu" | "close" | "sun" | "moon" | "monitor" | "upload"
  | "alert" | "check" | "download" | "eye" | "sparkles"
  | "arrow-up" | "arrow-down" | "shield" | "laptop" | "zap" | "restart";

/** Controls and status marks, drawn from the same bitmap grid as the tool art. */
export function ChromeIcon({ name, className }: { name: ChromeName; className?: string }) {
  return <Glyph name={name} className={className} />;
}
