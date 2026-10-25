import { describe, expect, it } from "vitest";
import {
  formatMoney,
  invoiceTotals,
  lineTotal,
  moneyLocale,
  toWinAnsi,
} from "./invoice-math";

describe("invoice-math", () => {
  it("multiplies quantity by unit price with cent rounding", () => {
    expect(lineTotal({ description: "x", quantity: 3, unitPrice: 4.5 })).toBe(13.5);
    expect(lineTotal({ description: "x", quantity: 3, unitPrice: 0.1 })).toBe(0.3);
    expect(lineTotal({ description: "x", quantity: 0, unitPrice: 99 })).toBe(0);
  });

  it("survives classic floating point traps", () => {
    expect(
      lineTotal({ description: "x", quantity: 3, unitPrice: 19.99 }),
    ).toBeCloseTo(59.97, 2);
  });

  it("sums items and applies tax to the rounded subtotal", () => {
    const totals = invoiceTotals(
      [
        { description: "a", quantity: 2, unitPrice: 10 },
        { description: "b", quantity: 1, unitPrice: 5.005 },
      ],
      18,
    );
    expect(totals.subtotal).toBe(25.01); // 20 + 5.01 (5.005 rounds to 5.01)
    expect(totals.tax).toBeCloseTo(4.5, 2);
    expect(totals.total).toBeCloseTo(29.51, 2);
  });

  it("handles zero tax and empty item lists", () => {
    expect(invoiceTotals([], 18)).toEqual({ subtotal: 0, tax: 0, total: 0 });
    expect(invoiceTotals([{ description: "a", quantity: 1, unitPrice: 10 }], 0).tax).toBe(0);
  });

  it("formats money with two decimals and a currency prefix", () => {
    expect(formatMoney(1234.5, "$ ")).toBe("$ 1,234.50");
    expect(formatMoney(0, "€ ")).toBe("€ 0.00");
  });

  it("uses Indian digit grouping for rupees", () => {
    expect(moneyLocale("Rs. ")).toBe("en-IN");
    expect(moneyLocale("$ ")).toBe("en-US");
    expect(formatMoney(1234567.89, "Rs. ")).toBe("Rs. 12,34,567.89");
  });

  it("maps the rupee sign and keeps WinAnsi text drawable", () => {
    expect(toWinAnsi("Total ₹450")).toBe("Total Rs.450");
    expect(toWinAnsi("Naïve café — “quoted”")).toBe("Naïve café — “quoted”");
    expect(toWinAnsi("日本語")).toBe("???");
    expect(toWinAnsi("line\nbreak")).toBe("line\nbreak");
  });
});
