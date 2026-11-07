import { liveTools } from "./tools/registry";
import type { ToolWithRoute } from "./tools/types";

/**
 * Client-side search over the tool registry. Scoring is deliberately simple and
 * predictable: name > keyword > category > description. Every query word must
 * match something — directly or through SYNONYMS — so a query either answers or
 * returns nothing, never a wall of near-misses.
 */

export interface SearchHit extends ToolWithRoute {
  score: number;
}

/**
 * The words people type, mapped onto the words the catalogue uses. Without
 * this, "resize photo" returned nothing at all — no tool says "photo".
 */
const SYNONYMS: Record<string, string[]> = {
  photo: ["image", "jpg", "heic"],
  photos: ["image", "jpg", "heic"],
  picture: ["image", "jpg", "png"],
  pictures: ["image", "jpg", "png"],
  shrink: ["compress", "resize"],
  smaller: ["compress", "resize"],
  reduce: ["compress", "resize"],
  optimise: ["compress"],
  optimize: ["compress"],
  combine: ["merge", "join"],
  join: ["merge", "combine"],
  cut: ["crop", "split", "trim"],
  turn: ["rotate"],
  twist: ["rotate"],
  lock: ["protect", "password"],
  secure: ["protect", "password"],
  erase: ["remove", "background"],
  strip: ["remove", "clean"],
  delete: ["remove"],
  removed: ["remove"],
  signature: ["sign"],
  signed: ["sign"],
  scan: ["scanner", "ocr"],
  count: ["counter"],
  compare: ["diff"],
  make: ["generate", "generator"],
  create: ["generate", "generator"],
  change: ["case", "convert"],
  check: ["verify", "auditor"],
  verify: ["check", "auditor"],
  info: ["information"],
  document: ["file", "pdf", "word"],
  documents: ["file", "pdf", "word"],
  spreadsheet: ["excel"],
  slides: ["powerpoint", "pptx"],
};

/** Words that mean nothing on their own but often pad a real query. */
const STOP_WORDS = new Set([
  "a", "an", "the", "my", "to", "for", "of", "and", "in", "on", "with",
  "make", "makes", "create", "creates", "get", "need", "want", "how", "do", "i", "can",
  "one", "two", "three", "four", "five", "some", "it", "this", "that",
]);

const SYNONYM_WEIGHT = 0.55;

export function searchTools(query: string, limit = 8): SearchHit[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !STOP_WORDS.has(term));
  if (query.trim().length < 2 || terms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const tool of liveTools()) {
    const fields = [
      { text: tool.name.toLowerCase(), weight: 8 },
      { text: tool.keywords.join(" ").toLowerCase(), weight: 5 },
      { text: tool.categoryName.toLowerCase(), weight: 4 },
      { text: tool.description.toLowerCase(), weight: 3 },
    ];

    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      const direct = bestFieldScore(fields, term);
      const synonyms = SYNONYMS[term] ?? [];
      const viaSynonym = synonyms.reduce(
        (best, word) => Math.max(best, bestFieldScore(fields, word) * SYNONYM_WEIGHT),
        0,
      );
      const termScore = Math.max(direct, viaSynonym);
      if (termScore === 0) {
        matchedAll = false;
        break;
      }
      score += termScore;
    }

    if (matchedAll) hits.push({ ...tool, score });
  }

  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

function bestFieldScore(
  fields: Array<{ text: string; weight: number }>,
  term: string,
): number {
  const forms = [term];
  const singular = singularize(term);
  if (singular !== term) forms.push(singular);

  let best = 0;
  for (const { text, weight } of fields) {
    for (const form of forms) {
      const score =
        text === form ? weight * 4 : wordStartIndex(text, form) !== -1 ? weight * 2 : text.includes(form) ? weight : 0;
      if (score > best) best = score;
    }
  }
  return best;
}

/** Cheap plural handling so "combine pdfs" reaches "Merge PDF". */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** indexOf with a word-boundary check — no RegExp, so user input can't blow it up. */
function wordStartIndex(text: string, term: string): number {
  let from = 0;
  while (from <= text.length - term.length) {
    const index = text.indexOf(term, from);
    if (index === -1) return -1;
    if (index === 0 || !/[a-z0-9]/.test(text[index - 1])) return index;
    from = index + 1;
  }
  return -1;
}
