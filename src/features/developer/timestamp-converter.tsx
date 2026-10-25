"use client";

import { useEffect, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Field, TextInput } from "@/components/ui/form";

function formatParts(date: Date) {
  return [
    ["ISO 8601", date.toISOString()],
    ["Local", date.toLocaleString()],
    ["UTC", date.toUTCString()],
    ["Date only", date.toLocaleDateString()],
    ["Time only", date.toLocaleTimeString()],
    ["Unix (seconds)", String(Math.floor(date.getTime() / 1000))],
    ["Unix (milliseconds)", String(date.getTime())],
    ["Relative", relativeTime(date)],
  ] as const;
}

function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: Array<[number, string]> = [
    [31_536_000_000, "year"],
    [2_592_000_000, "month"],
    [604_800_000, "week"],
    [86_400_000, "day"],
    [3_600_000, "hour"],
    [60_000, "minute"],
    [1000, "second"],
  ];
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const value = Math.round(abs / ms);
      return diffMs < 0 ? `${value} ${name}${value === 1 ? "" : "s"} ago` : `in ${value} ${name}${value === 1 ? "" : "s"}`;
    }
  }
  return "just now";
}

export default function TimestampConverterTool() {
  const [now, setNow] = useState(() => Date.now());
  const [unixInput, setUnixInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const unixDate = (() => {
    const raw = unixInput.trim();
    if (!raw || !/^-?\d+$/.test(raw)) return null;
    const value = Number(raw);
    // 10-digit = seconds, 13-digit = milliseconds; guess sensibly.
    const ms = raw.length >= 13 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  })();

  const parsedDate = (() => {
    const raw = dateInput.trim();
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  })();

  const target = unixDate ?? parsedDate ?? new Date(now);

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Unix timestamp →" hint="Seconds or milliseconds (auto-detected)">
            <TextInput
              value={unixInput}
              onChange={(event) => setUnixInput(event.target.value)}
              placeholder={String(Math.floor(now / 1000))}
              aria-label="Unix timestamp"
              inputMode="numeric"
            />
          </Field>
          <Field label="Date / ISO string →" hint="Any format your browser understands">
            <TextInput
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
              placeholder={new Date(now).toISOString().slice(0, 16)}
              aria-label="Date input"
            />
          </Field>
        </div>

        <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
          {formatParts(target).map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="shrink-0 font-display text-[8px] text-ink-soft uppercase">{label}</span>
              <span className="break-all text-right font-body text-lg text-ink">{value}</span>
            </li>
          ))}
        </ul>

        {!unixDate && !parsedDate && (
          <p className="text-sm text-ink-soft">Showing the current time — type on either side to convert.</p>
        )}
        {(unixInput && !unixDate) || (dateInput && !parsedDate) ? (
          <p className="text-sm text-err">That doesn&apos;t parse as a timestamp — check the format.</p>
        ) : null}
      </div>
    </ToolWidget>
  );
}
