/**
 * RFC 6238 TOTP (SHA-1, 30s steps, 6 digits) built on Web Crypto.
 * Works in browsers and Node ≥ 18 (both expose crypto.subtle).
 */
import { base32Decode } from "./base32";

const STEP_SECONDS = 30;

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1(keyBytes: Uint8Array, message: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message as unknown as BufferSource);
  return bufferToHex(signature);
}

/** Dynamic truncation per RFC 4226 §5.3. */
export function dynamicTruncate(hexDigest: string, digits: number): string {
  const bytes = hexDigest.match(/.{2}/g)!.map((h) => parseInt(h, 16));
  const offset = bytes[bytes.length - 1] & 0x0f;
  const binary =
    ((bytes[offset] & 0x7f) << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export async function totpAt(
  secretBytes: Uint8Array,
  timestampMs: number,
  digits = 6,
): Promise<string> {
  const counter = Math.floor(timestampMs / 1000 / STEP_SECONDS);
  const message = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return dynamicTruncate(await hmacSha1(secretBytes, message), digits);
}

export async function totpFromBase32(
  secret: string,
  timestampMs = Date.now(),
  digits = 6,
): Promise<string> {
  return totpAt(base32Decode(secret), timestampMs, digits);
}

/** Whole seconds until the current 30s window rolls over. */
export function secondsRemaining(timestampMs = Date.now()): number {
  return STEP_SECONDS - (Math.floor(timestampMs / 1000) % STEP_SECONDS);
}
