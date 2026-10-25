/** Offline password strength auditing — pure heuristics, nothing leaves the page. */

/** A pragmatic slice of the most-leaked passwords (top lists, public knowledge). */
const COMMON = new Set([
  "password", "123456", "123456789", "12345678", "12345", "1234567", "1234567890",
  "qwerty", "abc123", "password1", "password123", "111111", "123123", "qwerty123",
  "admin", "welcome", "letmein", "monkey", "dragon", "football", "iloveyou",
  "princess", "sunshine", "master", "shadow", "superman", "trustno1", "hunter2",
  "michael", "jennifer", "charlie", "jordan", "passw0rd", "p@ssw0rd", "whatever",
  "freedom", "qazwsx", "zaq12wsx", "asdfgh", "1q2w3e4r", "qwe123", "india@123",
  "welcome1", "welcome123", "test123", "temp123", "guest", "root", "toor",
  "changeme", "secret", "abcdefg", "asdf1234", "letmein123", "admin123",
  "abcd1234", "a1234567", "qq123456", "1234qwer", "google", "facebook", "youtube",
]);

export interface AuditResult {
  length: number;
  /** Distinct characters used. */
  pool: number;
  /** Shannon entropy of the password against its own character pool, in bits. */
  entropyBits: number;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  isCommon: boolean;
  hasSequence: boolean;
  hasRepeated: boolean;
  verdict: "weak" | "fair" | "strong" | "very strong";
  advice: string[];
}

export function auditPassword(password: string): AuditResult {
  const length = password.length;
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const hasLower = classes[0];
  const hasUpper = classes[1];
  const hasDigit = classes[2];
  const hasSymbol = classes[3];
  const pool =
    (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSymbol ? 33 : 0);

  // Shannon entropy over the characters actually used (fights padding tricks).
  const counts = new Map<string, number>();
  for (const char of password) counts.set(char, (counts.get(char) ?? 0) + 1);
  let shannon = 0;
  for (const count of counts.values()) {
    const p = count / length;
    shannon -= p * Math.log2(p);
  }
  const entropyBits = length === 0 ? 0 : Math.round(shannon * length);

  const lowered = password.toLowerCase();
  const isCommon = COMMON.has(lowered) || COMMON.has(lowered.replace(/[0-9!@#$]+$/, "")) && length <= 12;

  const sequences = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const hasSequence =
    sequences.some((seq) => {
      const forward = seq + seq;
      const backward = seq.split("").reverse().join("") + seq;
      return (
        forward.includes(lowered.slice(0, 4)) && length >= 4 ||
        backward.includes(lowered.slice(0, 4)) && length >= 4
      );
    }) && length <= 12;
  const hasRepeated = length >= 4 && /^(.)\1+$/.test(password.slice(0, 4)) && length <= 12;

  const advice: string[] = [];
  if (length < 12) advice.push("Use at least 12 characters — length beats cleverness.");
  if (!hasUpper || !hasLower) advice.push("Mix uppercase and lowercase letters.");
  if (!hasDigit) advice.push("Add at least one digit.");
  if (!hasSymbol) advice.push("Add a symbol (!@#…).");
  if (isCommon) advice.push("This is a commonly leaked password — never use it.");
  if (hasSequence) advice.push("Keyboard runs like “qwer” add little strength.");
  if (hasRepeated) advice.push("Repeating one character adds almost no strength.");
  if (advice.length === 0 && entropyBits < 60) advice.push("Scramble the order — patterns lower real strength.");

  const verdict: AuditResult["verdict"] =
    isCommon || entropyBits < 28 || length < 8
      ? "weak"
      : entropyBits < 50
        ? "fair"
        : entropyBits < 75
          ? "strong"
          : "very strong";

  return {
    length, pool, entropyBits, hasLower, hasUpper, hasDigit, hasSymbol,
    isCommon, hasSequence, hasRepeated, verdict, advice,
  };
}
