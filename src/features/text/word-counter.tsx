"use client";

import { useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { TextArea } from "@/components/ui/form";
import { analyzeText, minutesLabel } from "@/lib/utils";

export default function WordCounterTool() {
  const [text, setText] = useState("");
  const stats = useMemo(() => analyzeText(text), [text]);

  const cards: Array<{ label: string; value: string }> = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Characters", value: stats.characters.toLocaleString() },
    { label: "No spaces", value: stats.charactersNoSpaces.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
    { label: "Lines", value: stats.lines.toLocaleString() },
  ];

  return (
    <ToolWidget>
      <div className="space-y-4">
        <label htmlFor="word-counter-input" className="sr-only">
          Text to analyze
        </label>
        <TextArea
          id="word-counter-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Start typing or paste your text here — counts update live…"
          className="min-h-56 text-lg"
        />

        <div
          role="status"
          aria-live="polite"
          aria-label="Text counts"
          className="grid grid-cols-2 gap-[3px] border-[3px] border-edge bg-line p-[3px] shadow-[3px_3px_0_0_var(--color-shadow)] sm:grid-cols-3 lg:grid-cols-6"
        >
          {cards.map((card) => (
            <div key={card.label} className="bg-canvas px-3 py-3 text-center">
              <p className="font-body text-2xl text-ink tabular-nums">{card.value}</p>
              <p className="mt-1 font-display text-display-xs tracking-wide text-ink-soft uppercase">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-[3px] border-edge bg-canvas px-4 py-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
            <p className="font-display text-display-xs tracking-wide text-ink-soft uppercase">Reading time</p>
            <p className="mt-1 font-body text-2xl text-ink">{minutesLabel(stats.readingMinutes)}</p>
            <p className="font-body text-sm text-ink-soft">at 200 words per minute</p>
          </div>
          <div className="border-[3px] border-edge bg-canvas px-4 py-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
            <p className="font-display text-display-xs tracking-wide text-ink-soft uppercase">Speaking time</p>
            <p className="mt-1 font-body text-2xl text-ink">{minutesLabel(stats.speakingMinutes)}</p>
            <p className="font-body text-sm text-ink-soft">at 130 words per minute</p>
          </div>
        </div>

        {stats.topKeywords.length > 0 && (
          <div className="border-[3px] border-dashed border-line-strong bg-canvas/60 px-4 py-3">
            <p className="font-display text-display-xs tracking-wide text-ink-soft uppercase">Top keywords</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.topKeywords.map((keyword) => (
                <span key={keyword.word} className="border-[3px] border-edge bg-brand-soft px-3 py-1 font-body text-lg text-brand">
                  {keyword.word}
                  <span className="ml-1.5 font-display text-display-xs">{keyword.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolWidget>
  );
}
