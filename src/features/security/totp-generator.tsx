"use client";

import { useCallback, useEffect, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form";
import { base32Decode, base32Encode } from "@/lib/base32";
import { secondsRemaining, totpFromBase32 } from "@/lib/totp";

function randomSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export default function TotpGeneratorTool() {
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (currentSecret: string) => {
    if (!currentSecret.trim()) {
      setCode(null);
      setNextCode(null);
      setError(null);
      return;
    }
    try {
      base32Decode(currentSecret);
      const now = Date.now();
      setCode(await totpFromBase32(currentSecret, now));
      setNextCode(await totpFromBase32(currentSecret, now + 30_000));
      setError(null);
    } catch {
      setCode(null);
      setNextCode(null);
      setError("That secret isn't valid base32 (A-Z and 2-7) — copy it fresh from the service.");
    }
  }, []);

  useEffect(() => {
    refresh(secret);
    const timer = window.setInterval(() => {
      setRemaining(secondsRemaining());
      if (secondsRemaining() === 30) refresh(secret);
    }, 500);
    return () => window.clearInterval(timer);
  }, [secret, refresh]);

  async function copyCode() {
    if (code) await navigator.clipboard.writeText(code);
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <Field label="Base32 secret" hint="From the service's “manual / can't scan” setup — stays on your device">
          <TextInput
            value={secret}
            onChange={(event) => setSecret(event.target.value.toUpperCase())}
            placeholder="JBSWY3DPEHPK3PXP"
            aria-label="TOTP secret"
            className="font-mono tracking-wider"
          />
        </Field>

        {error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</p>}

        {code && (
          <div className="border-[3px] border-edge bg-card p-6 text-center shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-[28px] tracking-[0.2em] text-ink">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <div className="mx-auto mt-4 h-4 w-48 border-[3px] border-edge bg-canvas">
              <div
                className={`h-full transition-[width] duration-500 ${remaining <= 5 ? "bg-err" : "bg-brand"}`}
                style={{ width: `${(remaining / 30) * 100}%` }}
              />
            </div>
            <p className="mt-2 font-body text-lg text-ink-soft">
              {remaining}s · next: {nextCode}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={copyCode} disabled={!code}>
            Copy code
          </Button>
          <Button variant="secondary" onClick={() => setSecret(randomSecret())}>
            Generate a test secret
          </Button>
        </div>

        <p className="text-sm text-ink-soft">
          Codes are computed locally with Web Crypto (RFC 6238). Nothing is stored — reload clears
          everything, so keep your secret in your password manager.
        </p>
      </div>
    </ToolWidget>
  );
}
