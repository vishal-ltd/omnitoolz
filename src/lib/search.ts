import { liveTools } from "./tools/registry";
import type { ToolWithRoute } from "./tools/types";

/**
 * Client-side search over the tool registry. Scoring is intentionally simple
 * and predictable: name prefix > name word-start > name substring >
 * keyword/description/category match.
 */

export interface SearchHit extends ToolWithRoute {
  score: number;
}

export function searchTools(query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const hits: SearchHit[] = [];
  for (const tool of liveTools()) {
    const haystacks = [
      { text: tool.name.toLowerCase(), weight: 8 },
      { text: tool.keywords.join(" ").toLowerCase(), weight: 5 },
      { text: tool.categoryName.toLowerCase(), weight: 4 },
      { text: tool.description.toLowerCase(), weight: 3 },
    ];

    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      let termScore = 0;
      for (const { text, weight } of haystacks) {
        if (text === term) {
          termScore = Math.max(termScore, weight * 4);
          continue;
        }
        const wordStart = new RegExp(`\\b${escapeRegExp(term)}`).test(text);
        if (wordStart) {
          termScore = Math.max(termScore, weight * 2);
          continue;
        }
        const idx = text.indexOf(term);
        if (idx !== -1) {
          termScore = Math.max(termScore, weight);
        }
      }
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
