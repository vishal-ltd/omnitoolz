import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import {
  analyzeText,
  baseName,
  clamp,
  collectRegexMatches,
  extensionOf,
  formatBytes,
  minutesLabel,
  regexWorkerSource,
  suffixedName,
  withExtension,
} from "./utils";

describe("formatBytes", () => {
  it("formats byte units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
    expect(formatBytes(3.5 * 1024 ** 3)).toBe("3.5 GB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-5)).toBe("—");
  });
});

describe("file name helpers", () => {
  it("baseName strips the last extension", () => {
    expect(baseName("report.pdf")).toBe("report");
    expect(baseName("archive.tar.gz")).toBe("archive.tar");
    expect(baseName("noext")).toBe("noext");
  });

  it("extensionOf lowercases", () => {
    expect(extensionOf("photo.JPG")).toBe("jpg");
    expect(extensionOf("noext")).toBe("");
  });

  it("withExtension swaps the extension", () => {
    expect(withExtension("photo.jpg", "png")).toBe("photo.png");
    expect(withExtension("photo", ".png")).toBe("photo.png");
  });

  it("suffixedName inserts before the extension", () => {
    expect(suffixedName("scan.pdf", "-rotated")).toBe("scan-rotated.pdf");
    expect(suffixedName("noext", "-x")).toBe("noext-x.bin");
  });
});

describe("clamp", () => {
  it("clamps to bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("collectRegexMatches", () => {
  it("collects matches with indices and groups", () => {
    const { matches, capped } = collectRegexMatches("(\\w+)@(\\w+)", "g", "a@b c@d", 500);
    expect(capped).toBe(false);
    expect(matches).toEqual([
      { text: "a@b", index: 0, groups: ["a", "b"] },
      { text: "c@d", index: 4, groups: ["c", "d"] },
    ]);
  });

  it("caps the match count and reports it", () => {
    const { matches, capped } = collectRegexMatches("a", "g", "a a a a", 2);
    expect(matches.length).toBe(2);
    expect(capped).toBe(true);
  });

  it("handles zero-width matches without losing positions", () => {
    const { matches } = collectRegexMatches("\\b", "g", "abc", 500);
    expect(matches.map((m) => m.index)).toEqual([0, 3]);
    expect(matches.every((m) => m.text === "")).toBe(true);
  });

  it("returns only the first match without the g flag", () => {
    const { matches } = collectRegexMatches("a", "", "aaa", 500);
    expect(matches.length).toBe(1);
  });

  it("throws on invalid patterns", () => {
    expect(() => collectRegexMatches("(", "g", "x", 500)).toThrow();
  });
});

describe("regexWorkerSource", () => {
  /** Run the worker bootstrap against a shimmed `self` — same code the browser runs. */
  function runWorker(data: unknown): Record<string, unknown> {
    const posted: Array<Record<string, unknown>> = [];
    const shim = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: (message: Record<string, unknown>) => posted.push(message),
    };
    new Function("self", regexWorkerSource())(shim);
    shim.onmessage!({ data });
    return posted[0];
  }

  it("runs the same collector and posts results", () => {
    const data = { pattern: "(\\w+)@(\\w+)", flags: "g", text: "a@b c@d", maxMatches: 500 };
    const direct = collectRegexMatches(data.pattern, data.flags, data.text, data.maxMatches);
    expect(runWorker(data)).toEqual({ ok: true, matches: direct.matches, capped: false });
  });

  it("posts invalid-pattern errors instead of throwing", () => {
    const reply = runWorker({ pattern: "(", flags: "g", text: "x", maxMatches: 500 });
    expect(reply.ok).toBe(false);
    expect(typeof reply.error).toBe("string");
  });

  it("isolates a catastrophic pattern — no answer within the deadline", async () => {
    // (a+)+$ on 30 a's + "!" backtracks exponentially. In the browser the
    // component terminates the worker at 2s; here we prove the run really is
    // unbounded, so only termination (not the text cap) can save the tab.
    const payload = JSON.stringify({ pattern: "(a+)+$", flags: "g", text: "a".repeat(30) + "!", maxMatches: 500 });
    const worker = new Worker(
      `const { parentPort } = require("worker_threads");
       const self = { onmessage: null, postMessage: (m) => parentPort.postMessage(m) };
       ${regexWorkerSource()}
       self.onmessage({ data: ${payload} });`,
      { eval: true },
    );
    const answered = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 1500);
      worker.on("message", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    await worker.terminate();
    expect(answered).toBe(false);
  }, 10_000);
});

describe("analyzeText", () => {
  it("counts unicode words as whole words", () => {
    expect(analyzeText("naïve résumé café").words).toBe(3);
    expect(analyzeText("hello world").words).toBe(2);
    expect(analyzeText("don’t stop").words).toBe(2);
  });

  it("counts characters as code points, not UTF-16 units", () => {
    const stats = analyzeText("hi 🌍");
    // h, i, space, earth = 4 code points (UTF-16 would say 5).
    expect(stats.characters).toBe(4);
    expect(stats.charactersNoSpaces).toBe(3);
  });

  it("counts sentences, paragraphs and lines", () => {
    const stats = analyzeText("One. Two! Three?\n\nNew paragraph.\nLast line.");
    expect(stats.sentences).toBe(5);
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(4);
  });

  it("skips stopwords and short words in keywords", () => {
    const stats = analyzeText("zebra zebra zebra the and apple");
    expect(stats.topKeywords[0]).toEqual({ word: "zebra", count: 3 });
    expect(stats.topKeywords.some((k) => k.word === "the")).toBe(false);
  });

  it("handles empty text", () => {
    const stats = analyzeText("");
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.lines).toBe(0);
    expect(stats.topKeywords).toEqual([]);
  });
});

describe("minutesLabel", () => {
  it("formats sub-minute and whole-minute times", () => {
    expect(minutesLabel(0)).toBe("0 sec");
    expect(minutesLabel(0.5)).toBe("30 sec");
    expect(minutesLabel(2)).toBe("2 min");
    expect(minutesLabel(1.5)).toBe("1 min 30 sec");
  });

  it("carries rounded 60 seconds into the next minute", () => {
    // 399 words at 200 wpm = 1.995 min → used to render "1 min 60 sec".
    expect(minutesLabel(399 / 200)).toBe("2 min");
  });
});
