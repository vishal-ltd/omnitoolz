/** JSON formatting, minification and error location for the JSON Formatter tool. */

export type Indent = 2 | 4 | "tab";

export function formatJson(text: string, indent: Indent): string {
  const value = JSON.parse(text);
  const indentStr = indent === "tab" ? "\t" : " ".repeat(indent);
  return JSON.stringify(value, null, indentStr);
}

export function minifyJson(text: string): string {
  const value = JSON.parse(text);
  return JSON.stringify(value);
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
