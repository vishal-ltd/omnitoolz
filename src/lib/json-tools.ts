/** JSON formatting, minification and error location for the JSON Formatter tool. */

export type Indent = 2 | 4 | "tab";

/**
 * Re-emit validated JSON token by token. A JSON.parse → JSON.stringify round
 * trip silently corrupts data: integers beyond 2^53 get rounded, huge literals
 * turn into exponents, -0 becomes 0 and duplicate keys vanish. Copying the
 * original literals keeps the output byte-faithful, and never assigning parsed
 * keys onto objects keeps "__proto__" payloads inert data.
 */
function reemitJson(text: string, indentStr: string | null): string {
  const pretty = indentStr !== null;
  let out = "";
  let depth = 0;
  let i = 0;
  const skipWs = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const indent = () => {
    if (pretty) out += "\n" + indentStr.repeat(depth);
  };
  while (i < text.length) {
    skipWs();
    if (i >= text.length) break;
    const ch = text[i];
    if (ch === '"') {
      // Copy string literals verbatim — escapes, unicode and whitespace inside
      // strings are data, not formatting.
      const start = i;
      i++;
      while (i < text.length) {
        if (text[i] === "\\") i += 2;
        else if (text[i] === '"') { i++; break; }
        else i++;
      }
      out += text.slice(start, i);
    } else if (ch === "{" || ch === "[") {
      out += ch;
      i++;
      skipWs();
      if (text[i] === (ch === "{" ? "}" : "]")) {
        out += text[i]; // empty container stays on one line
        i++;
      } else {
        depth++;
        indent();
      }
    } else if (ch === "}" || ch === "]") {
      depth--;
      indent();
      out += ch;
      i++;
    } else if (ch === ",") {
      out += ",";
      i++;
      indent();
    } else if (ch === ":") {
      out += pretty ? ": " : ":";
      i++;
    } else {
      // Number / true / false / null literal — copy exactly as written.
      const start = i;
      while (i < text.length && !/[\s,{}[\]:"]/.test(text[i])) i++;
      out += text.slice(start, i);
    }
  }
  return out;
}

export function formatJson(text: string, indent: Indent): string {
  JSON.parse(text); // validate first — engine errors carry the position
  return reemitJson(text, indent === "tab" ? "\t" : " ".repeat(indent));
}

export function minifyJson(text: string): string {
  JSON.parse(text);
  return reemitJson(text, null);
}

export interface JsonErrorLocation {
  message: string;
  line: number;
  column: number;
}

/**
 * Extract a 1-based line/column from a JSON.parse SyntaxError. V8 includes
 * "at position N" / "line X column Y"; other engines fall back to a message-only
 * location so the UI can still show something useful.
 */
export function locateJsonError(error: unknown, text: string): JsonErrorLocation {
  const message = error instanceof Error ? error.message : String(error);
  const lineMatch = /line (\d+) column (\d+)/.exec(message);
  if (lineMatch) {
    return { message, line: Number(lineMatch[1]), column: Number(lineMatch[2]) };
  }
  const posMatch = /at position (\d+)/.exec(message);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    const before = text.slice(0, Math.min(pos, text.length));
    const line = before.split("\n").length;
    const column = pos - before.lastIndexOf("\n");
    return { message, line, column };
  }
  return { message, line: 1, column: 1 };
}

export function countJsonNodes(text: string): { keys: number; depth: number } {
  let keys = 0;
  let depth = 0;
  let maxDepth = 0;
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{" || char === "[") {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === "}" || char === "]") {
      depth = Math.max(0, depth - 1);
    } else if (char === ":") {
      keys++;
    }
  }
  return { keys, depth: maxDepth };
}
