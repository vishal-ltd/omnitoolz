/** Pure invoice math + PDF-text sanitizing (unit-testable, no DOM). */

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function roundMoney(value: number): number {
  // Number.EPSILON is too small above ~4 to flip x.xx5 float representations
  // (8.005 * 100 === 800.4999…). toPrecision(12) restores the intended decimal
  // before rounding; negatives round half away from zero like positives.
  const scaled = Number((Math.abs(value) * 100).toPrecision(12));
  const rounded = Math.round(scaled) / 100;
  return value < 0 ? -rounded : rounded;
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
 * non-Latin scripts — shared with the converters so every standard-font draw
 * path sanitizes identically.
 */
export { sanitize as toWinAnsi } from "./convert-core";
