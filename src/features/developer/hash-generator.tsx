"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/form";
import { digest, HASH_ALGORITHMS } from "@/lib/hash";

export default function HashGeneratorTool() {
  const [text, setText] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (!text) {
      setHashes({});
      return;
    }
    (async () => {
      const entries: Record<string, string> = {};
      for (const algorithm of HASH_ALGORITHMS) {
        entries[algorithm] = await digest(algorithm, text);
      }
      if (!cancelled) setHashes(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [text]);

  const rows = useMemo(() => Object.entries(hashes), [hashes]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <Field label="Text — hashes update live and never leave this tab">
          <TextArea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type or paste anything…"
            aria-label="Text to hash"
            rows={4}
          />
        </Field>

        {rows.length > 0 && (
          <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {rows.map(([algorithm, value]) => (
              <li key={algorithm} className="flex items-center gap-3 px-4 py-3">
                <span className="w-20 shrink-0 font-display text-[8px] text-ink-soft uppercase">{algorithm}</span>
                <code className="min-w-0 flex-1 break-all font-body text-lg text-ink">{value}</code>
                <Button variant="secondary" size="sm" onClick={() => copy(value)}>
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-ink-soft">
          SHA-1 is shown for compatibility only — for anything security-related, prefer SHA-256 or stronger.
        </p>

        {text && (
          <Button variant="secondary" onClick={() => setText("")}>
            Clear
          </Button>
        )}
      </div>
    </ToolWidget>
  );
}
