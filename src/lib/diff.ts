/** Line diff via classic LCS — pure, no DOM. */

export type DiffOp = { type: "same" | "add" | "remove"; text: string };

/**
 * Diff two texts line by line. Added lines come from `b`, removed from `a`.
 * Runs in O(a·b) memory — fine for documents of a few thousand lines.
 */
export function diffLines(aText: string, bText: string): DiffOp[] {
  const a = aText === "" ? [] : aText.split("\n");
  const b = bText === "" ? [] : bText.split("\n");

  // LCS table
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += "\n" + text;
    else ops.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("remove", a[i]);
      i++;
    } else {
      push("add", b[j]);
      j++;
    }
  }
  while (i < a.length) push("remove", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return ops;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(ops: DiffOp[]): DiffStats {
  return ops.reduce(
    (stats, op) => {
      const lines = op.text.split("\n").length;
      if (op.type === "add") stats.added += lines;
      else if (op.type === "remove") stats.removed += lines;
      else stats.unchanged += lines;
      return stats;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );
}
