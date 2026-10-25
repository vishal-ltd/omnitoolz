"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput, Select, TextInput } from "@/components/ui/form";
import {
  buildPool,
  DEFAULT_PASSWORD_OPTIONS,
  entropyBits,
  generatePassword,
  strengthFromEntropy,
  strengthLabels,
  type PasswordOptions,
} from "@/lib/password";
import { cn } from "@/lib/utils";

export default function PasswordGeneratorTool() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [count, setCount] = useState(3);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const pool = buildPool(options);
  const bits = entropyBits(Math.round(options.length), pool.length || 1);
  const strength = strengthFromEntropy(bits);
  const canGenerate = pool.length > 0;

  const generate = useCallback(() => {
    try {
      setPasswords(Array.from({ length: count }, () => generatePassword(options)));
      setCopiedIndex(null);
    } catch {
      setPasswords([]);
    }
  }, [count, options]);

  // Generate an initial batch on first load.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: keyof PasswordOptions, value: boolean) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  async function copy(password: string, index: number) {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Clipboard may be blocked; the password stays selectable as text.
    }
  }

  return (
    <ToolWidget>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Field label={`Length — ${options.length} characters`}>
            <RangeInput
              value={options.length}
              min={8}
              max={64}
              onChange={(value) => setOptions((prev) => ({ ...prev, length: value }))}
            />
          </Field>

          <Field label="How many">
            <Select value={count} onChange={(event) => setCount(Number(event.target.value))} aria-label="Number of passwords">
              {[1, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "password" : "passwords"}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="space-y-2.5">
            <legend className="text-sm font-medium text-ink">Character sets</legend>
            <Checkbox label="Uppercase (A-Z)" checked={options.uppercase} onChange={(v) => toggle("uppercase", v)} />
            <Checkbox label="Lowercase (a-z)" checked={options.lowercase} onChange={(v) => toggle("lowercase", v)} />
            <Checkbox label="Digits (0-9)" checked={options.digits} onChange={(v) => toggle("digits", v)} />
            <Checkbox label="Symbols (!@#$…)" checked={options.symbols} onChange={(v) => toggle("symbols", v)} />
            <Checkbox
              label="Exclude look-alikes (I l 1 O 0)"
              checked={options.excludeAmbiguous}
              onChange={(v) => toggle("excludeAmbiguous", v)}
            />
          </fieldset>

          {!canGenerate && (
            <p className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn" role="alert">
              Select at least one character set.
            </p>
          )}

          <Button size="lg" onClick={generate} disabled={!canGenerate} className="w-full">
            <RefreshCw className="size-4" aria-hidden />
            Generate
          </Button>
        </div>

        <div className="space-y-4">
          <div className="border-[3px] border-edge bg-canvas p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-[9px] text-ink uppercase">Strength estimate</p>
              <p className={cn("font-display text-[10px]", strength === "weak" ? "text-err" : strength === "fair" ? "text-warn" : "text-ok")}>
                {strengthLabels[strength]}
              </p>
            </div>
            <div className="mt-2 h-5 overflow-hidden border-[3px] border-edge bg-card">
              <div
                className={cn(
                  "h-full transition-[width] duration-200",
                  (strength === "strong" || strength === "excellent") && "pixel-stripes-ok",
                )}
                style={{
                  width: `${Math.min(100, (bits / 128) * 100)}%`,
                  ...(strength !== "strong" &&
                    strength !== "excellent" && {
                      backgroundColor: strength === "weak" ? "var(--color-err)" : "var(--color-warn)",
                    }),
                }}
              />
            </div>
            <p className="mt-2 font-body text-base text-ink-soft">
              ≈ {Math.round(bits)} bits of entropy — {strength === "weak" ? "raise the length" : "resistant to offline cracking attempts"}.
            </p>
          </div>

          <ul className="space-y-2">
            {passwords.map((password, index) => (
              <li key={index} className="flex items-center gap-2">
                <TextInput
                  readOnly
                  value={password}
                  className="code-area flex-1 font-medium"
                  onFocus={(event) => event.target.select()}
                  aria-label={`Password ${index + 1}`}
                />
                <Button variant="secondary" size="sm" onClick={() => copy(password, index)} aria-label={`Copy password ${index + 1}`}>
                  {copiedIndex === index ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                </Button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-ink-soft">
            Generated with your browser’s cryptographic random source. Nothing is
            sent anywhere or stored.
          </p>
        </div>
      </div>
    </ToolWidget>
  );
}
