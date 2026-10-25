"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form";
import { bytesToBlob, suffixedName, type ResultFile } from "@/lib/utils";
import { decryptAndSave } from "./pdf-secure";

export default function UnlockPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [password, setPassword] = useState("");
  const [wasUnprotected, setWasUnprotected] = useState(false);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function unlock() {
    const source = file!;
    const chosen = password;
    await start(async ({ report }) => {
      report("Checking the password…", 0.4);
      const { bytes, wasUnprotected: unprotected } = await decryptAndSave(source, chosen);
      setWasUnprotected(unprotected);
      const result: ResultFile = {
        name: suffixedName(source.name, "-unlocked"),
        blob: bytesToBlob(bytes, "application/pdf"),
      };
      return [result];
    }, "Removing the password…");
  }

  const note = wasUnprotected
    ? "This file had no open password — you received a clean re-saved copy with restrictions dropped."
    : "The password requirement is gone — the unlocked copy opens directly.";

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={note}
          onReset={() => {
            queue.clear();
            setPassword("");
            setWasUnprotected(false);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Current password">
              <Field
                label="Open password"
                hint="The password you normally use to open this file"
                className="sm:col-span-2"
              >
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Current password"
                  aria-label="Current PDF password"
                  autoComplete="current-password"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Only works with the real password — there&apos;s no cracking, ever.
            </p>
            <Button
              size="lg"
              disabled={!file}
              onClick={unlock}
            >
              Remove Password
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
