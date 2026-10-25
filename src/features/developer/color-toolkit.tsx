"use client";

import { useMemo, useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Field, TextInput } from "@/components/ui/form";
import { contrastRatio, hslToRgb, parseHex, rgbToHsl, toHex, wcagGrade } from "@/lib/color";

export default function ColorToolkitTool() {
  const [hex, setHex] = useState("#5b54e8");
  const [otherHex, setOtherHex] = useState("#ffffff");

  const rgb = useMemo(() => parseHex(hex), [hex]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);
  const roundTrip = useMemo(() => (hsl ? hslToRgb(hsl) : null), [hsl]);
  const other = useMemo(() => parseHex(otherHex), [otherHex]);
  const ratio = rgb && other ? contrastRatio(rgb, other) : null;

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Color" hint="Hex, 3 or 6 digits">
            <TextInput value={hex} onChange={(event) => setHex(event.target.value)} aria-label="Color hex" />
          </Field>
          <Field label="Compare against" hint="For the contrast check">
            <TextInput value={otherHex} onChange={(event) => setOtherHex(event.target.value)} aria-label="Second color hex" />
          </Field>
        </div>

        {rgb ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="size-16 border-[3px] border-edge shadow-[4px_4px_0_0_var(--color-shadow)]"
                style={{ backgroundColor: hex }}
                aria-hidden
              />
              <span
                className="size-16 border-[3px] border-edge shadow-[4px_4px_0_0_var(--color-shadow)]"
                style={{ backgroundColor: otherHex }}
                aria-hidden
              />
            </div>

            <OptionsPanel title="Values">
              <div className="sm:col-span-2">
                <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card">
                  {[
                    ["HEX", toHex(rgb).toUpperCase()],
                    ["RGB", `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
                    ["HSL", hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : "—"],
                    ["HSL → RGB", roundTrip ? `rgb(${roundTrip.r}, ${roundTrip.g}, ${roundTrip.b})` : "—"],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="font-display text-[8px] text-ink-soft uppercase">{label}</span>
                      <code className="font-body text-lg text-ink">{value}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </OptionsPanel>

            {ratio !== null && (
              <div
                className={`border-[3px] p-4 shadow-[4px_4px_0_0_var(--color-shadow)] ${
                  wcagGrade(ratio) === "Fail" ? "border-err bg-err-soft" : "border-ok bg-ok-soft"
                }`}
              >
                <p className="font-display text-[10px] uppercase">
                  Contrast {ratio.toFixed(2)}:1 — {wcagGrade(ratio)}
                </p>
                <p className="mt-2 font-body text-lg text-ink-soft">
                  {wcagGrade(ratio) === "AAA"
                    ? "Excellent — passes every WCAG level."
                    : wcagGrade(ratio) === "AA"
                      ? "Good — passes normal-text AA."
                      : wcagGrade(ratio) === "AA Large"
                        ? "Only for large text (18pt+) or UI components."
                        : "Fails WCAG — not safe for text."}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-err">“{hex}” isn&apos;t a valid hex color.</p>
        )}
      </div>
    </ToolWidget>
  );
}
