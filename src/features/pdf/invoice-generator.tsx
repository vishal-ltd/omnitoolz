"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/form";
import { bytesToBlob, type ResultFile } from "@/lib/utils";
import {
  formatMoney,
  invoiceTotals,
  lineTotal,
  toWinAnsi,
  type LineItem,
} from "./invoice-math";

type DocType = "invoice" | "receipt" | "quote";

const TYPE_LABEL: Record<DocType, string> = {
  invoice: "INVOICE",
  receipt: "RECEIPT",
  quote: "QUOTE",
};

const CURRENCIES = ["$ ", "€ ", "£ ", "Rs. "];

interface ItemRow extends LineItem {
  id: number;
}

let nextItemId = 1;

function makeItem(): ItemRow {
  return { id: nextItemId++, description: "", quantity: 1, unitPrice: 0 };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceGeneratorTool() {
  const { state, start, reset } = useJob();
  const [docType, setDocType] = useState<DocType>("invoice");
  const [number, setNumber] = useState("INV-001");
  const [date, setDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromDetails, setFromDetails] = useState("");
  const [toName, setToName] = useState("");
  const [toDetails, setToDetails] = useState("");
  const [currency, setCurrency] = useState("$ ");
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState("Thank you for your business!");
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);

  const filledItems: LineItem[] = items
    .filter((item) => item.description.trim() !== "" && item.quantity > 0)
    .map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice }));
  const totals = invoiceTotals(filledItems, taxPercent);

  function updateItem(id: number, patch: Partial<ItemRow>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function generate() {
    await start(async ({ report }) => {
      report("Laying out the document…", 0.8);
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]);
      const regular = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const ink = rgb(0.12, 0.13, 0.18);
      const soft = rgb(0.42, 0.43, 0.5);
      const accent = rgb(0.36, 0.33, 0.91);
      const t = (text: string) => toWinAnsi(text);

      const left = 50;
      const right = 545;
      let y = 792;

      // Headline
      page.drawText(TYPE_LABEL[docType], { x: left, y, size: 30, font: bold, color: ink });
      const numberText = t(number.trim() || `#${docType}`);
      const numberWidth = bold.widthOfTextAtSize(numberText, 12);
      page.drawText(numberText, { x: right - numberWidth, y: y + 4, size: 12, font: bold, color: accent });
      y -= 20;
      const dateText = t([date, dueDate ? ` · due ${dueDate}` : ""].join(""));
      const dateWidth = regular.widthOfTextAtSize(dateText, 10);
      page.drawText(dateText, { x: right - dateWidth, y, size: 10, font: regular, color: soft });
      y -= 16;

      // Parties
      y -= 10;
      page.drawText("FROM", { x: left, y, size: 8, font: bold, color: soft });
      const toX = 320;
      page.drawText("BILL TO", { x: toX, y, size: 8, font: bold, color: soft });
      y -= 14;
      const partyLine = (text: string, x: number, width: number) => {
        const sanitized = t(text);
        if (!sanitized) return;
        page.drawText(sanitized, { x, y, size: 10, font: bold, color: ink });
        y -= 13;
        for (const line of sanitized.split("\n").slice(1)) {
          page.drawText(line, { x, y, size: 10, font: regular, color: ink });
          y -= 13;
        }
        void width;
      };
      const fromYStart = y;
      partyLine(fromName.trim() || "Your name", left, 250);
      const fromDetailsLines = t(fromDetails).split("\n");
      for (const line of fromDetailsLines.slice(0, 4)) {
        page.drawText(line, { x: left, y, size: 9, font: regular, color: soft });
        y -= 12;
      }
      y = fromYStart;
      partyLine(toName.trim() || "Client name", toX, 220);
      const toDetailsLines = t(toDetails).split("\n");
      for (const line of toDetailsLines.slice(0, 4)) {
        page.drawText(line, { x: toX, y, size: 9, font: regular, color: soft });
        y -= 12;
      }
      y = Math.min(y, fromYStart - 70) - 20;

      // Items table
      const colQty = 380;
      const colRate = 455;
      const colAmount = right;
      const rowLine = () => {
        page.drawLine({
          start: { x: left, y },
          end: { x: right, y },
          thickness: 1,
          color: rgb(0.85, 0.85, 0.88),
        });
      };
      page.drawText("DESCRIPTION", { x: left, y, size: 8, font: bold, color: soft });
      const rightText = (text: string, x: number, size: number, font: typeof regular, color = ink) => {
        const clean = t(text);
        page.drawText(clean, { x: x - font.widthOfTextAtSize(clean, size), y, size, font, color });
      };
      rightText("QTY", colQty, 8, bold, soft);
      rightText("RATE", colRate, 8, bold, soft);
      rightText("AMOUNT", colAmount, 8, bold, soft);
      y -= 6;
      rowLine();
      y -= 16;

      for (const item of filledItems) {
        if (y < 200) break;
        const description = t(item.description.trim());
        page.drawText(description.slice(0, 46), { x: left, y, size: 10, font: regular, color: ink });
        rightText(String(item.quantity), colQty, 10, regular);
        rightText(formatMoney(item.unitPrice, currency), colRate, 10, regular);
        rightText(formatMoney(lineTotal(item), currency), colAmount, 10, regular);
        y -= 16;
      }
      y -= 2;
      rowLine();
      y -= 18;

      // Totals
      const totalRow = (label: string, amount: string, emphasize: boolean) => {
        const font = emphasize ? bold : regular;
        const size = emphasize ? 12 : 10;
        page.drawText(label, { x: colQty - 60, y, size, font, color: emphasize ? ink : soft });
        rightText(amount, colAmount, size, font);
        y -= emphasize ? 18 : 15;
      };
      totalRow("Subtotal", formatMoney(totals.subtotal, currency), false);
      if (taxPercent > 0) {
        totalRow(`Tax (${taxPercent}%)`, formatMoney(totals.tax, currency), false);
      }
      totalRow("TOTAL", formatMoney(totals.total, currency), true);

      // Notes + footer
      y -= 12;
      const notesText = t(notes.trim());
      if (notesText) {
        page.drawText(notesText.slice(0, 90), { x: left, y, size: 9, font: regular, color: soft });
      }
      page.drawLine({
        start: { x: left, y: 60 },
        end: { x: right, y: 60 },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.88),
      });
      page.drawText("Made with OmniToolz — free browser tools, no sign-up", {
        x: left,
        y: 46,
        size: 8,
        font: regular,
        color: soft,
      });

      const bytes = await doc.save();
      const safeNumber = (number.trim() || docType).replace(/[^\w-]+/g, "-");
      const result: ResultFile = {
        name: `${docType}-${safeNumber}.pdf`,
        blob: bytesToBlob(bytes, "application/pdf"),
      };
      return [result];
    }, "Generating PDF…");
  }

  const canGenerate = filledItems.length > 0 && state.phase !== "running";

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={`${filledItems.length} line ${filledItems.length === 1 ? "item" : "items"} · total ${formatMoney(totals.total, currency)}`}
          onReset={reset}
          resetLabel="Adjust & regenerate"
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <OptionsPanel title="Document">
            <Field label="Type">
              <Select value={docType} onChange={(event) => setDocType(event.target.value as DocType)} aria-label="Document type">
                <option value="invoice">Invoice</option>
                <option value="receipt">Receipt</option>
                <option value="quote">Quote</option>
              </Select>
            </Field>
            <Field label="Number">
              <TextInput value={number} onChange={(event) => setNumber(event.target.value)} placeholder="INV-001" aria-label="Document number" />
            </Field>
            <Field label="Date">
              <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Document date" />
            </Field>
            <Field label="Due date (optional)" hint="Invoices usually show one">
              <TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Due date" />
            </Field>
          </OptionsPanel>

          <OptionsPanel title="From / To">
            <Field label="Your name or business">
              <TextInput value={fromName} onChange={(event) => setFromName(event.target.value)} placeholder="Acme Studio" aria-label="Sender name" />
            </Field>
            <Field label="Your details" hint="Address, email, tax ID — one per line">
              <TextArea
                value={fromDetails}
                onChange={(event) => setFromDetails(event.target.value)}
                placeholder={"hello@acme.dev\nGSTIN 22AAAAA0000A1Z5"}
                aria-label="Sender details"
                rows={3}
              />
            </Field>
            <Field label="Client name">
              <TextInput value={toName} onChange={(event) => setToName(event.target.value)} placeholder="Globex Corp" aria-label="Client name" />
            </Field>
            <Field label="Client details">
              <TextArea value={toDetails} onChange={(event) => setToDetails(event.target.value)} placeholder="billing@globex.com" aria-label="Client details" rows={3} />
            </Field>
          </OptionsPanel>

          <OptionsPanel title="Line items">
            <div className="space-y-3 sm:col-span-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-2 items-end gap-2 border-[3px] border-edge bg-canvas p-2 sm:grid-cols-[1fr_70px_100px_auto]"
                >
                  <Field label={`Item ${index + 1}`} className="col-span-2 sm:col-span-1">
                    <TextInput
                      value={item.description}
                      onChange={(event) => updateItem(item.id, { description: event.target.value })}
                      placeholder="Design work"
                      aria-label={`Item ${index + 1} description`}
                    />
                  </Field>
                  <Field label="Qty">
                    <TextInput
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                      aria-label={`Item ${index + 1} quantity`}
                    />
                  </Field>
                  <Field label="Rate">
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })}
                      aria-label={`Item ${index + 1} unit price`}
                    />
                  </Field>
                  <div className="col-span-2 flex items-center justify-end gap-2 pb-1 sm:col-span-1">
                    <span className="min-w-16 text-right font-body text-lg text-ink">
                      {formatMoney(lineTotal(item), currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                      disabled={items.length === 1}
                      className="border-[3px] border-edge bg-canvas p-1.5 text-err shadow-[2px_2px_0_0_var(--color-shadow)] disabled:opacity-40"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setItems((current) => [...current, makeItem()])}>
                <Plus className="size-4" aria-hidden />
                Add item
              </Button>
            </div>
            <Field label="Currency">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency symbol">
                {CURRENCIES.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol.trim()} ({symbol.trim() === "Rs." ? "rupees, Indian grouping" : symbol.trim()})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tax %">
              <TextInput
                type="number"
                min={0}
                max={99}
                value={taxPercent}
                onChange={(event) => setTaxPercent(Math.max(0, Math.min(99, Number(event.target.value))))}
                aria-label="Tax percentage"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <TextInput value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Notes" />
            </Field>
            <div className="border-[3px] border-edge bg-card p-3 text-right font-body text-lg text-ink shadow-[3px_3px_0_0_var(--color-shadow)] sm:col-span-2">
              <p className="text-ink-soft">Subtotal {formatMoney(totals.subtotal, currency)}</p>
              {taxPercent > 0 && <p className="text-ink-soft">Tax {formatMoney(totals.tax, currency)}</p>}
              <p className="mt-1 font-display text-[11px] text-ink uppercase">Total {formatMoney(totals.total, currency)}</p>
            </div>
          </OptionsPanel>

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">The PDF is built locally — client data never leaves this tab.</p>
            <Button size="lg" disabled={!canGenerate} onClick={generate}>
              Generate PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
