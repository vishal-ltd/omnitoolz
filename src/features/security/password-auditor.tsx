"use client";

import { useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Checkbox, Field, TextInput } from "@/components/ui/form";
import { auditPassword } from "@/lib/auditor";

const VERDICT_STYLE: Record<string, string> = {
  weak: "border-err bg-err-soft",
  fair: "border-warn bg-warn-soft",
  strong: "border-ok bg-ok-soft",
  "very strong": "border-ok bg-ok-soft",
};

export default function PasswordAuditorTool() {
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);

  const audit = useMemo(() => auditPassword(password), [password]);
  const active = password.length > 0;

  return (
    <ToolWidget>
      <div className="space-y-4">
        <Field label="Password to audit" hint="Typed and judged entirely on this page — nothing is sent or stored">
          <TextInput
            type={reveal ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Type or paste a password…"
            aria-label="Password to audit"
            autoComplete="off"
          />
        </Field>

        <Checkbox checked={reveal} onChange={setReveal} label="Reveal while typing" />

        {active && (
          <>
            <div className={`border-[3px] p-4 shadow-[4px_4px_0_0_var(--color-shadow)] ${VERDICT_STYLE[audit.verdict]}`}>
              <p className="font-display text-[10px] uppercase">{audit.verdict}</p>
              <div className="mt-3 h-4 border-[3px] border-edge bg-canvas">
                <div
                  className={`h-full transition-[width] ${
                    audit.verdict === "weak" ? "bg-err" : audit.verdict === "fair" ? "bg-warn" : "bg-ok"
                  }`}
                  style={{ width: `${Math.min(100, (audit.entropyBits / 100) * 100)}%` }}
                />
              </div>
              <p className="mt-2 font-body text-lg text-ink-soft">
                {audit.entropyBits} bits of entropy · {audit.length} characters · {audit.pool}-symbol pool
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["a-z", audit.hasLower],
                ["A-Z", audit.hasUpper],
                ["0-9", audit.hasDigit],
                ["!@#", audit.hasSymbol],
              ].map(([label, on]) => (
                <span
                  key={label as string}
                  className={`border-[3px] border-edge px-2 py-1 text-center font-display text-[9px] uppercase ${
                    on ? "bg-ok-soft text-ink" : "bg-canvas text-ink-soft"
                  }`}
                >
                  {label as string} {on ? "✓" : "✗"}
                </span>
              ))}
            </div>

            {audit.isCommon && (
              <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">
                This password appears in public leak lists — assume it&apos;s cracked already.
              </p>
            )}

            {audit.advice.length > 0 && (
              <ul className="space-y-1 border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
                {audit.advice.map((tip) => (
                  <li key={tip} className="font-body text-lg text-ink">
                    ▸ {tip}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {!active && (
          <p className="text-sm text-ink-soft">
            Strength here is an offline estimate (length, variety, patterns, known-leaked lists).
            The only passwords that are safe are long, random and unique — a manager beats memory.
          </p>
        )}
      </div>
    </ToolWidget>
  );
}
