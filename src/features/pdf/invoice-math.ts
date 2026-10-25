/** Pure invoice math + PDF-text sanitizing (unit-testable, no DOM). */

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineTotal(item: LineItem): number {
  return roundMoney(item.quantity * item.unitPrice);
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function invoiceTotals(items: LineItem[], taxPercent: number): InvoiceTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const tax = roundMoney((subtotal * taxPercent) / 100);
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

/** Locale for grouping digits — Indian grouping for rupees, western otherwise. */
export function moneyLocale(currency: string): string {
  return currency.includes("Rs") ? "en-IN" : "en-US";
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency.trim()} ${amount.toLocaleString(moneyLocale(currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Standard PDF fonts (WinAnsi / CP-1252) cannot draw the rupee sign and most
 * non-Latin scripts — map what we can and mark the rest instead of throwing.
 */
export function toWinAnsi(text: string): string {
  const mapped = text
    .replace(/₹/g, "Rs.")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2010\u2011\u2012\u2015]/g, "-");
  // WinAnsi covers Latin-1 plus the CP-1252 punctuation block.
  return mapped.replace(
    /[^\x20-\x7E\u00A0-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178\n]/g,
    "?",
  );
}
