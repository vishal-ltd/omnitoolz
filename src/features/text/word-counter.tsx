"use client";

import { useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { TextArea } from "@/components/ui/form";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old",
  "see", "two", "way", "who", "did", "its", "let", "she", "too", "use", "that", "with",
  "have", "this", "will", "your", "from", "they", "know", "want", "been", "good",
  "much", "some", "time", "very", "when", "come", "here", "just", "like", "long",
  "make", "many", "over", "such", "take", "than", "them", "well", "were", "what",
]);

interface Stats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
  topKeywords: Array<{ word: string; count: number }>;
}

function analyze(text: string): Stats {
  const words = text.match(/[A-Za-z0-9'’-]+/g) ?? [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim().length > 0);

  const counts = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.length < 4 || STOPWORDS.has(lower)) continue;
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  const topKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    words: words.length,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: text.length === 0 ? 0 : text.split("\n").length,
    readingMinutes: words.length / 200,
    speakingMinutes: words.length / 130,
    topKeywords,
  };
}

function minutesLabel(minutes: number): string {
  if (minutes === 0) return "0 sec";
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return seconds > 0 ? `${whole} min ${seconds} sec` : `${whole} min`;
}

export default function WordCounterTool() {
  const [text, setText] = useState("");
  const stats = useMemo(() => analyze(text), [text]);

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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => (
            <div key={card.label} className="border-[3px] border-edge bg-canvas px-3 py-3 text-center shadow-[3px_3px_0_0_var(--color-shadow)]">
              <p className="font-body text-2xl text-ink tabular-nums">{card.value}</p>
              <p className="mt-1 font-display text-[8px] tracking-wide text-ink-soft uppercase">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-[3px] border-edge bg-canvas px-4 py-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
            <p className="font-display text-[8px] tracking-wide text-ink-soft uppercase">Reading time</p>
            <p className="mt-1 font-body text-2xl text-ink">{minutesLabel(stats.readingMinutes)}</p>
            <p className="font-body text-sm text-ink-soft">at 200 words per minute</p>
          </div>
          <div className="border-[3px] border-edge bg-canvas px-4 py-3 shadow-[3px_3px_0_0_var(--color-shadow)]">
            <p className="font-display text-[8px] tracking-wide text-ink-soft uppercase">Speaking time</p>
            <p className="mt-1 font-body text-2xl text-ink">{minutesLabel(stats.speakingMinutes)}</p>
            <p className="font-body text-sm text-ink-soft">at 130 words per minute</p>
          </div>
        </div>

        {stats.topKeywords.length > 0 && (
          <div className="border-[3px] border-dashed border-line-strong bg-canvas/60 px-4 py-3">
            <p className="font-display text-[8px] tracking-wide text-ink-soft uppercase">Top keywords</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.topKeywords.map((keyword) => (
                <span key={keyword.word} className="border-[3px] border-edge bg-brand-soft px-3 py-1 font-body text-lg text-brand">
                  {keyword.word}
                  <span className="ml-1.5 font-display text-[9px]">{keyword.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolWidget>
  );
}
