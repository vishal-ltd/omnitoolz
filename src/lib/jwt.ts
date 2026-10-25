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

export function decodeJwt(token: string): JwtParts {
  const problems: string[] = [];
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("A JWT has three dot-separated parts — this doesn't.");
  }
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  } catch {
    throw new Error("The header isn't valid base64url-encoded JSON.");
  }
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    throw new Error("The payload isn't valid base64url-encoded JSON.");
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
      }
    }
  }
  if (typeof payload.exp !== "number") problems.push("No expiry (exp) claim — tokens should carry one.");

  return { header, payload, signature: parts[2], problems };
}
