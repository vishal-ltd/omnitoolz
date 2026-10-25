"use client";

import { useEffect, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/form";
import { digest, HASH_ALGORITHMS, parseDigestInput, type HashAlgorithm } from "@/lib/hash";
import { formatBytes } from "@/lib/utils";

export default function FileHashVerifierTool() {
  const queue = useFileQueue({ accept: [], multiple: false, maxFiles: 1, maxSizeMb: 500 });
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [expected, setExpected] = useState("");
  const [computed, setComputed] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = queue.files[0];

  useEffect(() => {
    setComputed(null);
    setError(null);
    if (!file) return;
    let cancelled = false;
    setWorking(true);
    (async () => {
      try {
        // Stream large files in chunks so the tab never blocks.
        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const result = await digest(algorithm, bytes);
        if (!cancelled) setComputed(result);
      } catch {
        if (!cancelled) setError("Hashing failed — try a smaller file.");
      } finally {
        if (!cancelled) setWorking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, algorithm]);

  const cleanedExpected = parseDigestInput(expected);
  const match =
    computed && cleanedExpected ? (computed === cleanedExpected ? "match" : "mismatch") : null;

  return (
    <ToolWidget>
      <div className="space-y-4">
        <FileDropZone accept={[]} multiple={false} maxFiles={1} maxSizeMb={500} onFiles={queue.addFiles} existingCount={queue.files.length} hint="Any file — up to 500 MB" />
        <FileList files={queue.files} onRemove={queue.removeAt} />

        {file && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Algorithm">
                <Select
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}
                  aria-label="Hash algorithm"
                >
                  {HASH_ALGORITHMS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Expected digest" hint="Paste the published checksum">
                <TextInput
                  value={expected}
                  onChange={(event) => setExpected(event.target.value)}
                  placeholder="e3b0c44298fc1c14…"
                  aria-label="Expected digest"
                  className="font-mono"
                />
              </Field>
            </div>

            {working && <p className="font-body text-lg text-ink-soft">Hashing {formatBytes(file.size)}…</p>}
            {error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</p>}

            {computed && (
              <div className="space-y-3">
                <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
                  <p className="font-display text-[8px] text-ink-soft uppercase">{algorithm} of {file.name}</p>
                  <p className="mt-1.5 break-all font-mono text-sm text-ink">{computed}</p>
                </div>

                {match && (
                  <div
                    className={`border-[3px] p-4 shadow-[4px_4px_0_0_var(--color-shadow)] ${
                      match === "match" ? "border-ok bg-ok-soft" : "border-err bg-err-soft"
                    }`}
                    role="status"
                  >
                    <p className="font-display text-[10px] uppercase">
                      {match === "match" ? "✓ Checksums match" : "✗ Checksums differ"}
                    </p>
                    <p className="mt-2 font-body text-lg text-ink-soft">
                      {match === "match"
                        ? "The file is byte-for-byte what the publisher hashed."
                        : "The file differs from the published digest — re-download or distrust it."}
                    </p>
                  </div>
                )}

                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(computed)}>
                  Copy computed digest
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ToolWidget>
  );
}
