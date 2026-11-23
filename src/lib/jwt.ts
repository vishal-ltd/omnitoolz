/** JWT decoding (header/payload inspection) — verification of signatures is out of scope. */

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  problems: string[];
}

function base64UrlDecode(part: string): Uint8Array {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** JSON.parse can return null/arrays/scalars — a JWT part must be an object,
 *  and saying so beats a TypeError deep in the claim loop. */
function parsePart(part: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    throw new Error(`The ${label} isn't valid base64url-encoded JSON.`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`The ${label} decodes to ${value === null ? "null" : Array.isArray(value) ? "an array" : "a scalar"} — a JWT ${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function decodeJwt(token: string): JwtParts {
  const problems: string[] = [];
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("A JWT has three dot-separated parts — this doesn't.");
  }
  const header = parsePart(parts[0], "header");
  const payload = parsePart(parts[1], "payload");

  // Unsigned tokens deserve a loud note: "alg":"none" means anyone can forge
  // the claims. We never verify signatures — decoding proves nothing.
  const alg = typeof header.alg === "string" ? header.alg : "";
  if (alg.toLowerCase() === "none") {
    problems.push("Header says alg “none” — this token is unsigned and trivially forgeable.");
  } else if (parts[2] === "") {
    problems.push("The signature part is empty.");
  }

  const numericDateKeys = ["exp", "iat", "nbf"];
  for (const key of numericDateKeys) {
    if (typeof payload[key] === "number") {
      const date = new Date(payload[key] as number * 1000);
      if (Number.isNaN(date.getTime())) continue;
      if (key === "exp") {
        if (Date.now() > date.getTime()) problems.push(`Expired ${date.toLocaleString()}.`);
        else problems.push(`Valid until ${date.toLocaleString()}.`);
      } else if (key === "iat") {
        problems.push(`Issued ${date.toLocaleString()}.`);
      } else if (key === "nbf") {
        if (Date.now() < date.getTime()) problems.push(`Not valid until ${date.toLocaleString()}.`);
        else problems.push(`Valid since ${date.toLocaleString()}.`);
      }
    }
  }
  if (typeof payload.exp !== "number") problems.push("No expiry (exp) claim — tokens should carry one.");

  return { header, payload, signature: parts[2], problems };
}
