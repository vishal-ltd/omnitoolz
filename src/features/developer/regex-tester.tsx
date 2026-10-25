"use client";

import { useMemo, useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/form";

interface MatchInfo {
  text: string;
  index: number;
  groups: string[];
}

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [dotAll, setDotAll] = useState(false);
  const [testText, setTestText] = useState("");

  const effectiveFlags = useMemo(
    () =>
      `g${caseInsensitive ? "i" : ""}${multiline ? "m" : ""}${dotAll ? "s" : ""}` + (flags.includes("u") ? "u" : ""),
    [caseInsensitive, multiline, dotAll, flags],
  );

  const { matches, error } = useMemo(() => {
    if (!pattern || !testText) return { matches: [] as MatchInfo[], error: null as string | null };
    try {
      const regex = new RegExp(pattern, effectiveFlags);
      const found: MatchInfo[] = [];
      if (regex.global) {
        for (const match of testText.matchAll(regex)) {
          found.push({
            text: match[0],
            index: match.index ?? 0,
            groups: match.slice(1).map((group) => group ?? "—"),
          });
          if (found.length > 500) break;
        }
      } else {
        const match = regex.exec(testText);
        if (match) {
          found.push({
            text: match[0],
            index: match.index,
            groups: match.slice(1).map((group) => group ?? "—"),
          });
        }
      }
      return { matches: found, error: null };
    } catch (e) {
      return { matches: [], error: e instanceof Error ? e.message : "Invalid pattern." };
    }
  }, [pattern, testText, effectiveFlags]);

  // Build highlighted output pieces
  const segments = useMemo(() => {
    if (matches.length === 0) return [{ text: testText, hit: false }];
    const parts: Array<{ text: string; hit: boolean }> = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.index > cursor) parts.push({ text: testText.slice(cursor, match.index), hit: false });
      parts.push({ text: match.text, hit: true });
      cursor = match.index + match.text.length;
      if (cursor === match.index) cursor++; // guard empty matches
    }
    if (cursor < testText.length) parts.push({ text: testText.slice(cursor), hit: false });
    return parts;
  }, [matches, testText]);

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]">
          <Field label="Pattern">
            <TextInput
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="\b\w+@\w+\.\w+\b"
              aria-label="Regular expression"
              className="font-mono"
            />
          </Field>
          <Field label="Flags">
            <TextInput value={flags} onChange={(event) => setFlags(event.target.value)} aria-label="Regex flags" />
          </Field>
        </div>

        <OptionsPanel title="Common flags">
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <Checkbox checked={caseInsensitive} onChange={setCaseInsensitive} label="i — case-insensitive" />
            <Checkbox checked={multiline} onChange={setMultiline} label="m — multiline ^$" />
            <Checkbox checked={dotAll} onChange={setDotAll} label="s — dot matches all" />
          </div>
        </OptionsPanel>

        <Field label="Test text">
          <TextArea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            placeholder="Paste the text to match against…"
            aria-label="Test text"
            rows={6}
          />
        </Field>

        {error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</p>}

        <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
          <p className="font-display text-[9px] text-ink-soft uppercase">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
            {matches.length > 0 && ` · flags /${effectiveFlags}/`}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words font-body text-lg leading-snug text-ink">
            {segments.map((segment, index) =>
              segment.hit ? (
                <mark key={index} className="bg-gold/60 px-0.5 text-ink">
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </div>

        {matches.some((match) => match.groups.length > 0) && (
          <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card">
            {matches.slice(0, 20).map((match, index) => (
              <li key={index} className="px-4 py-2 font-body text-lg text-ink">
                <span className="text-ink-soft">#{index + 1} </span>
                “{match.text.slice(0, 40)}”
                {match.groups.length > 0 && (
                  <span className="text-ink-soft"> — groups: {match.groups.map((g, i) => `$${i + 1}=${g}`).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolWidget>
  );
}
