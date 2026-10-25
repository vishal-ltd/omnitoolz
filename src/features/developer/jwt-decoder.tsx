"use client";

import { useMemo, useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/form";
import { decodeJwt } from "@/lib/jwt";

function formatValue(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (typeof value === "object") {
    return JSON.stringify(value, null, depth === 0 ? 2 : 0);
  }
  return String(value);
}

export default function JwtDecoderTool() {
  const [token, setToken] = useState("");

  const { decoded, decodeError } = useMemo(() => {
    if (!token.trim()) return { decoded: null, decodeError: null };
    try {
      return { decoded: decodeJwt(token), decodeError: null };
    } catch (e) {
      return {
        decoded: null,
        decodeError: e instanceof Error ? e.message : "Couldn't decode this token.",
      };
    }
  }, [token]);

  return (
    <ToolWidget>
      <div className="space-y-4">
        <Field label="JWT (paste any token — decoding is local)">
          <TextArea
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.signature"
            aria-label="JWT token"
            rows={4}
          />
        </Field>

        {decodeError && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{decodeError}</p>}

        {decoded && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-[3px] border-edge bg-card p-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
                <p className="font-display text-[8px] text-ink-soft uppercase">Header</p>
                <ul className="mt-2 space-y-1 font-body text-lg text-ink">
                  {Object.entries(decoded.header).map(([key, value]) => (
                    <li key={key}>
                      <span className="text-ink-soft">{key}: </span>
                      {formatValue(value)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-[3px] border-edge bg-card p-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
                <p className="font-display text-[8px] text-ink-soft uppercase">Lifetime</p>
                <ul className="mt-2 space-y-1 font-body text-lg text-ink">
                  {decoded.problems.map((problem) => (
                    <li key={problem}>▸ {problem}</li>
                  ))}
                </ul>
              </div>
            </div>

            <OptionsPanel title="Claims">
              <div className="sm:col-span-2">
                <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card">
                  {Object.entries(decoded.payload).map(([key, value]) => (
                    <li key={key} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5">
                      <span className="break-all font-body text-lg text-brand">{key}</span>
                      <span className="break-all font-body text-lg text-ink">{formatValue(value, 1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-ink-soft sm:col-span-2">
                Signature: <code className="break-all">{decoded.signature.slice(0, 24)}…</code> —
                signatures aren&apos;t verified here; decoding alone never proves authenticity.
              </p>
            </OptionsPanel>
          </>
        )}

        {token && (
          <Button variant="secondary" onClick={() => setToken("")}>
            Clear
          </Button>
        )}
      </div>
    </ToolWidget>
  );
}
