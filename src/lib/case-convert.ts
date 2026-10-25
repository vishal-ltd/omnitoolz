/** Text case transformations for the Text Case Converter tool. */

const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or",
  "so", "the", "to", "up", "yet", "via",
]);

function words(text: string): string[] {
  // Split on non-alphanumerics, then on camelCase humps (PageTitle → Page Title,
  // HTTPServer → HTTP Server) so case-style conversions are word-aware.
  const spaced = text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.match(/[A-Za-z0-9']+/g) ?? [];
}

export function toUpper(text: string): string {
  return text.toUpperCase();
}

export function toLower(text: string): string {
  return text.toLowerCase();
}

export function toTitleCase(text: string): string {
  // Capitalize major words; keep minor words lowercase unless first or last.
  const tokens = text.split(/(\s+)/);
  const wordIdx: number[] = [];
  tokens.forEach((token, i) => {
    if (/\S/.test(token)) wordIdx.push(i);
  });
  const last = wordIdx.length - 1;
  let w = 0;
  for (const i of wordIdx) {
    const isFirst = w === 0;
    const isLast = w === last;
    const raw = tokens[i];
    const lower = raw.toLowerCase();
    if (!isFirst && !isLast && MINOR_WORDS.has(lower.replace(/[^a-z']/g, ""))) {
      tokens[i] = lower;
    } else if (raw.length > 0) {
      tokens[i] = lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    w++;
  }
  return tokens.join("");
}

export function toSentenceCase(text: string): string {
  let result = "";
  let capitalize = true;
  for (const char of text) {
    if (/[.!?]/.test(char)) {
      result += char;
      capitalize = true;
    } else if (capitalize && /[a-z]/.test(char)) {
      result += char.toUpperCase();
      capitalize = false;
    } else if (/[A-Za-z]/.test(char)) {
      if (!capitalize) result += char.toLowerCase();
      else {
        result += char;
        capitalize = false;
      }
    } else {
      // Hold capitalization through quotes/brackets after sentence enders.
      if (capitalize && !/[\s"“'’([–—-]/.test(char)) capitalize = false;
      result += char;
    }
  }
  return result;
}

function joinCamel(text: string, pascal: boolean): string {
  const parts = words(text);
  return parts
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0 && !pascal) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function toCamelCase(text: string): string {
  return joinCamel(text, false);
}

export function toPascalCase(text: string): string {
  return joinCamel(text, true);
}

export function toSnakeCase(text: string): string {
  return words(text).map((w) => w.toLowerCase()).join("_");
}

export function toKebabCase(text: string): string {
  return words(text).map((w) => w.toLowerCase()).join("-");
}

export function toAlternatingCase(text: string): string {
  let i = 0;
  return [...text]
    .map((char) => {
      if (!/[a-z]/i.test(char)) return char;
      const out = i % 2 === 0 ? char.toLowerCase() : char.toUpperCase();
      i++;
      return out;
    })
    .join("");
}

export function toInverseCase(text: string): string {
  return [...text]
    .map((char) => (char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()))
    .join("");
}

export type CaseStyle =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "alternating"
  | "inverse";

export const caseStyles: Array<{ id: CaseStyle; label: string; apply: (text: string) => string }> = [
  { id: "upper", label: "UPPERCASE", apply: toUpper },
  { id: "lower", label: "lowercase", apply: toLower },
  { id: "title", label: "Title Case", apply: toTitleCase },
  { id: "sentence", label: "Sentence case", apply: toSentenceCase },
  { id: "camel", label: "camelCase", apply: toCamelCase },
  { id: "pascal", label: "PascalCase", apply: toPascalCase },
  { id: "snake", label: "snake_case", apply: toSnakeCase },
  { id: "kebab", label: "kebab-case", apply: toKebabCase },
  { id: "alternating", label: "aLtErNaTiNg", apply: toAlternatingCase },
  { id: "inverse", label: "iNVERSE", apply: toInverseCase },
];

export function convertCase(text: string, style: CaseStyle): string {
  return caseStyles.find((s) => s.id === style)?.apply(text) ?? text;
}
