"use client";

import { useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput } from "@/components/ui/form";

export default function UuidGeneratorTool() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);

  function generate() {
    const values = Array.from({ length: count }, () => {
      let uuid = crypto.randomUUID();
      if (!hyphens) uuid = uuid.replace(/-/g, "");
      if (uppercase) uuid = uuid.toUpperCase();
      if (braces) uuid = `{${uuid}}`;
      return uuid;
    });
    setUuids(values);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(uuids.join("\n"));
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <OptionsPanel title="Options">
          <Field label={`How many — ${count}`}>
            <RangeInput value={count} min={1} max={50} onChange={setCount} suffix="×" />
          </Field>
          <div className="flex items-end gap-4">
            <Checkbox checked={uppercase} onChange={setUppercase} label="UPPERCASE" />
            <Checkbox checked={hyphens} onChange={setHyphens} label="Hyphens" />
            <Checkbox checked={braces} onChange={setBraces} label="Braces {}" />
          </div>
        </OptionsPanel>

        <Button size="lg" onClick={generate}>
          Generate UUIDs
        </Button>

        {uuids.length > 0 && (
          <>
            <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
              {uuids.map((uuid) => (
                <li key={uuid} className="px-4 py-2.5 font-body text-lg break-all text-ink">
                  {uuid}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button onClick={copyAll}>Copy all</Button>
              <Button variant="secondary" onClick={() => setUuids([])}>
                Clear
              </Button>
            </div>
          </>
        )}

        <p className="text-sm text-ink-soft">
          Random v4 identifiers from your browser&apos;s cryptographic source — generated locally, never stored.
        </p>
      </div>
    </ToolWidget>
  );
}
